import { v4 as uuid } from 'uuid';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Access denied') {
    super(msg, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/* Wraps async route handlers so errors propagate to next() */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* Add correlation ID to every request */
export const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuid();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/* Structured JSON logger */
export const structuredLog = (level, message, meta = {}) => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
};

/* Global error handler — must be registered last in app.js */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const requestId = req.requestId || 'unknown';

  /* Known application errors */
  if (err instanceof AppError) {
    structuredLog('warn', err.message, {
      code: err.code,
      statusCode: err.statusCode,
      requestId,
      path: req.path,
    });
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
      requestId,
    });
  }

  /* Legacy code paths that throw with err.code string */
  if (err.code === 'FORBIDDEN') {
    return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN', requestId });
  }
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND', requestId });
  }
  if (err.code === 'INVALID_STATUS') {
    return res.status(400).json({ error: 'Invalid status value', code: 'INVALID_STATUS', requestId });
  }

  /* Multer errors */
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large', code: 'FILE_TOO_LARGE', requestId });
  }

  /* Unexpected errors */
  structuredLog('error', err.message || 'Unhandled error', {
    requestId,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  });
};
