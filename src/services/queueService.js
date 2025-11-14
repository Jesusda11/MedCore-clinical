const { PrismaClient, QueueStatus, AppointmentStatus } = require("../generated/prisma");
const prisma = new PrismaClient();

const QueueService = {
  /**
   * Adds a patient to the queue when they check-in at the clinic.
   * Validates that check-in is within 30 minutes before the appointment time.
   * Automatically assigns the next available queue number for the doctor.
   * Estimates waiting time based on patients ahead in the queue.
   */
  join: async (appointmentId) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    });

    if (!appointment) {
      throw new Error("Cita no encontrada.");
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new Error("La cita está cancelada.");
    }

    const now = new Date();
    const appointmentDate = new Date(appointment.startTime);

    const isToday =
      appointmentDate.getDate() === now.getDate() &&
      appointmentDate.getMonth() === now.getMonth() &&
      appointmentDate.getFullYear() === now.getFullYear();

    if (!isToday) {
      throw new Error("La cita no es para hoy.");
    }

    const thirtyMinutesBeforeAppointment = new Date(appointmentDate.getTime() - 30 * 60000);

    if (now < thirtyMinutesBeforeAppointment) {
      const minutesUntilCheckIn = Math.ceil((thirtyMinutesBeforeAppointment - now) / 60000);
      throw new Error(
        `Solo puede hacer check-in 30 minutos antes de su cita. ` +
          `Puede hacer check-in en ${minutesUntilCheckIn} minuto(s).`
      );
    }

    const tenMinutesAfterAppointment = new Date(appointmentDate.getTime() + 10 * 60000);

    if (now > tenMinutesAfterAppointment) {
      throw new Error("La cita ya pasó. Debe agendar una nueva cita.");
    }

    const existingQueue = await prisma.queue.findFirst({
      where: { appointmentId }
    });

    if (existingQueue) {
      throw new Error("Ya hizo check-in para esta cita.");
    }

    const activeQueue = await prisma.queue.findFirst({
      where: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: {
          in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]
        }
      }
    });

    if (activeQueue) {
      throw new Error("Ya tiene una entrada activa en la cola de este doctor.");
    }

    const lastQueue = await prisma.queue.findFirst({
      where: {
        doctorId: appointment.doctorId,
        status: {
          in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]
        }
      },
      orderBy: { queueNumber: "desc" }
    });

    const queueNumber = lastQueue ? lastQueue.queueNumber + 1 : 1;

    const queueEntry = await prisma.queue.create({
      data: {
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        queueNumber,
        status: QueueStatus.WAITING
      }
    });

    //Calcular tiempo estimado de espera
    const AVERAGE_APPOINTMENT_DURATION_MINUTES = 30;
    const patientsAhead = await prisma.queue.count({
      where: {
        doctorId: appointment.doctorId,
        status: QueueStatus.WAITING,
        queueNumber: { lt: queueNumber }
      }
    });

    const estimatedWaitTimeMinutes = patientsAhead * AVERAGE_APPOINTMENT_DURATION_MINUTES;

    return {
      ...queueEntry,
      estimatedWaitTimeMinutes
    };
  },
  /**
   * Retrieves the current active queue for a specific doctor.
   * Includes waiting, called, and in-progress patients ordered by queueNumber.
   */
  getCurrentQueueByDoctor: async (doctorId) => {
    if (!doctorId) {
      throw new Error("El ID del doctor es obligatorio.");
    }

    const activeStatuses = [
      QueueStatus.WAITING,
      QueueStatus.CALLED,
      QueueStatus.IN_PROGRESS
    ];

    const currentQueue = await prisma.queue.findMany({
      where: {
        doctorId,
        status: { in: activeStatuses }
      },
      orderBy: { queueNumber: "asc" }
    });

    if (currentQueue.length === 0) {
      throw new Error("No hay pacientes actualmente en la cola para este doctor.");
    }

    return currentQueue;
  },

  /**
   * Calls the next patient in the queue for a given doctor.
   * Finds the first WAITING entry (lowest queueNumber) and marks it as CALLED.
   */
  callNext: async (doctorId) => {
    if (!doctorId) {
      throw new Error("El ID del doctor es obligatorio.");
    }

    const activePatient = await prisma.queue.findFirst({
      where: {
        doctorId,
        status: { in: [QueueStatus.CALLED, QueueStatus.IN_PROGRESS] }
      },
      orderBy: { updatedAt: "desc" }
    });

    if (activePatient) {
      throw new Error("Ya hay un paciente siendo atendido o llamado. Complete su atención antes de llamar al siguiente.");
    }

    const nextPatient = await prisma.queue.findFirst({
      where: {
        doctorId,
        status: QueueStatus.WAITING
      },
      orderBy: { queueNumber: "asc" }
    });

    if (!nextPatient) {
      throw new Error("No hay más pacientes en espera.");
    }

    const updatedQueueEntry = await prisma.queue.update({
      where: { id: nextPatient.id },
      data: {
        status: QueueStatus.CALLED,
        updatedAt: new Date()
      }
    });

    if (nextPatient.appointmentId) {
    await prisma.appointment.update({
      where: { id: nextPatient.appointmentId },
      data: { status: AppointmentStatus.IN_PROGRESS}
    });
  }
    return updatedQueueEntry;
  },

  /**
   * Marks a queue ticket as completed.
   * Updates both the queue status and the linked appointment status.
   */
  completeTicket: async (ticketId) => {
    if (!ticketId) {
      throw new Error("El ID del ticket es obligatorio.");
    }

    const ticket = await prisma.queue.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error("Ticket no encontrado.");
    }

    if (![QueueStatus.IN_PROGRESS, QueueStatus.CALLED].includes(ticket.status)) {
      throw new Error("Solo se pueden completar tickets en estado 'CALLED' o 'IN_PROGRESS'.");
    }

    const updatedTicket = await prisma.queue.update({
      where: { id: ticketId },
      data: {
        status: QueueStatus.COMPLETED,
        updatedAt: new Date()
      }
    });

    if (ticket.appointmentId) {
      await prisma.appointment.update({
        where: { id: ticket.appointmentId },
        data: { status: AppointmentStatus.COMPLETED }
      });
    }

    return updatedTicket;
  },

  /**
   * Retrieves the current position and estimated waiting time of a ticket in the queue.
   */
  getTicketPosition: async (ticketId) => {
    if (!ticketId) {
      throw new Error("El ID del ticket es obligatorio.");
    }

    const ticket = await prisma.queue.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error("Ticket no encontrado.");
    }

    if ([QueueStatus.COMPLETED, QueueStatus.CANCELLED].includes(ticket.status)) {
      return {
        ticketId: ticket.id,
        status: ticket.status,
        position: null,
        estimatedWaitTimeMinutes: 0,
        message: "El ticket ya fue completado o cancelado."
      };
    }

    const patientsAhead = await prisma.queue.count({
      where: {
        doctorId: ticket.doctorId,
        status: QueueStatus.WAITING,
        queueNumber: { lt: ticket.queueNumber }
      }
    });

    const AVERAGE_APPOINTMENT_DURATION_MINUTES = 30;
    const estimatedWaitTimeMinutes = patientsAhead * AVERAGE_APPOINTMENT_DURATION_MINUTES;

    return {
      ticketId: ticket.id,
      doctorId: ticket.doctorId,
      status: ticket.status,
      queueNumber: ticket.queueNumber,
      position: patientsAhead + 1,
      estimatedWaitTimeMinutes
    };
  }

};

module.exports = QueueService;
