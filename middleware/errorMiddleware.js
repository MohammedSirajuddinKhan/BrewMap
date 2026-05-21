class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${String(statusCode).startsWith("4") ? "fail" : "error"}`;
    Error.captureStackTrace(this, this.constructor);
  }
}

const sendErrorDev = (err, req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.statusCode || 500).json({
      status: err.status || "error",
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(err.statusCode || 500).render("errors/error", { error: err });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  console.error(err);
  sendErrorDev(err, req, res);
};

module.exports.AppError = AppError;
