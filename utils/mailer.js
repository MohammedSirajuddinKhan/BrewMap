const nodemailer = require("nodemailer");

const createTransport = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to ethereal or console
  return {
    sendMail: async (opts) => {
      console.log("Send Mail (dev):", opts);
      return Promise.resolve();
    },
  };
};

module.exports = createTransport();
