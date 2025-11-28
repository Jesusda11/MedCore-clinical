const express = require("express");
const appointmentRoutes = require("./appointmentRoutes");
const queueRoutes = require("./queueRoutes");
const medicalOrderRoutes = require("./medicalOrderRoutes");
const { auditInterceptor } = require("../interceptors/auditInterceptor");

const router = express.Router();

router.use(auditInterceptor);

router.use("/appointments", appointmentRoutes);
router.use("/queue", queueRoutes);
router.use("/medical-orders", medicalOrderRoutes);

module.exports = router;

