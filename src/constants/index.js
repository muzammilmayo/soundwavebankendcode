// backend/src/constants/index.js

const LIFECYCLE_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  ARTIST: 'Artist',
  LISTENER: 'Listener',
};

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized: Access token is missing or invalid',
  FORBIDDEN: 'Forbidden: You do not have the required permissions',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Internal server error',
  INVALID_INPUT: 'Invalid request input fields',
};

module.exports = {
  LIFECYCLE_STATUS,
  ROLES,
  ERROR_MESSAGES,
};
