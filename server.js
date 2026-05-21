require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 3000;

// Connect to DB then start server
connectDB()
  .then(() => {
    const server = http.createServer(app);
    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

    const shutdown = (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully.`);
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("Forcing shutdown");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  });

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
