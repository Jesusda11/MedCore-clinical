const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

const AppointmentService = {
  create: async (data) => {
    return await prisma.appointment.create({ data });
  },
};

module.exports = AppointmentService;
