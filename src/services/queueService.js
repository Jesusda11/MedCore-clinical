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

    const twoHoursAfterAppointment = new Date(appointmentDate.getTime() + 2 * 60 * 60000);

    if (now > twoHoursAfterAppointment) {
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

    // Actualizar el estado de la cita a ONGOING
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.ONGOING }
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
  }
};

module.exports = QueueService;
