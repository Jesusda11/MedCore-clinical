const { Kafka, logLevel } = require("kafkajs");
const crypto = require("crypto");
const { AZURE_EVENT_HUB_CONFIG } = require("../constants/azureConfig");

function generateUuidV4() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

class AuditConfig {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        return;
      }

      const connectionString = AZURE_EVENT_HUB_CONFIG.CONNECTION_STRING;

      if (!connectionString) {
        return;
      }

      const kafkaConfig = {
        clientId: AZURE_EVENT_HUB_CONFIG.CLIENT_ID,
        brokers: AZURE_EVENT_HUB_CONFIG.BROKERS,
        ssl: true,
        sasl: {
          mechanism: "plain",
          username: "$ConnectionString",
          password: connectionString,
        },
        connectionTimeout: 10000,
        requestTimeout: 30000,
        logLevel: logLevel.WARN,
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      };

      this.kafka = new Kafka(kafkaConfig);
      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
    }
  }

  async sendAuditEvent(eventData) {
    try {
      if (!this.isInitialized || !this.producer) {
        return false;
      }

      const topic = AZURE_EVENT_HUB_CONFIG.TOPIC;
      const eventId = generateUuidV4();

      const auditEvent = {
        id: eventId,
        eventType: eventData.eventType,
        userId: eventData.userId,
        userRole: eventData.userRole,
        targetUserId: eventData.targetUserId,
        resourceType: eventData.resourceType,
        resourceId: eventData.resourceId,
        action: eventData.action,
        description: eventData.description,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        sessionId: eventData.sessionId,
        success: eventData.success,
        errorMessage: eventData.errorMessage,
        severityLevel: eventData.severityLevel,
        accessReason: eventData.accessReason,
        checksum: eventData.checksum,
        data: eventData.data,
        hipaaCompliance: eventData.hipaaCompliance,
        metadata: {
          ...eventData.metadata,
          serviceName: "ms-clinical",
          auditTimestamp: new Date().toISOString(),
        },
      };

      const message = {
        key: eventId,
        value: JSON.stringify(auditEvent),
        timestamp: Date.now().toString(),
        headers: {
          service: "ms-clinical",
          eventType: eventData.eventType,
          userId: eventData.userId || "anonymous",
          severityLevel: eventData.severityLevel,
        },
      };

      await this.producer.send({
        topic,
        messages: [message],
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.isInitialized = false;
      }
    } catch (error) {}
  }
}

const auditConfig = new AuditConfig();

module.exports = {
  initialize: auditConfig.initialize.bind(auditConfig),
  sendAuditEvent: auditConfig.sendAuditEvent.bind(auditConfig),
  disconnect: auditConfig.disconnect.bind(auditConfig),
};
