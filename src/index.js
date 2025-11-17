require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./router/routes");
const { initialize, disconnect } = require("./interceptors/auditInterceptor");
const { startConsumer } = require('./events/kafkaConsumer');
require("./jobs/autoCancelJob");
require("./jobs/autoQueueEntryJob");
require("./jobs/sendReminderJob");

startConsumer().catch(err => console.error('Error iniciando consumer:', err));

const PORT = process.env.PORT || 4000;

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: false,
  }),
);
app.use(express.json());

app.use("/api/v1", router);

process.on("SIGINT", async () => {
  await disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnect();
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`Appointment Service running on port ${PORT}`);
  await initialize();
});
