const MedicalOrderService = require("../services/medicalOrderService");

const MedicalOrderController = {
  
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