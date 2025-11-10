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

const appointmentController = require("../controllers/appointmentController");
const axios = require("axios");

const prisma = mockPrismaInstance;

/**
 * Test suite for AppointmentController
 * this suite tests the main functionalities of the AppointmentController,
 * including creating, updating, cancelling, and retrieving appointments.
 */
describe("AppintmentController tests", () => {
  describe("AppointmentController", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        params: {},
        query: {},
        token: "mock-jwt-token",
        user: { id: "doctor123", role: "MEDICO" },
      };

      const jsonMock = jest.fn();
      const statusMock = jest.fn(() => ({ json: jsonMock }));

      res = {
        status: statusMock,
        json: jsonMock,
      };

      prisma.appointment.create.mockClear();
      prisma.appointment.update.mockClear();
      prisma.appointment.findUnique.mockClear();
      prisma.appointment.findMany.mockClear();
      prisma.appointment.findFirst.mockClear();
      axios.get.mockClear();

      process.env.SECURITY_MS_URL = "http://localhost:3001";
      process.env.PATIENT_MS_URL = "http://localhost:3002";
    });

    describe("createAppointment", () => {
      test("returns 400 when required fields are missing", async () => {
        req.body = { patientId: "patient123" };

        await appointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining("obligatorios"),
          }),
        );
      });

      test("returns 400 when there is a scheduling conflict", async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        req.body = {
          patientId: "507f1f77bcf86cd799439011",
          doctorId: "507f1f77bcf86cd799439012",
          startTime: futureDate,
        };

        axios.get
          .mockResolvedValueOnce({
            data: { id: "507f1f77bcf86cd799439012", status: "ACTIVE" },
          })
          .mockResolvedValueOnce({
            data: { id: "507f1f77bcf86cd799439011", status: "ACTIVE" },
          });

        prisma.appointment.findFirst.mockResolvedValue({
          id: "appointment123",
          doctorId: "507f1f77bcf86cd799439012",
          startTime: new Date(futureDate),
          endTime: new Date(new Date(futureDate).getTime() + 30 * 60000),
        });

        await appointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining("cita"),
          }),
        );
      });

      test("returns 201 and creates appointment successfully", async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        req.body = {
          patientId: "507f1f77bcf86cd799439011",
          doctorId: "507f1f77bcf86cd799439012",
          startTime: futureDate,
        };

        const mockAppointment = {
          id: "appointment123",
          patientId: "507f1f77bcf86cd799439011",
          doctorId: "507f1f77bcf86cd799439012",
          startTime: new Date(futureDate),
          endTime: new Date(new Date(futureDate).getTime() + 30 * 60000),
          status: "SCHEDULED",
        };

        axios.get
          .mockResolvedValueOnce({
            data: { id: "507f1f77bcf86cd799439012", status: "ACTIVE" },
          })
          .mockResolvedValueOnce({
            data: { id: "507f1f77bcf86cd799439011", status: "ACTIVE" },
          });

        prisma.appointment.findFirst.mockResolvedValue(null);
        prisma.appointment.create.mockResolvedValue(mockAppointment);

        await appointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("creada"),
            appointment: expect.objectContaining({
              id: "appointment123",
              doctorId: "507f1f77bcf86cd799439012",
            }),
          }),
        );
      });
    });

    describe("updateAppointment", () => {
      test("returns 400 when no fields are provided for update", async () => {
        req.params.id = "appointment123";
        req.body = {};

        await appointmentController.updateAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining("al menos un campo"),
          }),
        );
      });

      test("returns 200 and updates status successfully", async () => {
        req.params.id = "appointment123";
        req.body = { status: "COMPLETED" };

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

        await appointmentController.updateAppointment(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("actualizada"),
            appointment: expect.objectContaining({
              status: "COMPLETED",
            }),
          }),
        );
      });
    });

    describe("cancelAppointment", () => {
      test("returns 400 when appointment is already cancelled", async () => {
        req.params.id = "appointment123";

        prisma.appointment.findUnique.mockResolvedValue({
          id: "appointment123",
          status: "CANCELLED",
        });

        await appointmentController.cancelAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining("ya está cancelada"),
          }),
        );
      });

      test("returns 200 and cancels appointment successfully", async () => {
        req.params.id = "appointment123";

        const existingAppointment = {
          id: "appointment123",
          status: "SCHEDULED",
        };

        const cancelledAppointment = {
          ...existingAppointment,
          status: "CANCELLED",
        };

        prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
        prisma.appointment.update.mockResolvedValue(cancelledAppointment);

        await appointmentController.cancelAppointment(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("cancelada"),
            appointment: expect.objectContaining({
              status: "CANCELLED",
            }),
          }),
        );
      });
    });

    describe("getAppointments", () => {
      test("returns appointments filtered by date", async () => {
        const testDate = new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0];
        req.query = { date: testDate };

        const mockAppointments = [
          {
            id: "appointment1",
            doctorId: "507f1f77bcf86cd799439012",
            patientId: "507f1f77bcf86cd799439011",
            startTime: new Date(Date.now() + 86400000),
            status: "SCHEDULED",
          },
        ];

        prisma.appointment.findMany.mockResolvedValue(mockAppointments);

        await appointmentController.getAppointments(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("obtenidas"),
            count: 1,
            appointments: expect.arrayContaining([
              expect.objectContaining({ id: "appointment1" }),
            ]),
          }),
        );
      });

      test("returns appointments filtered by doctor", async () => {
        req.query = { doctorId: "507f1f77bcf86cd799439012" };

        const mockAppointments = [
          {
            id: "appointment1",
            doctorId: "507f1f77bcf86cd799439012",
            patientId: "507f1f77bcf86cd799439011",
            startTime: new Date(Date.now() + 86400000),
            status: "SCHEDULED",
          },
        ];

        prisma.appointment.findMany.mockResolvedValue(mockAppointments);

        await appointmentController.getAppointments(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            count: 1,
            appointments: expect.arrayContaining([
              expect.objectContaining({ doctorId: "507f1f77bcf86cd799439012" }),
            ]),
          }),
        );
      });
    });
  });
});
