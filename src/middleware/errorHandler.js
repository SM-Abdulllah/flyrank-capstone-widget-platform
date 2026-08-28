const { ZodError } = require('zod');
const { AppError } = require('../errors');

function formatZodError(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}

function errorHandler(error, req, res, _next) {
  let normalized = error;

  if (error instanceof ZodError) {
    normalized = new AppError(400, 'invalid_request', 'Invalid request', formatZodError(error));
  } else if (error.type === 'entity.too.large') {
    normalized = new AppError(413, 'payload_too_large', 'Payload too large');
  } else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    normalized = new AppError(400, 'invalid_json', 'Malformed JSON request body');
  }

  const statusCode = normalized.statusCode || 500;
  const response = {
    error: {
      code: normalized.code || 'internal_error',
      message:
        normalized.expose && normalized.message
          ? normalized.message
          : 'An unexpected error occurred',
      request_id: req.id
    }
  };

  if (normalized.details) {
    response.error.details = normalized.details;
  }

  if (statusCode >= 500) {
    console.error('Unexpected error', {
      requestId: req.id,
      message: error.message
    });
  }

  res.status(statusCode).json(response);
}

module.exports = {
  errorHandler,
  formatZodError
};

