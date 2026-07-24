import { TransportResponse } from "./response.js";
import { redactSensitiveUrl } from "./support.js";
import type { HeaderRecord } from "./types.js";

export interface ErrorModelInput {
  developerMessage?: string | null;
  userMessage?: string | null;
  message?: string | null;
  details?: unknown;
}

export class ErrorModel {
  readonly developerMessage: string | null;
  readonly developer_message: string | null;
  readonly userMessage: string | null;
  readonly user_message: string | null;
  readonly message: string | null;
  readonly details: unknown;

  constructor(input: ErrorModelInput = {}) {
    this.developerMessage = input.developerMessage ?? null;
    this.developer_message = this.developerMessage;
    this.userMessage = input.userMessage ?? null;
    this.user_message = this.userMessage;
    this.message = input.message ?? null;
    this.details = input.details;
  }
}

export interface RentManagerErrorOptions {
  statusCode?: number | null;
  method?: string | null;
  url?: string | null;
  details?: unknown;
  developerMessage?: string | null;
  userMessage?: string | null;
  responseHeaders?: HeaderRecord;
  cause?: unknown;
}

export class RentManagerAPIError extends Error {
  readonly statusCode: number | null;
  readonly status_code: number | null;
  readonly method: string | null;
  readonly url: string | null;
  readonly details: unknown;
  readonly developerMessage: string | null;
  readonly developer_message: string | null;
  readonly userMessage: string | null;
  readonly user_message: string | null;
  readonly responseHeaders: HeaderRecord;
  readonly response_headers: HeaderRecord;

  constructor(message: string, options: RentManagerErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = options.statusCode ?? null;
    this.status_code = this.statusCode;
    this.method = options.method ?? null;
    this.url = redactSensitiveUrl(options.url) ?? null;
    this.details = options.details;
    this.developerMessage = options.developerMessage ?? null;
    this.developer_message = this.developerMessage;
    this.userMessage = options.userMessage ?? null;
    this.user_message = this.userMessage;
    this.responseHeaders = options.responseHeaders ?? {};
    this.response_headers = this.responseHeaders;
  }
}

export class RentManagerBadRequestError extends RentManagerAPIError {}
export class RentManagerAuthError extends RentManagerAPIError {}
export class RentManagerPermissionError extends RentManagerAPIError {}
export class RentManagerNotFoundError extends RentManagerAPIError {}
export class RentManagerConflictError extends RentManagerAPIError {}
export class RentManagerPreconditionError extends RentManagerAPIError {}
export class RentManagerRateLimitError extends RentManagerAPIError {}
export class RentManagerServerError extends RentManagerAPIError {}
export class RentManagerTransportError extends RentManagerAPIError {}

type ErrorConstructor = new (message: string, options?: RentManagerErrorOptions) => RentManagerAPIError;

const STATUS_ERROR_MAP = new Map<number, ErrorConstructor>([
  [400, RentManagerBadRequestError],
  [401, RentManagerAuthError],
  [403, RentManagerPermissionError],
  [404, RentManagerNotFoundError],
  [409, RentManagerConflictError],
  [412, RentManagerPreconditionError],
  [429, RentManagerRateLimitError],
]);

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseErrorModel(response: TransportResponse): ErrorModel {
  const text = response.text.trim();
  let payload: unknown;
  try {
    payload = response.json();
  } catch {
    return new ErrorModel({ message: text || response.reasonPhrase || null });
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return new ErrorModel({ message: typeof payload === "string" ? payload : JSON.stringify(payload) });
  }
  const record = payload as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === "object" && !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : record;
  return new ErrorModel({
    developerMessage: stringValue(nested.DeveloperMessage) ?? stringValue(nested.developerMessage),
    userMessage: stringValue(nested.UserMessage) ?? stringValue(nested.userMessage),
    message:
      stringValue(nested.Message) ??
      stringValue(nested.message) ??
      stringValue(nested.error),
    details: payload,
  });
}

export const parse_error_model = parseErrorModel;

export function errorFromResponse(response: TransportResponse): RentManagerAPIError {
  const model = parseErrorModel(response);
  const ErrorClass =
    STATUS_ERROR_MAP.get(response.statusCode) ??
    (response.statusCode >= 500 ? RentManagerServerError : RentManagerAPIError);
  const message =
    model.developerMessage ??
    model.userMessage ??
    model.message ??
    response.reasonPhrase ??
    `Rent Manager API request failed with status ${response.statusCode}`;
  return new ErrorClass(message || `Rent Manager API request failed with status ${response.statusCode}`, {
    statusCode: response.statusCode,
    method: response.method,
    url: response.url,
    details: model.details,
    developerMessage: model.developerMessage,
    userMessage: model.userMessage,
    responseHeaders: response.headers,
  });
}

export const error_from_response = errorFromResponse;

export class ErrorFactory {
  static parseErrorModel = parseErrorModel;
  static fromResponse = errorFromResponse;
}
