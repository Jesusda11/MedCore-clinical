const express = require("express");
const router = express.Router();
const { createAppointment } = require("../controllers/appointmentController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/create", createAppointment);

module.exports = router;

