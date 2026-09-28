export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) =>
    new ApiError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Authentication is required.') =>
    new ApiError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You are not permitted to perform this action.') =>
    new ApiError(403, 'FORBIDDEN', message),
  notFound: (code: string, message: string) => new ApiError(404, code, message),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  unprocessable: (code: string, message: string, details?: unknown) =>
    new ApiError(422, code, message, details),
  tooMany: (message = 'Rate limit exceeded.') =>
    new ApiError(429, 'RATE_LIMIT_EXCEEDED', message),
  emailFailed: (message = 'The message could not be sent by email.') =>
    new ApiError(502, 'EMAIL_FAILED', message),
};
