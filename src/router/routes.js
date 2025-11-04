const express = require("express");
const appointmentRoutes = require("./appointmentRoutes");

const router = express.Router();

router.use("/appointments", appointmentRoutes)
module.exports = router