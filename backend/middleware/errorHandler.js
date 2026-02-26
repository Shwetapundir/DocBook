const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.code === "23505") {
    statusCode = 409;
    message = "Resource already exists or slot already booked";
  }
  if (err.code === "23503") {
    statusCode = 400;
    message = "Referenced resource does not exist";
  }

  console.error(`[${new Date().toISOString()}] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
};

module.exports = { notFound, errorHandler };