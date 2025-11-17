const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true", 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendAppointmentConfirmationEmail = async (email, fullname, doctorName, date) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: "Confirmación de Cita Médica",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #4CAF50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Cita Confirmada</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Hola ${fullname},</h2>
          <p style="color: #555; line-height: 1.6;">
            Tu cita médica con el doctor <strong>${doctorName}</strong> ha sido confirmada exitosamente.
          </p>
          <p style="color: #555;">
            <strong>Fecha y hora:</strong> ${date}
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Error enviando correo:", error);
    return { success: false, error: error.message };
  }
};

const sendAppointmentReminderEmail = async (email, fullname, doctorName, date) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: "Recordatorio de Cita Médica",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="background: #2196F3; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Recordatorio de Cita Médica</h1>
        </div>

        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Hola <strong>${fullname}</strong>,
          </p>

          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            Este es un recordatorio de tu cita médica con el doctor <strong>${doctorName}</strong>.
          </p>

          <p style="color: #333; font-weight: bold; margin: 20px 0;">
            Fecha y hora: ${date}
          </p>

          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">

          <p style="color: #444; line-height: 1.6; margin-top: 20px; font-size: 15px;">
            Recuerda confirmar tu cita.<br>
            Por favor llega <strong>20 minutos antes</strong> para tu registro.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error("Error enviando recordatorio 24h:", err);
    return { success: false, error: err.message };
  }
};

const sendAppointmentCancellationEmail = async (email, fullname, doctorName, date) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: "Cancelación de Cita Médica",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #e53935; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Cita Cancelada</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Hola ${fullname},</h2>
          <p style="color: #555; line-height: 1.6;">
            Tu cita médica con el doctor <strong>${doctorName}</strong> programada para:
          </p>
          <p style="color: #333; font-size: 16px; font-weight: bold;">
            ${date}
          </p>
          <p style="color: #555;">Ha sido cancelada.</p>
          <p style="color: #555;">Si necesitas reprogramarla, no dudes en comunicarte con nosotros.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Correo de cancelación enviado a:", email);
  } catch (error) {
    console.error("Error enviando correo de cancelación:", error);
  }
};

module.exports = {
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendAppointmentCancellationEmail
};
