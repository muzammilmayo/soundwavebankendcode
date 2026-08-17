// backend/src/middleware/rateLimiter.js

const rateLimit = require("express-rate-limit");

/**
 * Standardized JSON response for 429 Too Many Requests
 */
const createRateLimitHandler = (customMessage) => (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: customMessage || "Too many requests. Please try again later.",
    retryAfter: Math.ceil(options.windowMs / 1000) + " seconds"
  });
};

/**
 * General API Limiter:
 * 500 requests per 15 minutes per IP for general endpoints
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler("Too many API requests from this IP, please try again in 15 minutes."),
  skip: (req) => {
    // Optionally skip internal health checks
    return req.path === "/health" || req.path === "/api/health";
  }
});

/**
 * Strict Authentication Limiter:
 * 15 attempts per 15 minutes for sensitive routes (login, register, forgot-password)
 * Mitigates credential stuffing, password guessing, and account enumeration.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler("Too many authentication attempts. Please try again after 15 minutes."),
});

/**
 * Media Upload Limiter:
 * 30 uploads per 15 minutes per IP to avoid storage exhaustion and DoS
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler("Upload rate limit reached. Please wait before uploading more files."),
});

/**
 * Heavy Query & Search Limiter:
 * 120 search/filter requests per 5 minutes
 */
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler("Too many search requests. Please slow down."),
});

module.exports = {
  generalApiLimiter,
  authLimiter,
  uploadLimiter,
  searchLimiter,
};
