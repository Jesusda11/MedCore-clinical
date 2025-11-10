const { DateTime } = require('luxon');

const TIMEZONE = 'America/Bogota';

module.exports = {
  /** Convierte un string ISO (local) a UTC (Date) para guardar en DB */
  toUTC: (isoString) => 
    DateTime.fromISO(isoString, { zone: TIMEZONE })
      .toUTC()
      .toJSDate(),

  /** Convierte una fecha (UTC) desde DB a hora local en formato ISO */
  toLocal: (date) => 
    DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(TIMEZONE)
      .toISO({ includeOffset: true }),

  /** Convierte todas las fechas de un objeto cita */
  formatAppointmentDates: (appointment) => ({
    ...appointment,
    startTime: appointment.startTime ? module.exports.toLocal(appointment.startTime) : null,
    endTime: appointment.endTime ? module.exports.toLocal(appointment.endTime) : null,
    createdAt: appointment.createdAt ? module.exports.toLocal(appointment.createdAt) : null,
    updatedAt: appointment.updatedAt ? module.exports.toLocal(appointment.updatedAt) : null
  })
};
