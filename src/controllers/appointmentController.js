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

/**
 * Retrieves all appointments associated with doctors of a given specialty.
 */
const getAppointmentsBySpecialty = async (req, res) => {
  try {
    const { specialty } = req.query;

    if (!specialty) {
      return res.status(400).json({ error: "El parámetro 'specialty' es obligatorio." });
    }

    const appointments = await AppointmentService.getAppointmentsBySpecialty(
      specialty,
      req.token
    );

    const formatted = appointments.map(formatAppointmentDates);

    return res.json({
      message: "Citas obtenidas correctamente por especialidad",
      count: formatted.length,
      appointments: formatted
    });
  } catch (error) {
    console.error("Error obteniendo citas por especialidad:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Retrieves all appointments for a given patient ID
 */
const getAppointmentsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: "El ID del paciente es obligatorio." });
    }

    const appointments = await AppointmentService.getAppointmentsByPatientId(patientId);
    const formatted = appointments.map(formatAppointmentDates);

    return res.json({
      message: "Citas del paciente obtenidas correctamente",
      count: formatted.length,
      appointments: formatted
    });
  } catch (error) {
    console.error("Error obteniendo citas del paciente:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Reuse general update logic to handle doctor reassignment
 */

const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: "El ID del doctor es obligatorio." });
    }

    const updated = await AppointmentService.update(id, { doctorId }, req.token);

    return res.json({
      message: "Doctor asignado correctamente a la cita",
      appointment: formatAppointmentDates(updated)
    });
  } catch (error) {
    console.error("Error actualizando doctor en la cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

const handleDoctorInactive = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const results = await AppointmentService.handleDoctorInactive(doctorId, req.token);

    return res.json({
      message: "Citas canceladas y reprogramadas según disponibilidad",
      results,
    });
  } catch (error) {
    console.error("Error manejando doctor inactivo:", error);
    return res.status(400).json({ error: error.message });
  }
};

const confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token requerido." });
    }

    const result = await AppointmentService.confirm(id, token);

    return res.json({
      message: "Cita confirmada exitosamente",
      appointment: result
    });

  } catch (error) {
    console.error("Error confirmando cita:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointments,
  getAppointmentsBySpecialty,
  getAppointmentsByPatientId,
  updateDoctor,
  handleDoctorInactive, 
  confirmAppointment
};
