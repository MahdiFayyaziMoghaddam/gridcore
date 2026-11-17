// ─────────────────────────────────────────────────────────────
// Typed API errors
// ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN')
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND')
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT')
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, 'RATE_LIMIT_EXCEEDED')
  }
}

export class ValidationError extends ApiError {
  constructor(errors: string[] | Record<string, unknown>) {
    super(400, 'Validation failed', 'VALIDATION_ERROR', { errors })
  }
}

export class FileTooLargeError extends ApiError {
  constructor(maxBytes: number) {
    super(413, `File exceeds ${maxBytes / 1024 / 1024}MB limit`, 'FILE_TOO_LARGE')
  }
}

export class SessionLimitError extends ApiError {
  constructor(max: number) {
    super(403, `Maximum ${max} saved sessions allowed`, 'SESSION_LIMIT_EXCEEDED')
  }
}

export class InternalError extends ApiError {
  constructor() {
    super(500, 'Internal server error', 'INTERNAL_ERROR')
  }
}