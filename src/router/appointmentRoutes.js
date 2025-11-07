const express = require("express");
const router = express.Router();
const { createAppointment, updateAppointment } = require("../controllers/appointmentController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/create", createAppointment);
router.put("/update/:id", updateAppointment);

module.exports = router;

