const express = require("express");
const router = express.Router();
const { 
    createAppointment, 
    updateAppointment,
    cancelAppointment,
    getAppointments
 } = require("../controllers/appointmentController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/create", createAppointment);
router.put("/update/:id", updateAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.get("/filter", getAppointments);

module.exports = router;

