import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TransportResponse,
  createServiceTicket,
  exportNewestServiceTicketDetails,
  getNewestServiceTickets,
  getServiceTicketDetails,
  lookupByEmail,
  updateTicketLineItems,
} from "../src/index.js";
import { jsonResponse, makeClient } from "./helpers.js";

const originalDownloadTemplates = process.env.RM_TICKET_DOWNLOAD_ENDPOINT_TEMPLATES;

afterEach(() => {
  if (originalDownloadTemplates === undefined) {
    delete process.env.RM_TICKET_DOWNLOAD_ENDPOINT_TEMPLATES;
  } else {
    process.env.RM_TICKET_DOWNLOAD_ENDPOINT_TEMPLATES = originalDownloadTemplates;
  }
});

describe("email lookup workflow", () => {
  it("scans core resources recursively and deduplicates matches", async () => {
    const payloads: Record<string, unknown> = {
      "/Owners": [{ OwnerID: 1, Name: "Owner", Email: "owner@example.com" }],
      "/Tenants": [{ TenantID: 2, Name: "Tenant", Email: "other@example.com" }],
      "/Prospects": [{
        ProspectID: 3,
        Name: "Prospect",
        Contacts: [{ Email: "TARGET@example.com" }],
      }],
      "/Vendors": [{ VendorID: 4, Name: "Vendor", Email: "vendor@example.com" }],
      "/Contacts": [
        { ContactID: 9, ParentType: "Tenant", ParentID: 2, Email: "target@example.com" },
        { ContactID: 9, ParentType: "Tenant", ParentID: 2, Email: "target@example.com" },
      ],
    };
    const { client } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, payloads[new URL(request.url).pathname]);
    });

    const result = await lookupByEmail(client, "target@example.com");

    expect(result.sender_email).toBe("target@example.com");
    expect(result.total_matches).toBe(2);
    expect(result.matches.map((item) => item.entity)).toEqual(["Prospect", "Contact"]);
  });

  it("returns immediately for an empty address", async () => {
    expect(await lookupByEmail({} as never, "")).toEqual({
      sender_email: "",
      total_matches: 0,
      matches: [],
    });
  });
});

