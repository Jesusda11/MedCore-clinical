const axios = require("axios");
const { PrismaClient, AppointmentStatus } = require("../../generated/prisma");
const prisma = new PrismaClient();

const SECURITY_MS_URL = process.env.SECURITY_MS_URL;

/**
 * Checks if a string is a valid MongoDB ObjectId format.
 * Throws an error if the value is not valid.
 */
const validateObjectId = (id, fieldName) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new Error(`${fieldName} inválido.`);
  }
};

/**
 * Validates that the doctor exists and is currently active
 * in the system. If any condition fails, an error is thrown
 * to stop the process.
 */
const getDoctorData = async (doctorId, token) => {
  validateObjectId(doctorId, "ID del médico");

  try {
    const { data } = await axios.get(
      `${SECURITY_MS_URL}/users/doctors/${doctorId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.status !== "ACTIVE") throw new Error("El médico está inactivo.");

    return data;
  } catch (error) {
    throw new Error(error.message || "Error verificando el doctor en ms-security.");
  }
};

/**
 * Validates that the patient exists and is currently active
 * in the system. If any condition fails, an error is thrown
 * to stop the process.
 */
const getPatientData = async (patientId, token) => {
  validateObjectId(patientId, "ID del paciente");

  const url = `${SECURITY_MS_URL}/users/patients/${patientId}`;

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (data.status !== "ACTIVE") {
      throw new Error("El paciente está inactivo.");
    }

    return data;
  } catch (error) {
    console.error("Error en getPatientData:", error.response?.data || error.message);
    throw new Error("Error verificando el paciente en ms-security.");
  }
};

/**
 * Validates that neither the doctor nor the patient have scheduling conflicts
 * with existing appointments in the given time range. Excludes cancelled appointments
 * and optionally ignores a specific appointment (useful for updates).
 */
const validateScheduleConflict = async ({ doctorId, patientId, start, end, ignoreId = null }) => {
  const conflict = await prisma.appointment.findFirst({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      status: { not: AppointmentStatus.CANCELLED },
      AND: [
        { startTime: { lt: end } },
        { endTime: { gt: start } },
        {
          OR: [
            { doctorId },
            { patientId }
          ]
        }
      ]
    }
  });

  if (conflict) {
    if (conflict.doctorId === doctorId)
      throw new Error("El doctor ya tiene una cita en ese horario.");

    if (conflict.patientId === patientId)
      throw new Error("El paciente ya tiene una cita en ese horario.");
  }
};

module.exports = {
  validateObjectId,
  getDoctorData,
  getPatientData,
  validateScheduleConflict
};
