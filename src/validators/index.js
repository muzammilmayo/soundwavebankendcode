// backend/src/validators/index.js

const { ERROR_MESSAGES } = require('../constants');

/**
 * Validator utility class for Soundwave API requests
 */
class RequestValidator {
  /**
   * Validate required fields on request body
   */
  static validateRequired(fields, body) {
    const missing = [];
    for (const field of fields) {
      if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate integer ID
   */
  static validateId(id, fieldName = 'ID') {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid format for ${fieldName}: Must be a positive integer`);
    }
    return parsed;
  }

  /**
   * Validate date format
   */
  static validateDate(dateStr, fieldName = 'Date') {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for ${fieldName}. Use YYYY-MM-DD format`);
    }
    return date;
  }

  /**
   * Middleware wrapper to handle error response consistently
   */
  static handleValidation(validateFn) {
    return (req, res, next) => {
      try {
        validateFn(req);
        next();
      } catch (err) {
        res.status(400).json({
          success: false,
          message: err.message || ERROR_MESSAGES.INVALID_INPUT
        });
      }
    };
  }
}

module.exports = RequestValidator;
