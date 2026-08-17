// backend/src/middleware/errorHandler.js

/**
 * Centralized Error Handling Middleware
 * 
 * - Standardizes error response format across the entire platform
 * - Masks internal database error details (Sequelize / SQL errors) in production
 * - Captures unhandled exceptions and prevents server crashes
 * - Cleans up sensitive stack traces from client responses
 */
const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Log error details on server for debugging
  console.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    name: err.name,
    stack: isDev ? err.stack : undefined,
  });

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "An unexpected internal server error occurred.";

  // Handle Sequelize Database Validation Errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = err.errors && err.errors.length > 0 
      ? err.errors.map(e => e.message).join(', ') 
      : 'Database validation failed';
  } 
  // Handle General Sequelize / SQL Errors (Mask database specifics)
  else if (err.name && err.name.startsWith('Sequelize')) {
    statusCode = 500;
    message = 'A database operation failed. Please contact support if the problem persists.';
  }
  // Handle JWT Authentication Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }
  // Handle Payload Too Large
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload is too large. Please reduce upload size.';
  }

  // Sanitize response object
  const responsePayload = {
    success: false,
    message,
  };

  // Only attach debug details in development if explicitly enabled
  if (isDev && statusCode === 500) {
    responsePayload.debug = {
      name: err.name,
      error: err.message,
    };
  }

  return res.status(statusCode).json(responsePayload);
};

/**
 * 404 Route Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
