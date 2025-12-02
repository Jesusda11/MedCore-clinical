const axios = require("axios");

const SECURITY_MS_URL = process.env.SECURITY_MS_URL;


const validateObjectId = (id, fieldName) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new Error(`${fieldName} inválido.`);
  }
};

/**
 * Valida que un doctor exista y esté activo
 */
const getDoctorData = async (doctorId, token) => {
  
  if (!doctorId) {
    throw new Error("El ID del doctor es obligatorio.");
  }

  validateObjectId(doctorId, "ID del doctor");

  try {
    const { data } = await axios.get(
      `${SECURITY_MS_URL}/users/doctors/${doctorId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (data.status !== "ACTIVE") {
      throw new Error("El doctor no está activo.");
    }

    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("Doctor no encontrado.");
    }
    throw new Error(err.message || "Error al validar doctor.");
  }
};

/**
 * Valida que un paciente exista y esté activo
 */
const getPatientData = async (patientId, token) => {
  if (!patientId) {
    throw new Error("El ID del paciente es obligatorio.");
  }

  validateObjectId(patientId, "ID del paciente");

  try {
    const { data } = await axios.get(
      `${SECURITY_MS_URL}/users/patients/${patientId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (data.status !== "ACTIVE") {
      throw new Error("El paciente no está activo.");
    }

    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("Paciente no encontrado.");
    }
    throw new Error(err.message || "Error al validar paciente.");
  }
};

/**
 * Valida que el tipo de examen sea válido según el tipo de orden
 */
const validateExamType = (type, examType) => {
  const validExamTypes = {
    LABORATORY: ["Hemograma", "Química sanguínea", "Orina"],
    RADIOLOGY: ["Rayos X", "TAC", "Resonancia", "Ecografía"]
  };

  if (!examType || examType.trim() === "") {
    throw new Error("El tipo de examen es obligatorio.");
  }

  const validTypes = validExamTypes[type];
  
  if (!validTypes) {
    throw new Error(`Tipo de orden inválido: ${type}`);
  }

  if (!validTypes.includes(examType)) {
    throw new Error(
      `Tipo de examen "${examType}" no válido para ${type}. ` +
      `Tipos válidos: ${validTypes.join(", ")}`
    );
  }

  return true;
};

/**
 * Valida que el tipo de orden sea válido
 */
const validateOrderType = (type) => {
  const validTypes = ["LABORATORY", "RADIOLOGY"];
  
  if (!type) {
    throw new Error("El tipo de orden es obligatorio.");
  }

  if (!validTypes.includes(type)) {
    throw new Error(
      `Tipo de orden inválido. Valores permitidos: ${validTypes.join(", ")}`
    );
  }

  return true;
};

/**
 * Valida que el estado de la orden sea válido
 */
const validateOrderStatus = (status) => {
  const validStatuses = ["PENDING", "COMPLETED", "CANCELLED"];
  
  if (!status) {
    return true; 
  }

  if (!validStatuses.includes(status)) {
    throw new Error(
      `Estado inválido. Valores permitidos: ${validStatuses.join(", ")}`
    );
  }

  return true;
};

/**
 * Valida que no exista una orden pendiente del mismo tipo de examen para el paciente
 */
const validateDuplicateOrder = async (prisma, { patientId, type, examType, ignoreId = null }) => {
  if (!patientId || !type || !examType) {
    throw new Error("patientId, type y examType son requeridos para validar duplicados.");
  }

  const where = {
    patientId,
    type,
    examType,
    status: "PENDING"
  };

  if (ignoreId) {
    where.id = { not: ignoreId };
  }

  const existingOrder = await prisma.medicalOrder.findFirst({
    where
  });

  if (existingOrder) {
    throw new Error(
      `Ya existe una orden pendiente de ${type === "LABORATORY" ? "laboratorio" : "radiología"} ` +
      `para el examen "${examType}" de este paciente. ` +
      `ID de orden existente: ${existingOrder.id}`
    );
  }

  return true;
};

module.exports = {
  getDoctorData,
  getPatientData,
  validateExamType,
  validateOrderType,
  validateOrderStatus,
  validateDuplicateOrder
};