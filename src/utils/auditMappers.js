/**
 * Audit Mappers for Appointment-related API requests
 */
const {
  EventType,
  ActionType,
  ResourceType,
  SeverityLevel,
  EVENT_CONFIG,
  HIPAA_SENSITIVE_ROUTES,
} = require("../constants/auditConstants");

const ROUTE_PATTERNS = [
  {
    pattern: /\/appointments\/\d+\/cancel/i,
    methods: ["PUT", "PATCH"],
    event: EventType.APPOINTMENT_CANCELLED,
  },
  {
    pattern: /\/appointments\/\d+\/complete/i,
    methods: ["PUT", "PATCH"],
    event: EventType.APPOINTMENT_COMPLETED,
  },
  {
    pattern: /\/appointments\/\d+\/no-show/i,
    methods: ["PUT", "PATCH"],
    event: EventType.APPOINTMENT_NO_SHOW,
  },
  {
    pattern: /\/appointments\/\d+/i,
    methods: ["PUT", "PATCH"],
    event: EventType.APPOINTMENT_UPDATED,
  },
  {
    pattern: /\/appointments/i,
    methods: ["POST"],
    event: EventType.APPOINTMENT_CREATED,
  },
];

function matchRoutePattern(pattern, method, path) {
  if (!pattern.pattern.test(path)) return null;
  if (pattern.methods && !pattern.methods.includes(method)) return null;
  return pattern;
}

function determineEventType(method, path, statusCode) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.toLowerCase();

  for (const pattern of ROUTE_PATTERNS) {
    const match = matchRoutePattern(pattern, normalizedMethod, normalizedPath);
    if (match?.event) return match.event;
  }

  return `HTTP_${normalizedMethod}_REQUEST`;
}

function getEventConfig(eventType, method, path, success) {
  const config = EVENT_CONFIG[eventType];

  if (!config) {
    return {
      severity: SeverityLevel.INFO,
      action: ActionType.READ,
      description: `${method} request to ${path}`,
    };
  }

  return {
    severity: config.severity,
    action: config.action,
    description: config.description || `${method} request to ${path}`,
  };
}

function determineResourceType() {
  return ResourceType.APPOINTMENT;
}

function isHipaaSensitiveRoute(path) {
  const lowerPath = path.toLowerCase();
  return HIPAA_SENSITIVE_ROUTES.some((route) => lowerPath.includes(route));
}

function extractResourceId(req) {
  return req.params?.id || req.body?.id || null;
}

function buildAuditMetadata(req, res, duration) {
  return {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
  };
}

module.exports = {
  determineEventType,
  getEventConfig,
  determineResourceType,
  isHipaaSensitiveRoute,
  extractResourceId,
  buildAuditMetadata,
};
