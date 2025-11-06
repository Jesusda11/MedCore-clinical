const { PrismaClient, AppointmentStatus } = require("../generated/prisma");
const prisma = new PrismaClient();
const axios = require("axios");
require("dotenv").config();

const SECURITY_MS_URL = process.env.SECURITY_MS_URL;
const PATIENT_MS_URL = process.env.PATIENT_MS_URL;

const AppointmentService = {
  create: async ({ patientId, doctorId, startTime, token }) => {

    if (!/^[0-9a-fA-F]{24}$/.test(doctorId)) {
      throw new Error("El ID del médico no es válido.");
    }

    let doctor;
    try {
      const response = await axios.get(
        `${SECURITY_MS_URL}/users/doctors/${doctorId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      doctor = response.data;
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error("Error verificando el doctor en ms-security.");
    }

    if (doctor.role !== "MEDICO") {
      throw new Error("El usuario no es un médico válido.");
    }

    if (doctor.status !== "ACTIVE") {
      throw new Error("El médico está inactivo, no se puede asignar a una cita.");
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      throw new Error("Fecha de inicio inválida.");
    }

    if (start < new Date()) {
      throw new Error("La fecha de inicio no puede ser en el pasado.");
    }

    const end = new Date(start.getTime() + 30 * 60000); // Duración de 30 minutos

    //Validar conflicto con otras citas
    const overlapping = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { not: AppointmentStatus.CANCELLED },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } }
        ]
      }
    });

    if (overlapping) {
      throw new Error("El doctor ya tiene una cita en ese horario.");
    }

    if (!/^[0-9a-fA-F]{24}$/.test(patientId)) {
      throw new Error("ID de paciente inválido.");
    }

    let patient;
    try {
      const responsePatient = await axios.get(
        `${PATIENT_MS_URL}/patients/${patientId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      patient = responsePatient.data;

    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error("El paciente no existe.");
      }
      throw new Error("Error verificando el paciente en ms-patient-ehr.");
    }

    if (patient.role !== "PACIENTE") {
      throw new Error("El usuario no es un paciente válido.");
    }

    if (patient.status !== "ACTIVE") {
      throw new Error("El paciente no está activo, no se puede crear la cita.");
    }

    // Validar conflicto del paciente (no puede tener dos citas a la misma hora)
    const patientOverlapping = await prisma.appointment.findFirst({
      where: {
        patientId,
        status: { not: AppointmentStatus.CANCELLED },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } }
        ]
      }
    });

    if (patientOverlapping) {
      throw new Error("El paciente ya tiene una cita en ese horario.");
    }

    //Crear cita
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        startTime: start,
        endTime: end,
        status: AppointmentStatus.SCHEDULED
      }
    });

    return appointment;
  }
};

module.exports = AppointmentService;
