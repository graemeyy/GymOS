export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "password_change_required"
  | "email_unverified"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "not_configured"
  | "upstream_failed"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  password_change_required: 403,
  email_unverified: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  not_configured: 503,
  upstream_failed: 502,
  internal: 500,
};

// Thrown from route logic; the route wrapper turns it into a JSON response
// with a message that is safe to show a user.
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }
}

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
}
