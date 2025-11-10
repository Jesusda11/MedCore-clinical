const {
  initialize,
  sendAuditEvent,
  disconnect,
} = require("../config/auditConfig");

const { UserRole, EXCLUDED_ROUTES } = require("../constants/auditConstants");

const {
  determineEventType,
  getEventConfig,
  determineResourceType,
  isHipaaSensitiveRoute,
  extractResourceId,
  buildAuditMetadata,
} = require("../utils/auditMappers");

/**
 * AuditInterceptor for ms-clinical microservice
 * Captures HTTP requests and sends audit events to Azure Event Hub
 */
class AuditInterceptor {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await initialize();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize audit interceptor:", error.message);
    }
  }

  auditInterceptor(req, res, next) {
    if (this.shouldSkipRoute(req.path)) return next();

    const startTime = Date.now();

    res.on("finish", async () => {
      try {
        await this.captureHttpEvent(req, res, startTime);
      } catch (error) {
        console.error("Error capturing audit event:", error.message);
      }
    });

    next();
  }

  async captureHttpEvent(req, res, startTime) {
    if (!this.initialized) return;

    try {
      const duration = Date.now() - startTime;
      const { method, path = req.url } = req;
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 400;
      const eventType = determineEventType(method, path, statusCode);
      const config = getEventConfig(eventType, method, path, success);

      const auditEvent = {
        eventType,
        userId: req.user?.id || "ANONYMOUS",
        userRole: this.normalizeUserRole(req.user?.role),
        targetUserId: null,
        resourceType: determineResourceType(),
        resourceId: extractResourceId(req),
        action: config.action,
        description: config.description,
        ipAddress: this.extractIpAddress(req),
        userAgent: req.get("User-Agent") || null,
        sessionId: req.sessionId || null,
        success,
        errorMessage: success ? null : "Request failed",
        severityLevel: config.severity,
        accessReason: req.headers["x-access-reason"] || null,
        checksum: null,
        data: { durationMs: duration },
        hipaaCompliance: isHipaaSensitiveRoute(path),
        metadata: buildAuditMetadata(req, res, duration),
      };

      await sendAuditEvent(auditEvent);
    } catch (error) {
      console.error("Error sending audit event:", error.message);
    }
  }

  shouldSkipRoute(path) {
    const lowerPath = path.toLowerCase();
    return EXCLUDED_ROUTES.some((route) => lowerPath.includes(route));
  }

  normalizeUserRole(role) {
    if (!role) return UserRole.UNKNOWN;
    const upperRole = role.toUpperCase();
    return UserRole[upperRole] || UserRole.UNKNOWN;
  }

  extractIpAddress(req) {
    return (
      req.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.headers["x-real-ip"] ||
      req.connection?.remoteAddress ||
      "unknown"
    );
  }

  async disconnect() {
    try {
      await disconnect();
      this.initialized = false;
    } catch (error) {
      console.error("Error disconnecting audit interceptor:", error.message);
    }
  }
}

const auditInterceptor = new AuditInterceptor();

module.exports = {
  initialize: auditInterceptor.initialize.bind(auditInterceptor),
  auditInterceptor: auditInterceptor.auditInterceptor.bind(auditInterceptor),
  disconnect: auditInterceptor.disconnect.bind(auditInterceptor),
};
