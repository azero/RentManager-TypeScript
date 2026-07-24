import { TransportResponse } from "./response.js";
import type {
  BinaryBody,
  HeaderRecord,
  MultipartFiles,
  MultipartPart,
  MultipartTuple,
  MultipartValue,
  QueryRecord,
} from "./types.js";

export interface TransportRequest {
  method: string;
  url: string;
  headers?: HeaderRecord;
  params?: QueryRecord | null;
  json?: unknown;
  data?: unknown;
  files?: MultipartFiles | null;
  timeoutMs?: number;
  signal?: AbortSignal | null;
}

export interface Transport {
  request(request: TransportRequest): Promise<TransportResponse>;
  close?(): void | Promise<void>;
}

function appendParams(url: URL, params: QueryRecord | null | undefined): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined) url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
    }
  }
}

function withoutContentType(headers: Headers): void {
  for (const key of [...headers.keys()]) {
    if (key.toLowerCase() === "content-type") headers.delete(key);
  }
}

function binaryToBlob(body: BinaryBody, contentType?: string): Blob {
  if (body instanceof Blob) return body;
  if (typeof body === "string") return new Blob([body], contentType ? { type: contentType } : undefined);
  if (body instanceof ArrayBuffer) {
    return new Blob([body], contentType ? { type: contentType } : undefined);
  }
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  return new Blob([bytes.buffer], contentType ? { type: contentType } : undefined);
}

function isBinaryBody(value: unknown): value is BinaryBody {
  return (
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

function isMultipartTuple(value: unknown): value is MultipartTuple {
  return (
    Array.isArray(value) &&
    (value.length === 2 || value.length === 3) &&
    (typeof value[0] === "string" || value[0] === null) &&
    isBinaryBody(value[1]) &&
    (value.length === 2 || typeof value[2] === "string")
  );
}

function isMultipartPart(value: MultipartValue): value is MultipartPart {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Blob) &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value) &&
    "body" in value
  );
}

function appendPart(form: FormData, name: string, value: MultipartValue): void {
  if (isMultipartTuple(value)) {
    const [filename, body, contentType] = value;
    if (filename === null && typeof body === "string") {
      form.append(name, body);
    } else {
      form.append(name, binaryToBlob(body, contentType), filename ?? "blob");
    }
    return;
  }
  if (isMultipartPart(value)) {
    if (value.filename === null && typeof value.body === "string") {
      form.append(name, value.body);
    } else {
      form.append(name, binaryToBlob(value.body, value.contentType), value.filename ?? "blob");
    }
    return;
  }
  if (typeof value === "string") {
    form.append(name, value);
  } else {
    form.append(name, binaryToBlob(value));
  }
}

function multipartBody(files: MultipartFiles, data: unknown): FormData {
  const form = files instanceof FormData ? files : new FormData();
  if (!(files instanceof FormData)) {
    for (const [name, rawValue] of Object.entries(files)) {
      const values =
        Array.isArray(rawValue) && !isMultipartTuple(rawValue)
          ? (rawValue as readonly MultipartValue[])
          : [rawValue as MultipartValue];
      for (const value of values) appendPart(form, name, value);
    }
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [name, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== null && value !== undefined) form.append(name, String(value));
    }
  }
  return form;
}

function requestBody(
  request: TransportRequest,
  headers: Headers,
): BodyInit | null | undefined {
  if (request.files) {
    withoutContentType(headers);
    return multipartBody(request.files, request.data);
  }
  if (request.json !== undefined && request.json !== null) {
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return JSON.stringify(request.json);
  }
  if (request.data === undefined || request.data === null) return undefined;
  if (
    typeof request.data === "string" ||
    request.data instanceof Blob ||
    request.data instanceof ArrayBuffer ||
    ArrayBuffer.isView(request.data) ||
    request.data instanceof URLSearchParams
  ) {
    return request.data as BodyInit;
  }
  if (typeof request.data === "object") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/x-www-form-urlencoded");
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(request.data as Record<string, unknown>)) {
      if (value !== null && value !== undefined) body.set(key, String(value));
    }
    return body;
  }
  return String(request.data);
}

export class FetchTransport implements Transport {
  readonly fetch: typeof globalThis.fetch;

  constructor(fetchImplementation: typeof globalThis.fetch = globalThis.fetch) {
    if (typeof fetchImplementation !== "function") {
      throw new TypeError("A Fetch API implementation is required.");
    }
    this.fetch = fetchImplementation;
  }

  async request(request: TransportRequest): Promise<TransportResponse> {
    const url = new URL(request.url);
    appendParams(url, request.params);
    const headers = new Headers(request.headers);
    const controller = new AbortController();
    const timeoutMs = Math.max(0, request.timeoutMs ?? 15_000);
    const timeout = timeoutMs > 0
      ? setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`)), timeoutMs)
      : undefined;
    const forwardAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", forwardAbort, { once: true });

    try {
      const body = requestBody(request, headers);
      const response = await this.fetch(url, {
        method: request.method.toUpperCase(),
        headers,
        signal: controller.signal,
        ...(body !== undefined ? { body } : {}),
      });
      return new TransportResponse({
        statusCode: response.status,
        body: new Uint8Array(await response.arrayBuffer()),
        headers: response.headers,
        method: request.method.toUpperCase(),
        url: url.toString(),
        reasonPhrase: response.statusText,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
      request.signal?.removeEventListener("abort", forwardAbort);
    }
  }
}
