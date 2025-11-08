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

module.exports = {
  joinQueue
};