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
 * AuditInterceptor class to handle audit logging for HTTP requests.
 */
class AuditInterceptor {
  constructor() {
    this.initialized = false;
    this.eventQueue = [];
    this.isProcessing = false;
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
    const requestId = this.generateRequestId();
    req.auditRequestId = requestId;

    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = null;

    res.send = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    next();

    res.on("finish", async () => {
      try {
        await this.captureHttpEvent(req, res, startTime, responseBody);
      } catch (error) {}
    });
  }

  async captureHttpEvent(req, res, startTime, responseBody) {
    if (!this.initialized) {
      return;
    }

    try {
      const duration = Date.now() - startTime;
      const { method, path = req.url } = req;
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 400;
      const eventType = determineEventType(method, path, statusCode);
      const config = getEventConfig(eventType, method, path, success);

      const auditEvent = {
        accessReason:
          req.headers["x-access-reason"] || req.body?.accessReason || null,
        action: config.action,
        checksum: null,
        data: { durationMs: duration },
        description: config.description,
        errorMessage: success ? null : this.extractErrorMessage(responseBody),
        eventType,
        hipaaCompliance: isHipaaSensitiveRoute(path),
        ipAddress: this.extractIpAddress(req),
        metadata: buildAuditMetadata(req, res, duration),
        resourceId: extractResourceId(req),
        resourceType: determineResourceType(path),
        sessionId: req.auditRequestId || null,
        severityLevel: statusCode >= 500 ? "CRITICAL" : config.severity,
        source: "ms-clinical",
        statusCode,
        success,
        targetUserId: this.extractTargetPatientId(req),
        userAgent: req.get("User-Agent") || null,
        userId: req.user?.id || "ANONYMOUS",
        userRole: this.normalizeUserRole(req.user?.role),
      };

      await this.sendEvent(auditEvent);
    } catch (error) {}
  }

  async sendEvent(eventData) {
    try {
      await sendAuditEvent(eventData);
    } catch (error) {
      this.eventQueue.push({
        event: eventData,
        timestamp: new Date(),
        retries: 0,
      });

      this.processEventQueue();
    }
  }

  async processEventQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const queuedItem = this.eventQueue[0];

      try {
        await sendAuditEvent(queuedItem.event);
        this.eventQueue.shift();
      } catch (error) {
        queuedItem.retries++;

        if (queuedItem.retries >= 3) {
          this.eventQueue.shift();
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * queuedItem.retries),
          );
        }
        break;
      }
    }

    this.isProcessing = false;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  shouldSkipRoute(path) {
    const lowerPath = path.toLowerCase();
    return EXCLUDED_ROUTES.some((route) => lowerPath.includes(route));
  }

  normalizeUserRole(role) {
    return role
      ? UserRole[role.toUpperCase()] || UserRole.UNKNOWN
      : UserRole.UNKNOWN;
  }

  extractTargetPatientId(req) {
    if (req.params?.id) return req.params.id;
    if (req.params?.patientId) return req.params.patientId;
    if (req.body?.patientId) return req.body.patientId;
    return null;
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

  extractErrorMessage(responseBody) {
    if (!responseBody) return null;

    try {
      const parsed =
        typeof responseBody === "string"
          ? JSON.parse(responseBody)
          : responseBody;
      return parsed.message || parsed.error || null;
    } catch {
      return null;
    }
  }

  async disconnect() {
    try {
      await this.processEventQueue();
      await disconnect();
      this.initialized = false;
    } catch (error) {}
  }

  getQueueStatus() {
    return {
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
      initialized: this.initialized,
    };
  }
}

const auditInterceptor = new AuditInterceptor();

module.exports = {
  initialize: auditInterceptor.initialize.bind(auditInterceptor),
  auditInterceptor: auditInterceptor.auditInterceptor.bind(auditInterceptor),
  disconnect: auditInterceptor.disconnect.bind(auditInterceptor),
  getQueueStatus: auditInterceptor.getQueueStatus.bind(auditInterceptor),
};
