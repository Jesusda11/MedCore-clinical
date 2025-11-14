const { PrismaClient, AppointmentStatus} = require("../generated/prisma");
const axios = require("axios");
const prisma = new PrismaClient();
const { DateTime } = require('luxon');

const SECURITY_MS_URL = process.env.SECURITY_MS_URL;

const {
  getDoctorData,
  getPatientData,
  validateScheduleConflict
} = require("./validations/appointmentValidations");

const AppointmentService = {
  create: async ({ patientId, doctorId, startTime, token }) => {
    const start = new Date(startTime);
    if (isNaN(start)) throw new Error("Fecha inválida.");
    if (start < new Date()) throw new Error("Fecha no puede ser en el pasado.");

    const end = new Date(start.getTime() + 30 * 60000);

    await getDoctorData(doctorId, token);
    await getPatientData(patientId, token);

    await validateScheduleConflict({ doctorId, patientId, start, end });

    return prisma.appointment.create({
      data: { patientId, doctorId, startTime: start, endTime: end }
    });
  },

  update: async (id, data, token) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new Error("Cita no encontrada.");

    const updatePayload = {};

    if (data.doctorId) {
      await getDoctorData(data.doctorId, token);
      updatePayload.doctorId = data.doctorId;
    }

    if (data.patientId) {
      await getPatientData(data.patientId, token);
      updatePayload.patientId = data.patientId;
    }

    if (data.startTime) {
      const start = new Date(data.startTime);
      if (isNaN(start)) throw new Error("Fecha inválida.");
      if (start < new Date()) throw new Error("Fecha en el pasado.");

      const end = new Date(start.getTime() + 30 * 60000);

      await validateScheduleConflict({
        doctorId: data.doctorId || appointment.doctorId,
        patientId: data.patientId || appointment.patientId,
        start,
        end,
        ignoreId: id
      });

      updatePayload.startTime = start;
      updatePayload.endTime = end;
    } else if (data.doctorId || data.patientId) {
      await validateScheduleConflict({
        doctorId: data.doctorId || appointment.doctorId,
        patientId: data.patientId || appointment.patientId,
        start: appointment.startTime,
        end: appointment.endTime,
        ignoreId: id
      });
    }

    if (data.status) updatePayload.status = data.status;

    return prisma.appointment.update({ where: { id }, data: updatePayload });
  },

  cancel: async (id) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    
    if (!appointment) {
      throw new Error("Cita no encontrada.");
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new Error("La cita ya está cancelada.");
    }

    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED }
    });
  },

 /**
   * Retrieves appointments based on various filters including date, time range,
   * doctor, patient, and status.
   */
 getAppointments: async (filters = {}) => {
  const where = {};
  const timezone = 'America/Bogota';

  if (filters.date) {
    const startOfDay = DateTime.fromISO(filters.date, { zone: timezone })
      .startOf('day')
      .toJSDate();
    
    const endOfDay = DateTime.fromISO(filters.date, { zone: timezone })
      .endOf('day')
      .toJSDate();

    where.startTime = {
      gte: startOfDay,
      lte: endOfDay
    };
  }
  else if (filters.startDate && filters.endDate) {
    where.startTime = {
      gte: DateTime.fromISO(filters.startDate, { zone: timezone })
        .startOf('day')
        .toJSDate(),
      lte: DateTime.fromISO(filters.endDate, { zone: timezone })
        .endOf('day')
        .toJSDate()
    };
  }
  else if (filters.startTime && filters.endTime) {
    where.startTime = {
      gte: DateTime.fromISO(filters.startTime, { zone: timezone }).toJSDate(),
      lte: DateTime.fromISO(filters.endTime, { zone: timezone }).toJSDate()
    };
  }
  else if (filters.startTime) {
    where.startTime = DateTime.fromISO(filters.startTime, { zone: timezone }).toJSDate();
  }

  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.status) where.status = filters.status;

  return prisma.appointment.findMany({
    where,
    orderBy: { startTime: 'asc' }
  });
},

/**
 * Fetches appointments for all doctors associated with a specific specialty.
 * It queries the SECURITY microservice to retrieve doctor IDs, then
 * returns all appointments in the clinical system that belong to those doctors.
 */
getAppointmentsBySpecialty: async (specialty, token) => {
    if (!specialty) throw new Error("El parámetro 'specialty' es obligatorio");

   const { data } = await axios.get(
    `${SECURITY_MS_URL}/users/doctors/by-specialty?specialty=${encodeURIComponent(specialty)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const doctors = data.doctors || [];

  if (doctors.length === 0) {
    return [];
  }

  const doctorIds = doctors.map((d) => d.id);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: { in: doctorIds },
    },
    orderBy: { startTime: "asc" },
  });

  return appointments;
},

/**
 * Retrieves all appointments associated with a specific patient.
 */
getAppointmentsByPatientId: async (patientId) => {
  if (!patientId) {
    throw new Error("El ID del paciente es obligatorio.");
  }

  const appointments = await prisma.appointment.findMany({
    where: { patientId },
    orderBy: { startTime: 'asc' }
  });

  return appointments;
},

handleDoctorInactive: async (doctorId, token) => {
  if (!doctorId) throw new Error("El ID del doctor es obligatorio.");

  const { data: doctorData } = await axios.get(`${SECURITY_MS_URL}/users/doctors/${doctorId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const specialty = doctorData.especializacion;
  if (!specialty) throw new Error("El doctor no tiene especialidad asignada.");

  const { data: sameSpecialtyDoctors } = await axios.get(
    `${SECURITY_MS_URL}/users/doctors/by-specialty?specialty=${encodeURIComponent(specialty)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const availableDoctors = (sameSpecialtyDoctors.doctors || []).filter(d => d.status === "ACTIVE" && d.id !== doctorId);

  if (availableDoctors.length === 0) {
    console.warn(`No hay doctores disponibles en la especialidad ${specialty}`);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
  });

  const results = [];

  for (const appt of appointments) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "CANCELLED" },
    });

    let reassigned = null;

    for (const newDoctor of availableDoctors) {
      try {
        await validateScheduleConflict({
          doctorId: newDoctor.id,
          patientId: appt.patientId,
          start: appt.startTime,
          end: appt.endTime,
        });

        reassigned = await prisma.appointment.create({
          data: {
            patientId: appt.patientId,
            doctorId: newDoctor.id,
            startTime: appt.startTime,
            endTime: appt.endTime,
            status: "SCHEDULED",
          },
        });
        
        if (reassigned) {
        console.log(`Cita ${appt.id} reasignada a doctor ${reassigned.doctorId}`);
        } else {
        console.log(`Cita ${appt.id} no pudo ser reasignada`);
      }
        break;
      } catch {
        continue;
      }
    }

    results.push({
      oldAppointmentId: appt.id,
      reassigned: reassigned ? true : false,
      newDoctorId: reassigned?.doctorId || null,
    });
  }

  return results;
},

confirm: async (appointmentId, token) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId }
  });

  if (!appointment) {
    throw new Error("Cita no encontrada.");
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw new Error("No puedes confirmar una cita cancelada.");
  }

  if (
    appointment.status === AppointmentStatus.COMPLETED ||
    appointment.status === AppointmentStatus.IN_PROGRESS
  ) {
    throw new Error("No puedes confirmar esta cita.");
  }

  if (appointment.status === AppointmentStatus.CONFIRMED) {
    return appointment; 
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CONFIRMED
    }
  });
},

};

module.exports = AppointmentService;