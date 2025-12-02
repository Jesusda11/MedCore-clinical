const { PrismaClient, OrderStatus } = require("../generated/prisma");
const axios = require("axios");
const prisma = new PrismaClient();

const SECURITY_MS_URL = process.env.SECURITY_MS_URL;

const {
  getDoctorData,
  getPatientData,
  validateExamType,
  validateOrderType,
  validateOrderStatus, 
  validateDuplicateOrder
} = require("./validations/medicalOrderValidations");

const MedicalOrderService = {
  /**
   * Crea una nueva orden médica (laboratorio o radiología)
   */
  create: async ({ patientId, doctorId, type, examType, token }) => {
    validateOrderType(type);
    validateExamType(type, examType);

    await getDoctorData(doctorId, token);
    await getPatientData(patientId, token);
    await validateDuplicateOrder(prisma, { patientId, type, examType });

    return prisma.medicalOrder.create({
      data: {
        patientId,
        doctorId,
        type,
        examType,
        status: OrderStatus.PENDING
      }
    });
  },

  /**
   * Obtiene una orden médica por ID
   */
  getById: async (id, token) => {
    if (!id) {
      throw new Error("El ID de la orden es obligatorio.");
    }

    const order = await prisma.medicalOrder.findUnique({
      where: { id }
    });

    if (!order) {
      throw new Error("Orden médica no encontrada.");
    }

    const headerToken = token || process.env.SECURITY_SERVICE_TOKEN;
    const axiosConfig = {
      headers: headerToken ? { Authorization: `Bearer ${headerToken}` } : {}
    };

    try {
      const [doctorRes, patientRes] = await Promise.allSettled([
        axios.get(
          `${SECURITY_MS_URL}/users/doctors/${order.doctorId}`,
          axiosConfig
        ),
        axios.get(
          `${SECURITY_MS_URL}/users/patients/${order.patientId}`,
          axiosConfig
        )
      ]);

      const doctor = doctorRes.status === "fulfilled" 
        ? {
            name: doctorRes.value.data.fullname,
            specialization: doctorRes.value.data.especializacion
          }
        : null;

      const patient = patientRes.status === "fulfilled"
        ? {
            name: patientRes.value.data.fullname,
            identification: patientRes.value.data.identificacion
          }
        : null;

      return {
        ...order,
        doctor,
        patient
      };
    } catch (err) {
      console.warn("Error al enriquecer orden:", err.message);
      return order;
    }
  },

  /**
   * Obtiene todas las órdenes de un paciente específico
   */
  getByPatientId: async (patientId, token) => {
    if (!patientId) {
      throw new Error("El ID del paciente es obligatorio.");
    }

    const orders = await prisma.medicalOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" }
    });

    if (orders.length === 0) {
      return [];
    }

    // Enriquecer con datos del doctor
    const headerToken = token || process.env.SECURITY_SERVICE_TOKEN;
    const axiosConfig = {
      headers: headerToken ? { Authorization: `Bearer ${headerToken}` } : {}
    };

    const doctorIds = [...new Set(orders.map(o => o.doctorId))];

    const doctorPromises = doctorIds.map(id =>
      axios
        .get(`${SECURITY_MS_URL}/users/doctors/${id}`, axiosConfig)
        .then(r => ({
          id,
          name: r.data.fullname,
          specialization: r.data.especializacion
        }))
        .catch(err => {
          console.warn(`No se pudo obtener doctor ${id}: ${err.message}`);
          return { id, name: null, specialization: null };
        })
    );

    const doctorResults = await Promise.allSettled(doctorPromises);

    const doctorsMap = {};
    doctorResults.forEach(r => {
      if (r.status === "fulfilled" && r.value) {
        doctorsMap[r.value.id] = {
          name: r.value.name,
          specialization: r.value.specialization
        };
      }
    });

    return orders.map(order => ({
      ...order,
      doctor: doctorsMap[order.doctorId] || null
    }));
  },

  /**
   * Actualiza el estado de una orden médica
   */
  updateStatus: async (id, status, token) => {
    if (!id) {
      throw new Error("El ID de la orden es obligatorio.");
    }

    validateOrderStatus(status);

    const order = await prisma.medicalOrder.findUnique({
      where: { id }
    });

    if (!order) {
      throw new Error("Orden médica no encontrada.");
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error("No se puede modificar una orden cancelada.");
    }

    if (order.status === OrderStatus.COMPLETED && status === OrderStatus.PENDING) {
      throw new Error("No se puede cambiar una orden completada a pendiente.");
    }

    return prisma.medicalOrder.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Cancela una orden médica
   */
  cancel: async (id, token) => {
    if (!id) {
      throw new Error("El ID de la orden es obligatorio.");
    }

    const order = await prisma.medicalOrder.findUnique({
      where: { id }
    });

    if (!order) {
      throw new Error("Orden médica no encontrada.");
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error("La orden ya está cancelada.");
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new Error("No se puede cancelar una orden completada.");
    }

    return prisma.medicalOrder.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Completa una orden médica
   */
  complete: async (id, token) => {
    if (!id) {
      throw new Error("El ID de la orden es obligatorio.");
    }

    const order = await prisma.medicalOrder.findUnique({
      where: { id }
    });

    if (!order) {
      throw new Error("Orden médica no encontrada.");
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error("No se puede completar una orden cancelada.");
    }

    if (order.status === OrderStatus.COMPLETED) {
      return order; // Ya está completada
    }

    return prisma.medicalOrder.update({
      where: { id },
      data: {
        status: OrderStatus.COMPLETED,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Obtiene órdenes con filtros opcionales
   */
  getOrders: async (filters = {}, token) => {
    const where = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.type) {
      validateOrderType(filters.type);
      where.type = filters.type;
    }
    if (filters.status) {
      validateOrderStatus(filters.status);
      where.status = filters.status;
    }

    const orders = await prisma.medicalOrder.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    if (orders.length === 0) {
      return [];
    }

    const headerToken = token || process.env.SECURITY_SERVICE_TOKEN;
    const axiosConfig = {
      headers: headerToken ? { Authorization: `Bearer ${headerToken}` } : {}
    };

    const doctorIds = [...new Set(orders.map(o => o.doctorId))];
    const patientIds = [...new Set(orders.map(o => o.patientId))];

    const doctorPromises = doctorIds.map(id =>
      axios
        .get(`${SECURITY_MS_URL}/users/doctors/${id}`, axiosConfig)
        .then(r => ({
          id,
          name: r.data.fullname,
          specialization: r.data.especializacion
        }))
        .catch(err => {
          console.warn(`No se pudo obtener doctor ${id}: ${err.message}`);
          return null;
        })
    );

    const patientPromises = patientIds.map(id =>
      axios
        .get(`${SECURITY_MS_URL}/users/patients/${id}`, axiosConfig)
        .then(r => ({
          id,
          name: r.data.fullname,
          identification: r.data.identificacion
        }))
        .catch(err => {
          console.warn(`No se pudo obtener paciente ${id}: ${err.message}`);
          return null;
        })
    );

    const [doctorResults, patientResults] = await Promise.all([
      Promise.allSettled(doctorPromises),
      Promise.allSettled(patientPromises)
    ]);

    const doctorsMap = {};
    doctorResults.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value) {
        doctorsMap[r.value.id] = {
          name: r.value.name,
          specialization: r.value.specialization
        };
      }
    });

    const patientsMap = {};
    patientResults.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value) {
        patientsMap[r.value.id] = {
          name: r.value.name,
          identification: r.value.identification
        };
      }
    });

    return orders.map(order => ({
      ...order,
      doctor: doctorsMap[order.doctorId] || null,
      patient: patientsMap[order.patientId] || null
    }));
  }
  
};

module.exports = MedicalOrderService;