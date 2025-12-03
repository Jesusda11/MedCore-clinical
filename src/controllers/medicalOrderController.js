const MedicalOrderService = require("../services/medicalOrderService");

const MedicalOrderController = {

  /**
   * @swagger
   * /medical-orders/laboratory:
   *   post:
   *     summary: Crear una orden de laboratorio
   *     tags: [Medical Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [patientId, doctorId, examType]
   *             properties:
   *               patientId:
   *                 type: string
   *               doctorId:
   *                 type: string
   *               examType:
   *                 type: string
   *     responses:
   *       201:
   *         description: Orden creada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/MedicalOrder"
   *       400:
   *         description: Error en datos enviados
   */
  createLaboratoryOrder: async (req, res) => {
    try {
      const { patientId, doctorId, examType } = req.body;
      const token = req.headers.authorization?.split(" ")[1];

      if (!patientId || !doctorId || !examType) {
        return res.status(400).json({
          error: "patientId, doctorId y examType son obligatorios."
        });
      }

      const order = await MedicalOrderService.create({
        patientId,
        doctorId,
        type: "LABORATORY",
        examType,
        token
      });

      return res.status(201).json(order);
    } catch (err) {
      console.error("Error al crear orden de laboratorio:", err);
      return res.status(400).json({ error: err.message });
    }
  },

  /**
   * @swagger
   * /medical-orders/radiology:
   *   post:
   *     summary: Crear una orden de radiología
   *     tags: [Medical Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [patientId, doctorId, examType]
   *             properties:
   *               patientId:
   *                 type: string
   *               doctorId:
   *                 type: string
   *               examType:
   *                 type: string
   *     responses:
   *       201:
   *         description: Orden creada
   *       400:
   *         description: Error en datos enviados
   */
  createRadiologyOrder: async (req, res) => {
    try {
      const { patientId, doctorId, examType } = req.body;
      const token = req.headers.authorization?.split(" ")[1];

      if (!patientId || !doctorId || !examType) {
        return res.status(400).json({
          error: "patientId, doctorId y examType son obligatorios."
        });
      }

      const order = await MedicalOrderService.create({
        patientId,
        doctorId,
        type: "RADIOLOGY",
        examType,
        token
      });

      return res.status(201).json(order);
    } catch (err) {
      console.error("Error al crear orden de radiología:", err);
      return res.status(400).json({ error: err.message });
    }
  },

  /**
 * @swagger
 * /medical-orders/{id}:
 *   get:
 *     summary: Obtener orden por ID
 *     tags: [Medical Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orden encontrada
 *       404:
 *         description: Orden no encontrada
 */
  getOrderById: async (req, res) => {
    try {
      const { id } = req.params;
      const token = req.headers.authorization?.split(" ")[1];

      const order = await MedicalOrderService.getById(id, token);

      return res.status(200).json(order);
    } catch (err) {
      console.error("Error al obtener orden:", err);
      
      if (err.message === "Orden médica no encontrada.") {
        return res.status(404).json({ error: err.message });
      }
      
      return res.status(400).json({ error: err.message });
    }
  },

  /**
 * @swagger
 * /medical-orders/patient/{patientId}:
 *   get:
 *     summary: Obtener todas las órdenes de un paciente
 *     tags: [Medical Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de órdenes del paciente
 */
  getOrdersByPatient: async (req, res) => {
    try {
      const { patientId } = req.params;
      const token = req.headers.authorization?.split(" ")[1];

      const orders = await MedicalOrderService.getByPatientId(patientId, token);

      return res.status(200).json(orders);
    } catch (err) {
      console.error("Error al obtener órdenes del paciente:", err);
      return res.status(400).json({ error: err.message });
    }
  },

  /**
 * @swagger
 * /medical-orders/{id}/complete:
 *   put:
 *     summary: Completar una orden médica
 *     tags: [Medical Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orden completada
 *       404:
 *         description: Orden no encontrada
 */
  completeOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const token = req.headers.authorization?.split(" ")[1];

      const order = await MedicalOrderService.complete(id, token);

      return res.status(200).json(order);
    } catch (err) {
      console.error("Error al completar orden:", err);
      
      if (err.message === "Orden médica no encontrada.") {
        return res.status(404).json({ error: err.message });
      }
      
      return res.status(400).json({ error: err.message });
    }
  },

  /**
 * @swagger
 * /medical-orders/{id}/cancel:
 *   put:
 *     summary: Cancelar una orden médica
 *     tags: [Medical Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orden cancelada
 *       404:
 *         description: Orden no encontrada
 */
  cancelOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const token = req.headers.authorization?.split(" ")[1];

      const order = await MedicalOrderService.cancel(id, token);

      return res.status(200).json(order);
    } catch (err) {
      console.error("Error al cancelar orden:", err);
      
      if (err.message === "Orden médica no encontrada.") {
        return res.status(404).json({ error: err.message });
      }
      
      return res.status(400).json({ error: err.message });
    }
  },

  /**
 * @swagger
 * /medical-orders:
 *   get:
 *     summary: Listar órdenes con filtros opcionales
 *     tags: [Medical Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LABORATORY, RADIOLOGY]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELED]
 *     responses:
 *       200:
 *         description: Listado de órdenes
 */
  getOrders: async (req, res) => {
    try {
      const filters = {
        patientId: req.query.patientId,
        doctorId: req.query.doctorId,
        type: req.query.type,
        status: req.query.status
      };

      const token = req.headers.authorization?.split(" ")[1];

      const orders = await MedicalOrderService.getOrders(filters, token);

      return res.status(200).json(orders);
    } catch (err) {
      console.error("Error al obtener órdenes:", err);
      return res.status(400).json({ error: err.message });
    }
  }
};

module.exports = MedicalOrderController;