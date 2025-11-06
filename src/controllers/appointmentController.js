const AppointmentService = require("../services/appointmentService");

const createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, startTime } = req.body;

    if (!patientId || !doctorId || !startTime) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    const appointment = await AppointmentService.create({
      patientId,
      doctorId,
      startTime,
      token: req.token
    });

    return res.status(201).json({
      message: "Cita creada correctamente",
      appointment
    });

  } catch (error) {
    console.error("Error creando cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createAppointment
};
