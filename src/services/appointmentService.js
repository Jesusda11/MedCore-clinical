const { PrismaClient, AppointmentStatus, QueueStatus} = require("../generated/prisma");
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
  getAppointments: async (filters = {}, token) => {
    const where = {};
    const timezone = "America/Bogota";

    if (filters.date) {
      const startOfDay = DateTime.fromISO(filters.date, { zone: timezone }).startOf("day").toJSDate();
      const endOfDay = DateTime.fromISO(filters.date, { zone: timezone }).endOf("day").toJSDate();
      where.startTime = { gte: startOfDay, lte: endOfDay };
    } else if (filters.startDate && filters.endDate) {
      where.startTime = {
        gte: DateTime.fromISO(filters.startDate, { zone: timezone }).startOf("day").toJSDate(),
        lte: DateTime.fromISO(filters.endDate, { zone: timezone }).endOf("day").toJSDate()
      };
    } else if (filters.startTime && filters.endTime) {
      where.startTime = {
        gte: DateTime.fromISO(filters.startTime, { zone: timezone }).toJSDate(),
        lte: DateTime.fromISO(filters.endTime, { zone: timezone }).toJSDate()
      };
    } else if (filters.startTime) {
      where.startTime = DateTime.fromISO(filters.startTime, { zone: timezone }).toJSDate();
    }

    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "asc" }
    });

    if (appointments.length === 0) return [];

    const doctorIds = [...new Set(appointments.map(a => a.doctorId).filter(Boolean))];
    const patientIds = [...new Set(appointments.map(a => a.patientId).filter(Boolean))];

    const headerToken = token || process.env.SECURITY_SERVICE_TOKEN;
    const axiosConfig = {
      headers: headerToken ? { Authorization: `Bearer ${headerToken}` } : {}
    };

    const doctorPromises = doctorIds.map(id =>
      axios
        .get(`${process.env.SECURITY_MS_URL}/users/doctors/${id}`, axiosConfig)
        .then(r => {
          const d = r.data;
          return {
            name: d.fullname,
            specialization: d.especializacion
          };
        })
        .catch(err => {
          console.warn(`No se pudo obtener doctor ${id}: ${err.message}`);
          return null;
        })
    );

    const patientPromises = patientIds.map(id =>
      axios
        .get(`${process.env.SECURITY_MS_URL}/users/patients/${id}`, axiosConfig)
        .then(r => {
          const p = r.data;
          return {
            name: p.fullname,
            identification: p.identificacion
          };
        })
        .catch(err => {
          console.warn(`No se pudo obtener paciente ${id}: ${err.message}`);
          return null;
        })
    );

    const [doctorResults, patientResults] = await Promise.all([
      Promise.allSettled(doctorPromises),
      Promise.allSettled(patientPromises)
    ]);

    const doctorsMap = {};
    doctorResults.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value)
        doctorsMap[r.value.id || doctorIds[idx]] = r.value;
    });

    const patientsMap = {};
    patientResults.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value)
        patientsMap[r.value.id || patientIds[idx]] = r.value;
    });

    return appointments.map(a => ({
      ...a,
      doctor: doctorsMap[a.doctorId] || null,
      patient: patientsMap[a.patientId] || null
    }));
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

  const now = new Date();
  const apptTime = new Date(appointment.startTime);

  const diffMinutes = (apptTime - now) / 60000;

  if (diffMinutes < 10) {
    throw new Error("Solo puedes confirmar una cita con al menos 10 minutos de anticipación.");
  }

  if (diffMinutes > 24 * 60) {
    throw new Error("Solo puedes confirmar citas dentro de las próximas 24 horas.");
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

markNoShow: async (appointmentId) => {
  if (!appointmentId) {
    throw new Error("El ID de la cita es obligatorio.");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId }
  });

  if (!appointment) {
    throw new Error("Cita no encontrada.");
  }

  const ticket = await prisma.queue.findFirst({
    where: { appointmentId }
  });

  if (!ticket) {
    throw new Error("No existe un ticket en cola asociado a esta cita.");
  }

  if (ticket.status !== QueueStatus.CALLED) {
    throw new Error(
      "Solo se puede marcar como NO-SHOW cuando el ticket está en estado CALLED."
    );
  }

  await prisma.queue.update({
    where: { id: ticket.id },
    data: {
      status: QueueStatus.CANCELLED,
      updatedAt: new Date()
    }
  });

  const updatedAppointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.NO_SHOW
    }
  });

  return updatedAppointment;
}

};

module.exports = AppointmentService;