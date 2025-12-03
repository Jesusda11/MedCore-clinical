const cron = require("node-cron");
const { PrismaClient, AppointmentStatus } = require("../generated/prisma");
const QueueService = require("../services/queueService");
const prisma = new PrismaClient();

/**
 * Finds appointments starting in <= 5 minutes
 * and automatically joins the queue if confirmed.
 */

 //"*/1 * * * * " run every minute for testing

  cron.schedule("0 0,30 * * * *", async () => {
  console.log("[Job] Revisión de citas próximas...");

  const now = new Date();
  const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60000);

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        startTime: {
          gte: now,
          lte: threeHoursLater
        }
      },
      orderBy: { startTime: "asc" }
    });

    if (appointments.length === 0) {
      console.log("[Job] No hay citas próximas para auto-check-in.");
      return;
    }

    for (const appt of appointments) {
      try {
        const exists = await prisma.queue.findFirst({
          where: { appointmentId: appt.id }
        });

        if (exists) continue;

        await QueueService.join(appt.id);
        console.log(`Paciente agregado a cola para cita ${appt.id}`);
      } catch (err) {
        console.error(`Error procesando cita ${appt.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error("[Job] Error general:", err);
  }
});
