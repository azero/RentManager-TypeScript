import { describe, expect, it } from "vitest";
import {
  Catalog,
  ENDPOINTS,
  EndpointRegistry,
  EndpointSpec,
  GENERATED_RESOURCE_DEFINITIONS,
  MODEL_CONSTRUCTORS,
  MODEL_FIELDS,
  MODULES,
  RESOURCE_SPECS,
} from "../src/index.js";
import { jsonResponse, makeClient } from "./helpers.js";

describe("resource facade", () => {
  it("calls every specialized path and exposes Python aliases", async () => {
    const { client, transport } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, []);
    });

    await client.contacts.list();
    await client.tenants.transactions(12);
    await client.tenants.recurring_charges(12);
    await client.tenants.addresses(12);
    await client.owners.owner_checks(3);
    await client.vendors.bills(4);
    await client.units.link_amenities(5, [8, 9]);
    await client.service_manager.issues.link_property(10, 77);
    await client.serviceManager.issues.history(10);
    await client.serviceManager.priorities.get(5);
    await client.report_writer_reports.run(218);
    await client.recurringCharges.post_recurring_charges({ PostDate: "2026-04-23" });

    const calls = transport.requests
      .filter((request) => !request.url.endsWith("/Authentication/AuthorizeUser"))
      .map((request) => ({
        method: request.method,
        path: new URL(request.url).pathname,
        params: request.params,
        json: request.json,
      }));
    expect(calls).toEqual([
      { method: "GET", path: "/Contacts", params: {}, json: undefined },
      { method: "GET", path: "/Tenants/12/Transactions", params: {}, json: undefined },
      { method: "GET", path: "/Tenants/12/RecurringCharges", params: {}, json: undefined },
      { method: "GET", path: "/Tenants/12/Addresses", params: {}, json: undefined },
      { method: "GET", path: "/Owners/3/OwnerChecks", params: {}, json: undefined },
      { method: "GET", path: "/Vendors/4/Bills", params: {}, json: undefined },
      { method: "POST", path: "/Units/5/LinkAmenities", params: {}, json: [8, 9] },
      {
        method: "POST",
        path: "/ServiceManagerIssues/10/LinkProperty",
        params: { propertyID: 77 },
        json: undefined,
      },
      { method: "GET", path: "/ServiceManagerIssues/10/History", params: {}, json: undefined },
      { method: "GET", path: "/ServiceManagerPriorities/5", params: {}, json: undefined },
      {
        method: "GET",
        path: "/ReportWriterReports/218/RunReportWriterReport",
        params: {},
        json: undefined,
      },
      {
        method: "POST",
        path: "/RecurringCharges/PostRecurringCharges",
        params: {},
        json: { PostDate: "2026-04-23" },
      },
    ]);
  });

  it("supports inherited create, update, delete-one, and delete-many methods", async () => {
    const { client, transport } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, []);
    });
    await client.contacts.create({ Name: "Ada" });
    await client.contacts.update(123, { Name: "Ada Updated" });
    await client.contacts.delete(123);
    await client.contacts.deleteMany([123, 124]);

    const calls = transport.requests.slice(1).map((request) => [
      request.method,
      new URL(request.url).pathname,
      request.json,
    ]);
    expect(calls).toEqual([
      ["POST", "/Contacts", { Name: "Ada" }],
      ["POST", "/Contacts/123", { Name: "Ada Updated" }],
      ["DELETE", "/Contacts/123", undefined],
      ["DELETE", "/Contacts", [123, 124]],
    ]);
  });

  it("constructs multipart payload descriptions for specialized uploads", async () => {
    const { client, transport } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, { uploaded: true });
    });
    await client.tenants.uploadUserDefinedValueAttachment(
      2,
      9,
      new TextEncoder().encode("file"),
      "note.txt",
      { Note: "hello" },
    );
    await client.serviceManager.issues.uploadSignatureFile(7, {
      file: ["sig.png", new Uint8Array([1, 2]), "image/png"],
    });

    expect(transport.requests[1]?.files).toMatchObject({
      file: ["note.txt", expect.any(Uint8Array)],
      udf: [null, expect.stringContaining('"ParentID":2'), "application/json"],
    });
    expect(new URL(transport.requests[2]?.url ?? "").pathname)
      .toBe("/ServiceManagerIssues/7/UploadSignatureFile");
  });
});

describe("generated catalog", () => {
  it("preserves the full source counts and generated constructors", () => {
    expect(RESOURCE_SPECS).toHaveLength(338);
    expect(GENERATED_RESOURCE_DEFINITIONS).toHaveLength(338);
    expect(Object.keys(MODEL_FIELDS)).toHaveLength(361);
    expect(Object.keys(MODEL_CONSTRUCTORS)).toHaveLength(360);
    expect(ENDPOINTS).toHaveLength(1_579);
    expect(Object.keys(MODULES)).toHaveLength(9);
    expect(Catalog.data().modules).toBe(MODULES);
    expect(Catalog.resourceSpecs()).toBe(RESOURCE_SPECS);
  });

  it("supports permissive model construction and compatibility serializers", () => {
    const owner = MODEL_CONSTRUCTORS.Owner.from({
      OwnerID: 4,
      FutureField: { enabled: true },
    });
    expect(owner.OwnerID).toBe(4);
    expect(owner.FutureField).toEqual({ enabled: true });
    expect(owner.toArray()).toEqual(owner.model_dump());
    expect(JSON.parse(JSON.stringify(owner))).toEqual(owner.toArray());
  });

  it("attaches every generated resource in camelCase and snake_case", () => {
    const { client } = makeClient(() => jsonResponse(200, []), { token: "token" });
    expect(client.accountGroupMasterPayments)
      .toBe(client.account_group_master_payments);
    for (const definition of GENERATED_RESOURCE_DEFINITIONS) {
      const record = client as unknown as Record<string, unknown>;
      expect(record[definition.clientAttr]).toBeDefined();
      expect(record[definition.camelAttr]).toBe(record[definition.clientAttr]);
      expect(client.resource(definition.clientAttr)).toBe(record[definition.clientAttr]);
    }
  });

  it("reports registry coverage and validates confidence values", () => {
    const registry = EndpointRegistry.default();
    expect([...registry]).toHaveLength(1_579);
    const paths = new Set(registry.coverageReport().map((item) => `${item.method} ${item.path}`));
    expect(paths).toContain("GET /Tenants/{id}/Transactions");
    expect(paths).toContain("POST /ServiceManagerIssues/{id}/LinkProperty");
    expect(paths).toContain("POST /RecurringCharges/PostRecurringCharges");

    expect(() => new EndpointSpec({
      method: "GET",
      path: "/Example",
      model: "Example",
      confidence: "guessed" as never,
      source: "test",
    })).toThrow(/confidence/);
  });
});
