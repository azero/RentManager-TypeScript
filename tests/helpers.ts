import {
  InMemoryTokenStore,
  RentManagerClient,
  TransportResponse,
  type Transport,
  type TransportRequest,
} from "../src/index.js";

export type MockHandler = (
  request: TransportRequest,
  attempt: number,
) => TransportResponse | Promise<TransportResponse>;

export class MockTransport implements Transport {
  readonly requests: TransportRequest[] = [];
  readonly handler: MockHandler;

  constructor(handler: MockHandler) {
    this.handler = handler;
  }

  async request(request: TransportRequest): Promise<TransportResponse> {
    this.requests.push(request);
    return this.handler(request, this.requests.length);
  }
}

export function jsonResponse(
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {},
): TransportResponse {
  return TransportResponse.json(statusCode, payload, { headers });
}

export function makeClient(
  handler: MockHandler,
  options: {
    token?: string | null;
    maxRetries?: number;
    retryBackoffSeconds?: number;
  } = {},
): { client: RentManagerClient; transport: MockTransport } {
  const transport = new MockTransport(handler);
  const client = new RentManagerClient({
    corpId: "sampleco",
    username: "user",
    password: "pass",
    locationId: 7,
    transport,
    tokenStore: new InMemoryTokenStore(options.token ?? null),
    maxRetries: options.maxRetries ?? 0,
    retryBackoffSeconds: options.retryBackoffSeconds ?? 0,
  });
  return { client, transport };
}
