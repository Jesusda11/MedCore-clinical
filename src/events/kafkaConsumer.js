const { Kafka } = require('kafkajs');
const AppointmentService = require('../services/appointmentService');

const kafka = new Kafka({
  clientId: 'ms-appointments',
  brokers: [process.env.AZURE_EVENT_HUB_BROKERS],
  ssl: true,
  sasl: {
    mechanism: 'plain',
    username: '$ConnectionString',
    password: process.env.AZURE_EVENT_HUB_CONNECTION_STRING,
  },
});

const consumer = kafka.consumer({ groupId: 'appointments-consumer-group' });

const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: process.env.AZURE_EVENT_HUB_TOPIC_CLINICAL, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
  
      if (event.eventType === 'doctor.status.changed' && event.newStatus === 'INACTIVE') {
        console.log(`Doctor inactivo: ${event.doctorId}, reprogamando citas...`);
        await AppointmentService.handleDoctorInactive(event.doctorId, process.env.SECURITY_SERVICE_TOKEN);
      }
    },
  });
};

module.exports = { startConsumer };
