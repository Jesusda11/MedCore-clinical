const express = require("express");
const router = express.Router();
const {
  joinQueue,
  getCurrentQueueByDoctor,
  callNextPatient,
  updatePausedStatus,
  completeTicket,
  getTicketPosition,
} = require("../controllers/queueController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/join", joinQueue);
router.get("/doctor/:doctorId/current", getCurrentQueueByDoctor);
router.post("/call-next", callNextPatient);
router.put("/doctor/:doctorId/pause", updatePausedStatus);
router.put("/ticket/:ticketId/complete", completeTicket);
router.get("/ticket/:ticketId/position", getTicketPosition);

module.exports = router;

