const express = require("express");
const appointmentRoutes = require("./appointmentRoutes");
const queueRoutes = require("./queueRoutes");
const { auditInterceptor } = require("../interceptors/auditInterceptor");

const router = express.Router();

router.use(auditInterceptor);

router.use("/appointments", appointmentRoutes);
router.use("/queue", queueRoutes);
module.exports = router;

