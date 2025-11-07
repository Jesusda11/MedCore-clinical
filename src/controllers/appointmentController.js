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

const updateAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    const { startTime, status, doctorId } = req.body;

    if (!startTime && !status && !doctorId) {
      return res.status(400).json({
        error: "Se debe enviar al menos un campo para actualizar."
      });
    }

    const updated = await AppointmentService.update(
      id,
      {
        startTime,
        status,
        doctorId
      },
      req.token
    );

    return res.json({
      message: "Cita actualizada correctamente",
      appointment: updated
    });
  } catch (error) {
    console.error("Error actualizando cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createAppointment,
  updateAppointment
};