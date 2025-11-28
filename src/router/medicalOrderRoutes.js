const express = require("express");
const router = express.Router();
const {
    createLaboratoryOrder,
    createRadiologyOrder,
    getOrdersByPatient,
    getOrderById,
    getOrders
} = require("../controllers/medicalOrderController")

const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);
router.post("/laboratory", createLaboratoryOrder)
router.post("/radiology", createRadiologyOrder)
router.get("/patient/:patientId", getOrdersByPatient)
router.get("/:id", getOrderById)
router.get("/", getOrders)


module.exports = router;
