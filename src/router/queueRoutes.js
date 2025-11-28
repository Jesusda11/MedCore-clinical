const express = require("express");
const router = express.Router();
const { 
    joinQueue,
    getCurrentQueueByDoctor,
    callNextPatient,
    completeTicket,
    getTicketPosition,
    getPatientStatus,
    getCurrentPatient,
    startAppointment,
    getDoctorHistory
 } = require("../controllers/queueController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware)
router.post("/join",joinQueue);
router.get("/doctor/:doctorId/current", getCurrentQueueByDoctor);
router.post("/call-next", callNextPatient);
router.post("/doctor/:doctorId/appointment/:appointmentId/start", startAppointment);
router.put("/ticket/:ticketId/complete", completeTicket);
router.get("/ticket/:ticketId/position", getTicketPosition);
router.get("/patient/:patientId/status", getPatientStatus);
router.get("/doctor/:doctorId/current-patient", getCurrentPatient); 
router.get("/doctor/:doctorId/history", getDoctorHistory);

module.exports = router;