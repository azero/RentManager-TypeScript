import { headersToRecord } from "./support.js";
import type { HeaderRecord } from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface TransportResponseInput {
  statusCode: number;
  body?: Uint8Array | ArrayBuffer | string;
  headers?: HeaderRecord | Headers;
  method?: string | null;
  url?: string | null;
  reasonPhrase?: string;
}

export class TransportResponse {
  readonly statusCode: number;
  readonly status_code: number;
  readonly body: Uint8Array;
  readonly headers: HeaderRecord;
  readonly method: string | null;
  readonly url: string | null;
  readonly reasonPhrase: string;
  readonly reason_phrase: string;

  constructor(input: TransportResponseInput) {
    this.statusCode = input.statusCode;
    this.status_code = input.statusCode;
    if (typeof input.body === "string") {
      this.body = encoder.encode(input.body);
    } else if (input.body instanceof ArrayBuffer) {
      this.body = new Uint8Array(input.body);
    } else {
      this.body = input.body ?? new Uint8Array();
    }
    this.headers = input.headers ? headersToRecord(input.headers) : {};
    this.method = input.method ?? null;
    this.url = input.url ?? null;
    this.reasonPhrase = input.reasonPhrase ?? "";
    this.reason_phrase = this.reasonPhrase;
  }

  get isError(): boolean {
    return this.statusCode >= 400;
  }

  get ok(): boolean {
    return !this.isError;
  }

  get text(): string {
    return decoder.decode(this.body);
  }

  json<T = unknown>(): T {
    return JSON.parse(this.text) as T;
  }

  header(name: string): string | undefined {
    const normalized = name.toLowerCase();
    return Object.entries(this.headers).find(([key]) => key.toLowerCase() === normalized)?.[1];
  }

  static json(
    statusCode: number,
    payload: unknown,
    input: Omit<TransportResponseInput, "statusCode" | "body"> = {},
  ): TransportResponse {
    const headers = new Headers(input.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new TransportResponse({
      ...input,
      statusCode,
      headers,
      body: JSON.stringify(payload),
    });
  }
}

/** PHP-compatible name for consumers porting mocks. */
export { TransportResponse as Response };
