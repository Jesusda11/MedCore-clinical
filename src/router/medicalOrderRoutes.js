/**
 * @swagger
 * tags:
 *   name: Medical Orders
 *   description: Gestión de órdenes médicas (laboratorio y radiología)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MedicalOrder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         patientId:
 *           type: string
 *         doctorId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [LABORATORY, RADIOLOGY]
 *         examType:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

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
