const QueueService = require("../services/queueService");

/**
 * Handles patient check-in to join the queue
 */
const joinQueue = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        error: "El ID de la cita es obligatorio."
      });
    }

    const queueEntry = await QueueService.join(appointmentId);

    return res.status(201).json({
      message: "Check-in exitoso. Ha sido agregado a la cola.",
      queue: {
        id: queueEntry.id,
        queueNumber: queueEntry.queueNumber,
        status: queueEntry.status,
        patientId: queueEntry.patientId,
        doctorId: queueEntry.doctorId,
        estimatedWaitTimeMinutes: queueEntry.estimatedWaitTimeMinutes
      }
    });

  } catch (error) {
    console.error("Error en check-in:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Gets the current active queue for a specific doctor
 */
const getCurrentQueueByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ error: "El ID del doctor es obligatorio." });
    }

    const queue = await QueueService.getCurrentQueueByDoctor(doctorId);

    return res.status(200).json({
      message: "Cola actual del doctor obtenida exitosamente.",
      queue
    });
  } catch (error) {
    console.error("Error obteniendo la cola actual:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Calls the next patient in the doctor's queue
 */
const callNextPatient = async (req, res) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: "El ID del doctor es obligatorio." });
    }

    const nextPatient = await QueueService.callNext(doctorId);

    return res.status(200).json({
      message: "El siguiente paciente ha sido llamado.",
      queue: nextPatient
    });
  } catch (error) {
    console.error("Error al llamar al siguiente paciente:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Marks a queue ticket as completed
 */
const completeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({ error: "El ID del ticket es obligatorio." });
    }

    const updatedTicket = await QueueService.completeTicket(ticketId);

    return res.status(200).json({
      message: "Ticket completado exitosamente.",
      ticket: updatedTicket
    });
  } catch (error) {
    console.error("Error completando el ticket:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Gets the current position and estimated wait time of a ticket
 */
const getTicketPosition = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({ error: "El ID del ticket es obligatorio." });
    }

    const positionInfo = await QueueService.getTicketPosition(ticketId);

    return res.status(200).json({
      message: "Posición del ticket obtenida exitosamente.",
      position: positionInfo
    });
  } catch (error) {
    console.error("Error obteniendo la posición del ticket:", error);
    return res.status(400).json({ error: error.message });
  }
};

const getPatientStatus = async (req, res) => {
    try {
      const { patientId } = req.params;
      const token = req.headers.authorization?.split(" ")[1] || req.headers.authorization;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "El ID del paciente es requerido."
        });
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Token de autorización no proporcionado."
        });
      }

      const queueStatus = await QueueService.getPatientQueueStatus(patientId, token);

      return res.status(200).json({
        success: true,
        data: queueStatus
      });

    } catch (error) {
      console.error("Error al obtener estado del paciente en la cola:", error);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(401).json({
          success: false,
          message: "Token inválido o expirado."
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el estado del paciente en la cola."
      });
    }
}

const getCurrentPatient = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const ticket = await QueueService.getCurrentPatientByDoctor(doctorId);

    if (!ticket) {
      return res.status(200).json({
        doctorId,
        message: "El doctor no está atendiendo a ningún paciente en este momento.",
        currentPatient: null
      });
    }

    return res.status(200).json({
      doctorId,
      message: "Paciente actualmente en atención obtenido correctamente.",
      currentPatient: ticket
    });

  } catch (error) {
    console.error("ERROR getCurrentPatient:", error);
    return res.status(400).json({
      error: error.message || "Error al obtener el paciente actual."
    });
  }
};

const startAppointment = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const appointmentId = req.params.appointmentId;

    const result = await QueueService.startAppointment(doctorId, appointmentId);

    return res.status(200).json({
      message: "La atención del paciente ha iniciado correctamente.",
      doctorId,
      appointmentId,
      status: "IN_PROGRESS",
      data: result
    });

  } catch (error) {
    console.error("ERROR startAppointment:", error);
    return res.status(400).json({
      error: error.message
    });
  }
};

const getDoctorHistory = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const history = await QueueService.getDoctorHistory(doctorId);

    return res.status(200).json({
      message: "Historial obtenido correctamente.",
      doctorId,
      total: history.length,
      data: history
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(400).json({
      error: error.message
    });
  }
};

module.exports = {
  joinQueue,
  getCurrentQueueByDoctor,
  callNextPatient,
  completeTicket,
  getTicketPosition,
  getPatientStatus,
  getCurrentPatient,
  startAppointment,
  getDoctorHistory
};