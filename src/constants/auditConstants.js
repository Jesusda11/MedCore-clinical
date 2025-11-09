/**
 * Audit Constants for Healthcare Appointment System
 * Defines event types, user roles, severity levels, action types,
 * resource types, and configuration for audit events.
 */
const EventType = {
  APPOINTMENT_CREATED: "APPOINTMENT_CREATED",
  APPOINTMENT_UPDATED: "APPOINTMENT_UPDATED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  APPOINTMENT_NO_SHOW: "APPOINTMENT_NO_SHOW",
  HTTP_POST_REQUEST: "HTTP_POST_REQUEST",
  HTTP_GET_REQUEST: "HTTP_GET_REQUEST",
  HTTP_PUT_REQUEST: "HTTP_PUT_REQUEST",
  HTTP_DELETE_REQUEST: "HTTP_DELETE_REQUEST",
  HTTP_PATCH_REQUEST: "HTTP_PATCH_REQUEST",
};

const UserRole = {
  ADMINISTRADOR: "ADMINISTRADOR",
  MEDICO: "MEDICO",
  ENFERMERA: "ENFERMERA",
  PACIENTE: "PACIENTE",
  SISTEMA: "SISTEMA",
  UNKNOWN: "UNKNOWN",
};

const SeverityLevel = {
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

const ActionType = {
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  CANCEL: "CANCEL",
  COMPLETE: "COMPLETE",
};

const ResourceType = {
  APPOINTMENT: "APPOINTMENT",
};

const HTTP_METHOD_TO_ACTION = {
  POST: ActionType.CREATE,
  GET: ActionType.READ,
  PUT: ActionType.UPDATE,
  PATCH: ActionType.UPDATE,
  DELETE: ActionType.DELETE,
};

const EVENT_CONFIG = {
  [EventType.APPOINTMENT_CREATED]: {
    severity: SeverityLevel.LOW,
    action: ActionType.CREATE,
    description: "Appointment created",
  },
  [EventType.APPOINTMENT_UPDATED]: {
    severity: SeverityLevel.LOW,
    action: ActionType.UPDATE,
    description: "Appointment updated",
  },
  [EventType.APPOINTMENT_CANCELLED]: {
    severity: SeverityLevel.MEDIUM,
    action: ActionType.CANCEL,
    description: "Appointment cancelled",
  },
  [EventType.APPOINTMENT_COMPLETED]: {
    severity: SeverityLevel.LOW,
    action: ActionType.COMPLETE,
    description: "Appointment completed",
  },
  [EventType.APPOINTMENT_NO_SHOW]: {
    severity: SeverityLevel.MEDIUM,
    action: ActionType.UPDATE,
    description: "Appointment marked as no-show",
  },
  [EventType.HTTP_POST_REQUEST]: {
    severity: SeverityLevel.INFO,
    action: ActionType.CREATE,
  },
  [EventType.HTTP_GET_REQUEST]: {
    severity: SeverityLevel.INFO,
    action: ActionType.READ,
  },
  [EventType.HTTP_PUT_REQUEST]: {
    severity: SeverityLevel.INFO,
    action: ActionType.UPDATE,
  },
  [EventType.HTTP_DELETE_REQUEST]: {
    severity: SeverityLevel.LOW,
    action: ActionType.DELETE,
  },
  [EventType.HTTP_PATCH_REQUEST]: {
    severity: SeverityLevel.INFO,
    action: ActionType.UPDATE,
  },
};

const HIPAA_SENSITIVE_ROUTES = ["/appointments"];
const EXCLUDED_ROUTES = [];

module.exports = {
  EventType,
  UserRole,
  SeverityLevel,
  ActionType,
  ResourceType,
  HTTP_METHOD_TO_ACTION,
  EVENT_CONFIG,
  HIPAA_SENSITIVE_ROUTES,
  EXCLUDED_ROUTES,
};
