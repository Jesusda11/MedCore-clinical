const cron = require("node-cron");
const { PrismaClient, AppointmentStatus, QueueStatus } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * Job to mark appointments as NO_SHOW when patients do not
 * confirm at least 10 minutes before the scheduled time.
 */
const autoCancelNoShowAppointments = async () => {
  try {
    const now = new Date();

    const expiredAppointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        startTime: {
          lt: new Date(now.getTime() + 10 * 60 * 1000)
        }
      }
    });

    for (const appointment of expiredAppointments) {
      const queueEntry = await prisma.queue.findFirst({
        where: {
          appointmentId: appointment.id,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS] }
        }
      });

      if (!queueEntry) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.NO_SHOW }
        });

      console.log(`No-Show: El paciente no se presentó para la cita ${appointment.id}.`);
      }
    }
  } catch (error) {
    console.error("Error en autoCancelNoShowAppointments:", error);
  }
};

cron.schedule("*/1 * * * *", () => {
  console.log("Ejecutando auto-cancelación de citas...");
  autoCancelNoShowAppointments();
});
