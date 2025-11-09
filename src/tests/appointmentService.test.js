const mockPrismaInstance = {
  appointment: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
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
jest.mock("../services/validations/appointmentValidations");

const AppointmentService = require("../services/appointmentService");
const axios = require("axios");
const {
  getDoctorData,
  getPatientData,
  validateScheduleConflict,
} = require("../services/validations/appointmentValidations");

const prisma = mockPrismaInstance;

/**
 * Test suite for AppointmentService
 * this suite tests the main functionalities of the AppointmentService,
 * including creating, updating, cancelling, and retrieving appointments.
 */
describe("AppointmentService tests", () => {
  beforeEach(() => {
    prisma.appointment.create.mockClear();
    prisma.appointment.update.mockClear();
    prisma.appointment.findUnique.mockClear();
    prisma.appointment.findMany.mockClear();
    prisma.appointment.findFirst.mockClear();

    getDoctorData.mockClear();
    getPatientData.mockClear();
    validateScheduleConflict.mockClear();

    process.env.SECURITY_MS_URL = "http://localhost:3001";
    process.env.PATIENT_MS_URL = "http://localhost:3002";
  });

  describe("create", () => {
    test("throws error when date is in the past", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const appointmentData = {
        patientId: "507f1f77bcf86cd799439011",
        doctorId: "507f1f77bcf86cd799439012",
        startTime: pastDate,
        token: "mock-token",
      };

      await expect(AppointmentService.create(appointmentData)).rejects.toThrow(
        "pasado",
      );
    });

    test("validates doctor and patient before creating appointment", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const appointmentData = {
        patientId: "507f1f77bcf86cd799439011",
        doctorId: "507f1f77bcf86cd799439012",
        startTime: futureDate,
        token: "mock-token",
      };

      getDoctorData.mockResolvedValue({
        id: "507f1f77bcf86cd799439012",
        status: "ACTIVE",
      });
      getPatientData.mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        status: "ACTIVE",
      });
      validateScheduleConflict.mockResolvedValue(undefined);

      prisma.appointment.create.mockResolvedValue({
        id: "appointment123",
        ...appointmentData,
        startTime: new Date(futureDate),
        endTime: new Date(new Date(futureDate).getTime() + 30 * 60000),
        status: "SCHEDULED",
      });

      await AppointmentService.create(appointmentData);

      expect(getDoctorData).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012",
        "mock-token",
      );
      expect(getPatientData).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "mock-token",
      );
      expect(validateScheduleConflict).toHaveBeenCalled();
    });

    test("successfully creates appointment with valid data", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const appointmentData = {
        patientId: "507f1f77bcf86cd799439011",
        doctorId: "507f1f77bcf86cd799439012",
        startTime: futureDate,
        token: "mock-token",
      };

      getDoctorData.mockResolvedValue({
        id: "507f1f77bcf86cd799439012",
        status: "ACTIVE",
      });
      getPatientData.mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        status: "ACTIVE",
      });
      validateScheduleConflict.mockResolvedValue(undefined);

      const mockAppointment = {
        id: "appointment123",
        patientId: "507f1f77bcf86cd799439011",
        doctorId: "507f1f77bcf86cd799439012",
        startTime: new Date(futureDate),
        endTime: new Date(new Date(futureDate).getTime() + 30 * 60000),
        status: "SCHEDULED",
      };

      prisma.appointment.create.mockResolvedValue(mockAppointment);

      const result = await AppointmentService.create(appointmentData);

      expect(result).toEqual(mockAppointment);
      expect(result.status).toBe("SCHEDULED");
    });
  });

  describe("update", () => {
    test("throws error when appointment is not found", async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentService.update(
          "nonexistent123",
          { status: "COMPLETED" },
          "mock-token",
        ),
      ).rejects.toThrow("no encontrada");
    });

    test("throws error when new startTime is in the past", async () => {
      const existingAppointment = {
        id: "appointment123",
        doctorId: "507f1f77bcf86cd799439012",
        patientId: "507f1f77bcf86cd799439011",
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 86400000 + 30 * 60000),
        status: "SCHEDULED",
      };

      const pastDate = new Date(Date.now() - 86400000).toISOString();

      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);

      await expect(
        AppointmentService.update(
          "appointment123",
          { startTime: pastDate },
          "mock-token",
        ),
      ).rejects.toThrow("pasado");
    });

    test("updates appointment status successfully", async () => {
      const existingAppointment = {
        id: "appointment123",
        doctorId: "507f1f77bcf86cd799439012",
        patientId: "507f1f77bcf86cd799439011",
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 86400000 + 30 * 60000),
        status: "SCHEDULED",
      };

      const updatedAppointment = {
        ...existingAppointment,
        status: "COMPLETED",
      };

      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      prisma.appointment.update.mockResolvedValue(updatedAppointment);

      const result = await AppointmentService.update(
        "appointment123",
        { status: "COMPLETED" },
        "mock-token",
      );

      expect(result.status).toBe("COMPLETED");
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appointment123" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
    });
  });

  describe("cancel", () => {
    test("throws error when appointment is not found", async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(AppointmentService.cancel("nonexistent123")).rejects.toThrow(
        "no encontrada",
      );
    });

    test("throws error when appointment is already cancelled", async () => {
      const cancelledAppointment = {
        id: "appointment123",
        status: "CANCELLED",
      };

      prisma.appointment.findUnique.mockResolvedValue(cancelledAppointment);

      await expect(AppointmentService.cancel("appointment123")).rejects.toThrow(
        "ya está cancelada",
      );
    });

    test("successfully cancels a scheduled appointment", async () => {
      const scheduledAppointment = {
        id: "appointment123",
        doctorId: "507f1f77bcf86cd799439012",
        patientId: "507f1f77bcf86cd799439011",
        status: "SCHEDULED",
      };

      const cancelledAppointment = {
        ...scheduledAppointment,
        status: "CANCELLED",
      };

      prisma.appointment.findUnique.mockResolvedValue(scheduledAppointment);
      prisma.appointment.update.mockResolvedValue(cancelledAppointment);

      const result = await AppointmentService.cancel("appointment123");

      expect(result.status).toBe("CANCELLED");
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appointment123" },
          data: { status: "CANCELLED" },
        }),
      );
    });
  });

  describe("getAppointments", () => {
    test("throws error when date format is invalid", async () => {
      await expect(
        AppointmentService.getAppointments({ date: "invalid-date" }),
      ).rejects.toThrow("inválida");
    });

    test("retrieves appointments filtered by single date", async () => {
      const testDate = new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0];

      const mockAppointments = [
        {
          id: "appointment1",
          doctorId: "507f1f77bcf86cd799439012",
          patientId: "507f1f77bcf86cd799439011",
          startTime: new Date(testDate + "T10:00:00Z"),
          status: "SCHEDULED",
        },
      ];

      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await AppointmentService.getAppointments({
        date: testDate,
      });

      expect(result).toEqual(mockAppointments);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    test("retrieves appointments filtered by doctorId and status", async () => {
      const filters = {
        doctorId: "507f1f77bcf86cd799439012",
        status: "SCHEDULED",
      };

      const mockAppointments = [
        {
          id: "appointment1",
          doctorId: "507f1f77bcf86cd799439012",
          status: "SCHEDULED",
        },
      ];

      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await AppointmentService.getAppointments(filters);

      expect(result).toEqual(mockAppointments);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: "507f1f77bcf86cd799439012",
            status: "SCHEDULED",
          }),
        }),
      );
    });
  });
});
