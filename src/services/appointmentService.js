const { PrismaClient} = require("../generated/prisma");
const prisma = new PrismaClient();

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
  }
};

module.exports = AppointmentService;