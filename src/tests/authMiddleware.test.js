jest.mock("jsonwebtoken");

const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Test suite for AuthMiddleware
 * this suite tests the authentication middleware,
 * ensuring it correctly validates JWT tokens and handles errors.
 */
describe("AuthMiddleware tests", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: undefined,
      token: undefined,
    };

    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock }));

    res = {
      status: statusMock,
      json: jsonMock,
    };

    next = jest.fn();

    jwt.verify.mockClear();
    process.env.JWT_SECRET = "test-secret-key";
  });

  describe("Token Validation", () => {
    test("returns 401 when authorization header is missing", () => {
      req.headers = {};

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("no proporcionado"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when authorization header does not start with Bearer", () => {
      req.headers.authorization = "Basic dGVzdDp0ZXN0";

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("no proporcionado"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token is invalid", () => {
      req.headers.authorization = "Bearer invalid-token";

      jwt.verify.mockImplementation(() => {
        throw new Error("invalid token");
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("inválido"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token is expired", () => {
      req.headers.authorization = "Bearer expired-token";

      jwt.verify.mockImplementation(() => {
        const error = new Error("jwt expired");
        error.name = "TokenExpiredError";
        throw error;
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("expirado"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Successful Authentication", () => {
    test("calls next when token is valid", () => {
      const mockToken = "valid-jwt-token";
      const mockDecoded = {
        id: "user123",
        email: "user@example.com",
        role: "MEDICO",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      req.headers.authorization = `Bearer ${mockToken}`;
      jwt.verify.mockReturnValue(mockDecoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, "test-secret-key");
      expect(req.user).toEqual(mockDecoded);
      expect(req.token).toBe(mockToken);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
