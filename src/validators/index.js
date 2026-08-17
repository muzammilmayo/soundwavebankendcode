// backend/src/validators/index.js

const { ERROR_MESSAGES } = require('../constants');

/**
 * Reusable Request Validator for Soundwave Platform
 * Provides structural validation and sanitization for queries, parameters, and bodies.
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
      const err = new Error(`Missing required fields: ${missing.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Validate integer ID
   */
  static validateId(id, fieldName = 'ID') {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || parsed <= 0) {
      const err = new Error(`Invalid format for ${fieldName}: Must be a positive integer`);
      err.statusCode = 400;
      throw err;
    }
    return parsed;
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      const err = new Error('Valid email address is required');
      err.statusCode = 400;
      throw err;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const err = new Error('Invalid email address format');
      err.statusCode = 400;
      throw err;
    }
    return email.trim().toLowerCase();
  }

  /**
   * Validate password complexity / length
   */
  static validatePassword(password, minLength = 6) {
    if (!password || typeof password !== 'string' || password.length < minLength) {
      const err = new Error(`Password must be at least ${minLength} characters long`);
      err.statusCode = 400;
      throw err;
    }
    return password;
  }

  /**
   * Validate date format
   */
  static validateDate(dateStr, fieldName = 'Date') {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const err = new Error(`Invalid date format for ${fieldName}. Use YYYY-MM-DD format`);
      err.statusCode = 400;
      throw err;
    }
    return date;
  }

  /**
   * Sanitize and bound pagination parameters
   */
  static sanitizePagination(query, defaultLimit = 10, maxLimit = 100) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    return {
      page,
      limit,
      offset: (page - 1) * limit
    };
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
        res.status(err.statusCode || 400).json({
          success: false,
          message: err.message || (ERROR_MESSAGES ? ERROR_MESSAGES.INVALID_INPUT : "Invalid request data")
        });
      }
    };
  }

  // Pre-configured Middleware Validators

  /**
   * Validate User Registration payload
   */
  static validateRegister() {
    return this.handleValidation((req) => {
      this.validateRequired(['username', 'email', 'password', 'role_id'], req.body);
      this.validateEmail(req.body.email);
      this.validatePassword(req.body.password, 6);
      this.validateId(req.body.role_id, 'Role ID');
    });
  }

  /**
   * Validate Login payload
   */
  static validateLogin() {
    return this.handleValidation((req) => {
      this.validateRequired(['email', 'password'], req.body);
      this.validateEmail(req.body.email);
    });
  }

  /**
   * Validate Forgot Password payload
   */
  static validateForgotPassword() {
    return this.handleValidation((req) => {
      this.validateRequired(['email'], req.body);
      this.validateEmail(req.body.email);
    });
  }

  /**
   * Validate Reset Password payload
   */
  static validateResetPassword() {
    return this.handleValidation((req) => {
      const token = req.params.token || req.body.token;
      if (!token) {
        const err = new Error('Reset token is required');
        err.statusCode = 400;
        throw err;
      }
      this.validateRequired(['newPassword'], req.body);
      this.validatePassword(req.body.newPassword, 6);
    });
  }

  /**
   * Validate ID parameter in req.params
   */
  static validateParamId(paramName = 'id') {
    return this.handleValidation((req) => {
      this.validateId(req.params[paramName], paramName);
    });
  }
}

module.exports = RequestValidator;
