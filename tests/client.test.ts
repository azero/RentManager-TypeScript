import { describe, expect, it } from "vitest";
import {
  InMemoryTokenStore,
  Page,
  RentManagerClient,
  RentManagerNotFoundError,
  RentManagerTransportError,
  RQL,
  TransportResponse,
} from "../src/index.js";
import { jsonResponse, makeClient, MockTransport } from "./helpers.js";

describe("RentManagerClient", () => {
  it("authenticates, sends location and token, and coerces models", async () => {
    const { client, transport } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) {
        expect(request.json).toEqual({
          Username: "user",
          Password: "pass",
          LocationID: 7,
        });
        expect(request.headers?.["X-RM12Api-ApiToken"]).toBeUndefined();
        return jsonResponse(200, "token-123");
      }
      expect(request.headers?.["X-RM12Api-ApiToken"]).toBe("token-123");
      expect(request.params).toEqual({ fields: "TenantID,Name" });
      return jsonResponse(200, [{ TenantID: 1, Name: "Ada", NewServerField: "retained" }]);
    });

    const tenants = await client.tenants.list({ fields: ["TenantID", "Name"] });

    expect(tenants[0]?.TenantID).toBe(1);
    expect(tenants[0]?.NewServerField).toBe("retained");
    expect(transport.requests.map((request) => request.method)).toEqual(["POST", "GET"]);
  });

  it("accepts object and property names used by the Python package", () => {
    const transport = new MockTransport(() => jsonResponse(200, []));
    const tokenStore = new InMemoryTokenStore("token");
    const client = new RentManagerClient({
      corp_id: "sampleco",
      username: "user",
      password: "pass",
      location_id: 9,
      max_retries: 4,
      retry_backoff_seconds: 0.1,
      token_store: tokenStore,
      transport,
    });
    expect(client.corp_id).toBe("sampleco");
    expect(client.location_id).toBe(9);
    expect(client.max_retries).toBe(4);
    expect(client.retry_backoff_seconds).toBe(0.1);
    expect(client.token_store).toBe(tokenStore);
  });

  it("uses a cached token without an authentication request", async () => {
    const { client, transport } = makeClient((request) => {
      expect(request.headers?.["X-RM12Api-ApiToken"]).toBe("cached-token");
      return jsonResponse(200, [{ OwnerID: 3 }]);
    }, { token: "cached-token" });

    expect((await client.owners.list())[0]?.OwnerID).toBe(3);
    expect(transport.requests).toHaveLength(1);
  });

  it("reauthenticates exactly once after a 401", async () => {
    const tokens = ["old-token", "new-token"];
    const tenantTokens: (string | undefined)[] = [];
    const { client } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) {
        return jsonResponse(200, tokens.shift());
      }
      tenantTokens.push(request.headers?.["X-RM12Api-ApiToken"]);
      return tenantTokens.length === 1
        ? jsonResponse(401, { DeveloperMessage: "expired" })
        : jsonResponse(200, [{ TenantID: 2 }]);
    });

    expect((await client.tenants.list())[0]?.TenantID).toBe(2);
    expect(tenantTokens).toEqual(["old-token", "new-token"]);
  });

  it("maps API errors with structured context and redacts token URLs", async () => {
    const { client } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return new TransportResponse({
        statusCode: 404,
        body: JSON.stringify({
          DeveloperMessage: "Record not found",
          UserMessage: "Missing tenant",
        }),
        method: request.method,
        url: `${request.url}?token=secret`,
      });
    });

    const error = await client.tenants.get(999).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(RentManagerNotFoundError);
    expect(error).toMatchObject({
      statusCode: 404,
      developerMessage: "Record not found",
      userMessage: "Missing tenant",
    });
    expect((error as RentManagerNotFoundError).url).toContain("%5BREDACTED%5D");
    expect((error as RentManagerNotFoundError).url).not.toContain("secret");
  });

  it("retries transport and retryable status failures", async () => {
    let attempts = 0;
    const transport = new MockTransport((request) => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      if (attempts === 2) return jsonResponse(503, { DeveloperMessage: "busy" });
      return jsonResponse(200, "token-after-retry");
    });
    const client = new RentManagerClient({
      corpId: "sampleco",
      username: "user",
      password: "pass",
      transport,
      tokenStore: new InMemoryTokenStore(),
      maxRetries: 2,
      retryBackoffSeconds: 0,
    });

    expect(await client.authenticate({ force: true })).toBe("token-after-retry");
    expect(attempts).toBe(3);
  });

  it("wraps exhausted transport failures", async () => {
    const { client } = makeClient(() => {
      throw new Error("network down");
    }, { maxRetries: 1 });

    await expect(client.authenticate({ force: true }))
      .rejects.toBeInstanceOf(RentManagerTransportError);
  });

  it("supports auth helpers, generic methods, raw bytes, and 204 responses", async () => {
    const seen: string[] = [];
    const { client } = makeClient((request) => {
      const endpoint = new URL(request.url).pathname;
      seen.push(endpoint);
      if (endpoint === "/Authentication/AuthorizeToken") return new TransportResponse({
        statusCode: 200,
        body: "authorized",
      });
      if (endpoint === "/Authentication/ChangeLocation") return new TransportResponse({ statusCode: 204 });
      if (endpoint === "/Raw/Text") return new TransportResponse({ statusCode: 200, body: "plain text" });
      if (endpoint === "/Files/44") return new TransportResponse({
        statusCode: 200,
        body: new TextEncoder().encode("pdf-bytes"),
      });
      return jsonResponse(200, { ok: true });
    }, { token: "cached" });

    expect(await client.authorizeToken("external")).toBe("authorized");
    expect(await client.changeLocation(12)).toEqual({});
    expect(client.locationId).toBe(12);
    expect(await client.get("Raw/Text")).toBe("plain text");
    expect(await client.action("Actions/Run", { Run: true })).toEqual({ ok: true });
    expect(new TextDecoder().decode(await client.downloadBytes("Files/44"))).toBe("pdf-bytes");
    expect(seen).toContain("/Authentication/AuthorizeToken");
  });

  it("paginates and follows Link headers with a page limit", async () => {
    const { client } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      const pageNumber = Number(request.params?.pagenumber);
      return jsonResponse(
        200,
        pageNumber === 1 ? [{ TenantID: 1 }, { TenantID: 2 }] : [{ TenantID: 3 }],
        {
          "X-Total-Results": "3",
          Link: pageNumber === 1
            ? '<https://sampleco.api.rentmanager.com/Tenants?pagenumber=2>; rel="next"'
            : "",
        },
      );
    });

    const first = await client.paginate("Tenants", {
      pageNumber: 1,
      pageSize: 2,
      filters: RQL.eq("IsActive", true),
    });
    expect(first).toBeInstanceOf(Page);
    expect(first.totalResults).toBe(3);

    const pages: Page[] = [];
    for await (const page of client.iterPages("Tenants", {
      pageSize: 2,
      filters: RQL.eq("IsActive", true),
    })) pages.push(page);
    expect(pages.flatMap((page) => page.data).map((row) => (row as { TenantID: number }).TenantID))
      .toEqual([1, 2, 3]);

    const limited: Page[] = [];
    for await (const page of client.iterPages("Tenants", { pageSize: 2, maxPages: 1 })) {
      limited.push(page);
    }
    expect(limited).toHaveLength(1);
  });
});
