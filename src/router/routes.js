const express = require("express");
const appointmentRoutes = require("./appointmentRoutes");
const { auditInterceptor } = require("../interceptors/auditInterceptor");

const router = express.Router();

router.use(auditInterceptor);

router.use("/appointments", appointmentRoutes);
module.exports = router;

