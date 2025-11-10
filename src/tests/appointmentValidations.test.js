const mockPrismaInstance = {
  appointment: {
    findFirst: jest.fn(),
  },
};

jest.mock("../generated/prisma", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    AppointmentStatus: {
      SCHEDULED: "SCHEDULED",
      ONGOING: "ONGOING",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
    },
  };
});

jest.mock("axios");

const {
  validateObjectId,
  getDoctorData,
  getPatientData,
  validateScheduleConflict,
} = require("../services/validations/appointmentValidations");
const axios = require("axios");

const prisma = mockPrismaInstance;

/**
 * Test suite for AppointmentValidations
 * this suite tests the validation functions used in appointment management,
 * including ObjectId validation, fetching doctor and patient data,
 * and schedule conflict validation.
 */
describe("AppointmentValidations tests", () => {
  beforeEach(() => {
    prisma.appointment.findFirst.mockClear();
    axios.get.mockClear();

    process.env.SECURITY_MS_URL = "http://localhost:3001";
    process.env.PATIENT_MS_URL = "http://localhost:3002";
  });

  describe("validateObjectId", () => {
    test("throws error when ID is not a valid MongoDB ObjectId", () => {
      expect(() => validateObjectId("invalid-id", "Doctor ID")).toThrow(
        "inválido",
      );
    });

    test("does not throw error for valid MongoDB ObjectId", () => {
      expect(() =>
        validateObjectId("507f1f77bcf86cd799439011", "Doctor ID"),
      ).not.toThrow();
    });
  });

  describe("getDoctorData", () => {
    test("throws error when doctor ID is invalid", async () => {
      await expect(getDoctorData("invalid-id", "mock-token")).rejects.toThrow(
        "inválido",
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    test("throws error when doctor is inactive", async () => {
      const doctorId = "507f1f77bcf86cd799439012";

      axios.get.mockResolvedValue({
        data: {
          id: doctorId,
          email: "doctor@example.com",
          status: "INACTIVE",
          role: "MEDICO",
        },
      });

      await expect(getDoctorData(doctorId, "mock-token")).rejects.toThrow(
        "inactivo",
      );
    });

    test("returns doctor data when doctor is active", async () => {
      const doctorId = "507f1f77bcf86cd799439012";
      const mockDoctorData = {
        id: doctorId,
        email: "doctor@example.com",
        status: "ACTIVE",
        role: "MEDICO",
      };

      axios.get.mockResolvedValue({ data: mockDoctorData });

      const result = await getDoctorData(doctorId, "mock-token");

      expect(result).toEqual(mockDoctorData);
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("getPatientData", () => {
    test("throws error when patient ID is invalid", async () => {
      await expect(getPatientData("invalid-id", "mock-token")).rejects.toThrow(
        "inválido",
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    test("throws error when patient is inactive", async () => {
      const patientId = "507f1f77bcf86cd799439011";

      axios.get.mockResolvedValue({
        data: {
          id: patientId,
          name: "John Doe",
          status: "INACTIVE",
        },
      });

      await expect(getPatientData(patientId, "mock-token")).rejects.toThrow(
        "inactivo",
      );
    });

    test("returns patient data when patient is active", async () => {
      const patientId = "507f1f77bcf86cd799439011";
      const mockPatientData = {
        id: patientId,
        name: "John Doe",
        status: "ACTIVE",
        email: "patient@example.com",
      };

      axios.get.mockResolvedValue({ data: mockPatientData });

      const result = await getPatientData(patientId, "mock-token");

      expect(result).toEqual(mockPatientData);
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("validateScheduleConflict", () => {
    test("throws error when doctor has conflicting appointment", async () => {
      const doctorId = "507f1f77bcf86cd799439012";
      const patientId = "507f1f77bcf86cd799439011";
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 30 * 60000);

      prisma.appointment.findFirst.mockResolvedValue({
        id: "existing-appointment",
        doctorId: doctorId,
        patientId: "different-patient",
        startTime: start,
        endTime: end,
        status: "SCHEDULED",
      });

      await expect(
        validateScheduleConflict({ doctorId, patientId, start, end }),
      ).rejects.toThrow("doctor ya tiene una cita");
    });

    test("throws error when patient has conflicting appointment", async () => {
      const doctorId = "507f1f77bcf86cd799439012";
      const patientId = "507f1f77bcf86cd799439011";
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 30 * 60000);

      prisma.appointment.findFirst.mockResolvedValue({
        id: "existing-appointment",
        doctorId: "different-doctor",
        patientId: patientId,
        startTime: start,
        endTime: end,
        status: "SCHEDULED",
      });

      await expect(
        validateScheduleConflict({ doctorId, patientId, start, end }),
      ).rejects.toThrow("paciente ya tiene una cita");
    });

    test("does not throw error when no conflicts exist", async () => {
      const doctorId = "507f1f77bcf86cd799439012";
      const patientId = "507f1f77bcf86cd799439011";
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 30 * 60000);

      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        validateScheduleConflict({ doctorId, patientId, start, end }),
      ).resolves.not.toThrow();
    });

    test("ignores cancelled appointments when checking conflicts", async () => {
      const doctorId = "507f1f77bcf86cd799439012";
      const patientId = "507f1f77bcf86cd799439011";
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 30 * 60000);

      prisma.appointment.findFirst.mockResolvedValue(null);

      await validateScheduleConflict({ doctorId, patientId, start, end });

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "CANCELLED" },
          }),
        }),
      );
    });
  });
});
