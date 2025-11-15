const cron = require("node-cron");
const { PrismaClient, AppointmentStatus } = require("../generated/prisma");
const { sendAppointmentReminderEmail } = require("../config/emailConfig");
const { DateTime } = require("luxon");
const axios = require("axios");

const prisma = new PrismaClient();
const TIMEZONE = "America/Bogota";
const SECURITY_MS_URL = process.env.SECURITY_MS_URL;
const HEADER_TOKEN = process.env.SECURITY_SERVICE_TOKEN;

/**
 * Job to send 24-hour reminder emails for scheduled appointments.
 */
const send24hReminder = async () => {
  try {
    const now = DateTime.now().setZone(TIMEZONE);
    const targetTime = now.plus({ hours: 24 });

    const startRange = targetTime.minus({ minutes: 3 }).toJSDate();
    const endRange = targetTime.plus({ minutes: 3 }).toJSDate();

    const appointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        reminder24hSent: false,
        startTime: {
          gte: startRange,
          lte: endRange,
        },
      },
      select: {
        id: true,
        startTime: true,
        patientId: true,
        doctorId: true,
      },
    });

    if (appointments.length === 0) {
      console.log("No hay citas para enviar recordatorio de 24h.");
      return;
    }

    console.log(`Encontradas ${appointments.length} citas para recordatorio 24h.`);

    const doctorIds = [...new Set(appointments.map(a => a.doctorId))];
    const patientIds = [...new Set(appointments.map(a => a.patientId))];

    const axiosConfig = HEADER_TOKEN
      ? { headers: { Authorization: `Bearer ${HEADER_TOKEN}` } }
      : {};

    const [doctorsRes, patientsRes] = await Promise.all([
      Promise.all(
        doctorIds.map(id =>
          axios
            .get(`${SECURITY_MS_URL}/users/doctors/${id}`, axiosConfig)
            .then(r => ({ id, ...r.data }))
            .catch(() => null)
        )
      ),
      Promise.all(
        patientIds.map(id =>
          axios
            .get(`${SECURITY_MS_URL}/users/patients/${id}`, axiosConfig)
            .then(r => ({ id, ...r.data }))
            .catch(() => null)
        )
      ),
    ]);

    const doctorsMap = Object.fromEntries(
      doctorsRes.filter(Boolean).map(d => [d.id, d])
    );
    const patientsMap = Object.fromEntries(
      patientsRes.filter(Boolean).map(p => [p.id, p])
    );

    for (const appt of appointments) {
      const patient = patientsMap[appt.patientId];
      const doctor = doctorsMap[appt.doctorId];

      if (!patient?.email || !doctor?.fullname) {
        console.warn(`Faltan datos para cita ${appt.id}`);
        continue;
      }

      const fecha = DateTime.fromJSDate(appt.startTime)
        .setZone(TIMEZONE)
        .toLocaleString(DateTime.DATETIME_FULL);

      const result = await sendAppointmentReminderEmail(
        patient.email,
        patient.fullname,
        doctor.fullname,
        fecha,
        "24h"
      );

      if (result.success) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminder24hSent: true },
        });
        console.log(`Recordatorio 24h enviado a ${patient.email} (cita ${appt.id})`);
      } else {
        console.error(`Error enviando recordatorio a ${patient.email}:`, result.error);
      }
    }
  } catch (error) {
    console.error("Error en send24hReminder:", error);
  }
};

// Cambia a "*/1 * * * *" para pruebas cada minuto
cron.schedule("0 * * * *", () => {
  console.log("Ejecutando envío de recordatorios 24h...");
  send24hReminder();
});
