const AppointmentService = require("../services/appointmentService");

const createAppointment = async (req, res) => {
  try {
    const appointment = await AppointmentService.create(req.body);
    res.status(201).json(appointment);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error creating appointment" });
  }
};

module.exports = { createAppointment };
