import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FetchTransport,
  FileTokenStore,
  RentManagerAuthError,
  RentManagerServerError,
  TransportResponse,
  errorFromResponse,
  parseErrorModel,
} from "../src/index.js";

describe("errors", () => {
  it("parses text, nested JSON, and status mappings", () => {
    const text = new TransportResponse({
      statusCode: 500,
      body: "server exploded",
      method: "GET",
      url: "https://x.test",
    });
    expect(parseErrorModel(text).message).toBe("server exploded");
    expect(errorFromResponse(text)).toBeInstanceOf(RentManagerServerError);

    const nested = TransportResponse.json(401, {
      error: { message: "nested auth failure" },
    }, {
      method: "GET",
      url: "https://x.test/private",
    });
    const error = errorFromResponse(nested);
    expect(error).toBeInstanceOf(RentManagerAuthError);
    expect(error.message).toBe("nested auth failure");
    expect(error.method).toBe("GET");
  });
});

describe("FileTokenStore", () => {
  it("round-trips, ignores invalid content, and clears idempotently", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "rm-ts-token-"));
    const filePath = path.join(directory, "nested", "token.json");
    const store = new FileTokenStore(filePath);
    expect(await store.load()).toBeNull();
    await store.save("abc");
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({ token: "abc" });
    expect(await store.load()).toBe("abc");
    await store.clear();
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("FetchTransport", () => {
  it("serializes params, JSON, and response metadata", async () => {
    let seen: Request | undefined;
    const transport = new FetchTransport(async (input, init) => {
      seen = new Request(input, init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        statusText: "Created",
        headers: { "x-test": "yes" },
      });
    });
    const response = await transport.request({
      method: "POST",
      url: "https://example.test/items",
      params: { page: 2, enabled: true },
      headers: { Accept: "application/json" },
      json: { Name: "Ada" },
    });

    expect(seen?.url).toBe("https://example.test/items?page=2&enabled=true");
    expect(await seen?.json()).toEqual({ Name: "Ada" });
    expect(response.statusCode).toBe(201);
    expect(response.reasonPhrase).toBe("Created");
    expect(response.json()).toEqual({ ok: true });
  });

  it("builds multipart FormData without a fixed content-type header", async () => {
    let seen: Request | undefined;
    const transport = new FetchTransport(async (input, init) => {
      seen = new Request(input, init);
      return new Response("{}", { status: 200 });
    });
    await transport.request({
      method: "POST",
      url: "https://example.test/upload",
      headers: { "Content-Type": "application/json" },
      files: {
        file: ["note.txt", "hello", "text/plain"],
        metadata: [null, '{"id":1}', "application/json"],
      },
      data: { category: "notes" },
    });

    expect(seen?.headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
    const form = await seen?.formData();
    expect(form?.get("category")).toBe("notes");
    expect(form?.get("metadata")).toBe('{"id":1}');
    expect((form?.get("file") as File).name).toBe("note.txt");
  });
});
