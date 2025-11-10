const AppointmentService = require("../services/appointmentService");
const { formatAppointmentDates } = require("../utils/dateHelper");

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
      appointment: formatAppointmentDates(appointment)
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
      { startTime, status, doctorId },
      req.token
    );

    return res.json({
      message: "Cita actualizada correctamente",
      appointment: formatAppointmentDates(updated)
    });
  } catch (error) {
    console.error("Error actualizando cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    const cancelled = await AppointmentService.cancel(id);

    return res.json({
      message: "Cita cancelada correctamente",
      appointment: formatAppointmentDates(cancelled)
    });
  } catch (error) {
    console.error("Error cancelando cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Retrieves appointments with optional filters
 */
const getAppointments = async (req, res) => {
  try {
    const { date, startDate, endDate, startTime, endTime, doctorId, patientId, status } = req.query;

    const appointments = await AppointmentService.getAppointments({
      date,
      startDate,
      endDate,
      startTime,
      endTime,
      doctorId,
      patientId,
      status
    });

    const formatted = appointments.map(formatAppointmentDates);

    return res.json({
      message: "Citas obtenidas correctamente",
      count: formatted.length,
      appointments: formatted
    });
  } catch (error) {
    console.error("Error obteniendo citas:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointments
};