describe("service-ticket workflows", () => {
  it("sorts ticket pages by all supported creation-date fields", async () => {
    const { client } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, [
        { ServiceManagerIssueID: 1, Title: "middle", CreateDate: "2026-04-23T10:00:00Z" },
        { ServiceManagerIssueID: 2, Title: "newest", DateCreated: "2026-04-24T10:00:00Z" },
        { ServiceManagerIssueID: 3, Title: "issue date", IssueDate: "2026-04-23T11:00:00Z" },
        { ServiceManagerIssueID: 4, Title: "invalid", CreateDate: "not-a-date" },
      ]);
    });

    const tickets = await getNewestServiceTickets(client, { limit: 3, pageSize: 2 });
    expect(tickets.map((ticket) => ticket.Title)).toEqual(["newest", "issue date", "middle"]);
  });

  it("collects related records, billing rows, and linked documents", async () => {
    const seen: { path: string; params: Record<string, unknown> | null | undefined }[] = [];
    const { client } = makeClient((request) => {
      const requestPath = new URL(request.url).pathname;
      seen.push({ path: requestPath, params: request.params });
      if (requestPath === "/Authentication/AuthorizeUser") return jsonResponse(200, "token");
      if (requestPath === "/ServiceManagerIssues/60") {
        return jsonResponse(200, {
          ServiceManagerIssueID: 60,
          Title: "Billed detail",
          StatusID: 2,
          CategoryID: 8,
          PriorityID: 5,
          TenantID: 22,
          VendorID: 44,
          PropertyID: 10,
        });
      }
      if (requestPath.startsWith("/ServiceManagerIssues/60/")) return jsonResponse(200, []);
      if (requestPath === "/ServiceManagerIssueWorkOrders") {
        expect(request.params?.filters).toBe("ServiceManagerIssueID,eq,60");
        expect(request.params?.embed).toContain("PayeeAccount");
        return jsonResponse(200, [
          {
            ServiceManagerIssueWorkOrderID: 1,
            WorkOrderID: 101,
            ServiceManagerIssueID: 60,
            Description: "Tenant invoice labor",
            Quantity: 2,
            Cost: 25,
            Price: 80,
            HasInvoiceLink: true,
            InvoiceID: 500,
            InvoiceDetailID: 501,
            PayeeAccountID: 22,
          },
          {
            ServiceManagerIssueWorkOrderID: 2,
            WorkOrderID: 102,
            ServiceManagerIssueID: 60,
            Description: "Vendor bill parts",
            Quantity: 1,
            Cost: 40,
            Price: 0,
            HasVendorBillLink: true,
            VendorBillID: 700,
            PayeeAccountID: 44,
          },
          {
            ServiceManagerIssueWorkOrderID: 3,
            WorkOrderID: 103,
            ServiceManagerIssueID: 60,
            Description: "Not billed",
            Quantity: 1,
            Cost: 7,
            Price: 9,
          },
        ]);
      }
      const payloads: Record<string, unknown> = {
        "/ServiceManagerStatuses/2": { ServiceManagerStatusID: 2, Name: "New" },
        "/ServiceManagerCategories/8": { ServiceManagerCategoryID: 8, Name: "Property Wide" },
        "/ServiceManagerPriorities/5": { ServiceManagerPriorityID: 5, Name: "Low" },
        "/Tenants/22": { TenantID: 22, Name: "Resident" },
        "/Vendors/44": { VendorID: 44, Name: "Vendor" },
        "/Properties/10": { PropertyID: 10, Name: "Property" },
        "/Invoices/500": { InvoiceID: 500, TotalAmount: 80 },
        "/Bills/700": { ID: 700, Reference: "vendor bill" },
      };
      if (requestPath in payloads) return jsonResponse(200, payloads[requestPath]);
      return jsonResponse(404, { DeveloperMessage: `Unexpected ${requestPath}` });
    });

    const details = await getServiceTicketDetails(client, 60, {
      downloadAttachments: false,
    });

    expect(details.related.status).toMatchObject({ Name: "New" });
    expect(details.related.category).toMatchObject({ Name: "Property Wide" });
    expect(details.related.priority).toMatchObject({ Name: "Low" });
    expect(details.billing_rows.map((row) => row.billing_type))
      .toEqual(["tenant_invoice", "vendor_bill", "unbilled"]);
    expect(details.billing_summary).toMatchObject({
      row_count: 3,
      total_cost: 72,
      total_price: 89,
      unbilled_count: 1,
    });
    expect((details.billing_documents.invoices as Record<string, unknown>)["500"])
      .toMatchObject({ TotalAmount: 80 });
    expect((details.billing_documents.vendor_bills as Record<string, unknown>)["700"])
      .toMatchObject({ Reference: "vendor bill" });
    expect(seen.find((item) => item.path === "/ServiceManagerIssues/60")?.params)
      .toMatchObject({
        fields: expect.stringContaining("ServiceManagerIssueID"),
        embed: expect.stringContaining("Category"),
      });
  });

  it("exports private manifests and safely downloads duplicate attachment names", async () => {
    process.env.RM_TICKET_DOWNLOAD_ENDPOINT_TEMPLATES =
      "ServiceManagerIssues/{ticket_id}/Attachments/{file_id},ServiceManagerIssues/{ticket_id}/Files/{file_id}";
    const root = await mkdtemp(path.join(os.tmpdir(), "rm-ts-export-"));
    const { client } = makeClient((request) => {
      const requestPath = new URL(request.url).pathname;
      if (requestPath === "/Authentication/AuthorizeUser") return jsonResponse(200, "token");
      if (requestPath === "/ServiceManagerIssues") {
        return jsonResponse(200, [
          { ServiceManagerIssueID: 10, Title: "First", CreateDate: "2026-04-24T09:00:00Z" },
        ]);
      }
      if (requestPath === "/ServiceManagerIssues/10") {
        return jsonResponse(200, { ServiceManagerIssueID: 10, Title: "First detail" });
      }
      if (requestPath === "/ServiceManagerIssues/10/Attachments") {
        return jsonResponse(200, [
          { FileID: 500, FileName: "../invoice.pdf" },
          { FileID: 501, FileName: "invoice.pdf" },
        ]);
      }
      if (requestPath === "/ServiceManagerIssues/10/Attachments/500") {
        return new TransportResponse({ statusCode: 200, body: "first-pdf" });
      }
      if (requestPath === "/ServiceManagerIssues/10/Attachments/501") {
        return jsonResponse(404, { DeveloperMessage: "wrong attachment route" });
      }
      if (requestPath === "/ServiceManagerIssues/10/Files/501") {
        return new TransportResponse({ statusCode: 200, body: "second-pdf" });
      }
      if (requestPath.startsWith("/ServiceManagerIssues/10/")) return jsonResponse(200, []);
      if (requestPath === "/ServiceManagerIssueWorkOrders") return jsonResponse(200, []);
      return jsonResponse(404, { DeveloperMessage: `Unexpected ${requestPath}` });
    });

    const manifest = await exportNewestServiceTicketDetails(client, {
      limit: 1,
      exportRoot: root,
    });
    const exportDir = String(manifest.export_dir);
    const details = (manifest.tickets as Record<string, unknown>[])[0]?.details as {
      downloads: Record<string, unknown>[];
    };
    expect(manifest.ticket_count).toBe(1);
    expect(details.downloads.map((download) => download.ok)).toEqual([true, true]);
    expect(await readFile(path.join(exportDir, "ticket-10", "attachments", "invoice.pdf"), "utf8"))
      .toBe("first-pdf");
    expect(await readFile(path.join(exportDir, "ticket-10", "attachments", "invoice-2.pdf"), "utf8"))
      .toBe("second-pdf");
    expect(JSON.parse(await readFile(path.join(exportDir, "manifest.json"), "utf8")).ticket_count)
      .toBe(1);
  });

  it("records unsupported optional endpoints separately and uses embedded data", async () => {
    const unsupported = "No HTTP resource was found that matches the request URI.";
    const { client } = makeClient((request) => {
      const requestPath = new URL(request.url).pathname;
      if (requestPath === "/Authentication/AuthorizeUser") return jsonResponse(200, "token");
      if (requestPath === "/ServiceManagerIssues/30") {
        return jsonResponse(200, {
          ServiceManagerIssueID: 30,
          LineItems: [{ Description: "embedded labor" }],
        });
      }
      if ([
        "/ServiceManagerIssues/30/LineItems",
        "/ServiceManagerIssues/30/Attachments",
        "/ServiceManagerIssues/30/Files",
        "/ServiceManagerIssues/30/Documents",
      ].includes(requestPath)) {
        return new TransportResponse({ statusCode: 404, body: unsupported });
      }
      if (requestPath.startsWith("/ServiceManagerIssues/30/")) return jsonResponse(200, []);
      if (requestPath === "/ServiceManagerIssueWorkOrders") return jsonResponse(200, []);
      return jsonResponse(404, { DeveloperMessage: `Unexpected ${requestPath}` });
    });

    const details = await getServiceTicketDetails(client, 30, {
      downloadAttachments: false,
    });
    expect(details.errors).toEqual([]);
    expect(details.unavailable_endpoints).toHaveLength(4);
    expect(details.line_items).toEqual([{ Description: "embedded labor" }]);
  });

  it("creates tickets and updates line items through the specialized resource", async () => {
    const { client, transport } = makeClient((request) => {
      if (request.url.endsWith("/Authentication/AuthorizeUser")) return jsonResponse(200, "token");
      return jsonResponse(200, request.json);
    });

    await createServiceTicket(client, {
      title: "Leak",
      description: "Kitchen sink",
      propertyId: 10,
      lineItems: [{ Description: "Labor" }],
      extra: { PriorityID: 5 },
    });
    await updateTicketLineItems(client, {
      issueId: 44,
      lineItems: [{ Description: "Updated labor" }],
      note: "Approved",
    });

    expect(transport.requests[1]?.json).toEqual({
      Title: "Leak",
      Description: "Kitchen sink",
      IsClosed: false,
      PropertyID: 10,
      LineItems: [{ Description: "Labor" }],
      PriorityID: 5,
    });
    expect(new URL(transport.requests[2]?.url ?? "").pathname)
      .toBe("/ServiceManagerIssues/44");
    expect(transport.requests[2]?.json).toEqual({
      LineItems: [{ Description: "Updated labor" }],
      NoteText: "Approved",
    });
  });
});
