const { PrismaClient, AppointmentStatus} = require("../generated/prisma");
const prisma = new PrismaClient();
const { DateTime } = require('luxon');

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
}
};

module.exports = AppointmentService;