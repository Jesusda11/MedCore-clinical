const express = require("express");
const appointmentRoutes = require("./appointmentRoutes");
const queueRoutes = require("./queueRoutes");

const router = express.Router();

router.use("/appointments", appointmentRoutes)
router.use("/queue", queueRoutes)
module.exports = router