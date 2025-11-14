const express = require("express");
const router = express.Router();
const { 
    createAppointment, 
    updateAppointment,
    cancelAppointment,
    getAppointments,
    getAppointmentsBySpecialty,
    getAppointmentsByPatientId,
    updateDoctor,
    confirmAppointment
 } = require("../controllers/appointmentController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/create", createAppointment);
router.put("/update/:id", updateAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.get("/by-specialty", getAppointmentsBySpecialty);
router.get("/filter", getAppointments);
router.get("/by-patient/:patientId", getAppointmentsByPatientId);
router.put("/:id/update-doctor", updateDoctor);
router.post("/:id/confirm", confirmAppointment);

module.exports = router;

