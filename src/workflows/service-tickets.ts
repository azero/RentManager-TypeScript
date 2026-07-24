import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { RentManagerAPIError } from "../errors.js";
import type { Page } from "../pagination.js";
import { RQL } from "../query.js";
import type { IterPagesOptions, ServiceManagerNamespace } from "../resource.js";
import type { QueryRecord } from "../types.js";

type Row = Record<string, unknown>;

export interface ServiceTicketClient {
  get<T = unknown>(endpoint: string, query?: QueryRecord, params?: QueryRecord): Promise<T>;
  downloadBytes(endpoint: string): Promise<Uint8Array>;
  iterPages<T = unknown>(endpoint: string, options?: IterPagesOptions): AsyncIterable<Page<T>>;
  serviceManager: ServiceManagerNamespace;
}

export const SERVICE_TICKET_FIELDS = [
  "ServiceManagerIssueID", "IssueID", "TicketID", "Title", "IsClosed", "StatusID",
  "CategoryID", "CreateDate", "DateCreated", "IssueDate", "UpdateDate",
] as const;

export const ISSUE_DETAIL_FIELDS = [
  "ServiceManagerIssueID", "Title", "Description", "Resolution", "CustomerDescription",
  "NoteText", "CategoryID", "Category", "StatusID", "Status", "PriorityID", "Priority",
  "PayeeAccountID", "PayeeAccount", "VendorID", "Vendor", "AssignedToUserID",
  "AssignedToUser", "CreateUserID", "CreateUser", "UpdateUserID", "UpdateUser",
  "PropertyID", "Property", "UnitID", "Unit", "TenantID", "Tenant", "History",
  "Properties", "WorkOrders", "ServiceManagerIssueWorkOrders", "LineItems",
  "ServiceLineItems", "Items", "Attachments", "Files", "Documents", "UserDefinedValues",
  "UserDefinedFields", "AssignedOpenDate", "DueDate", "IsRead", "CreateDate",
  "UpdateDate", "Age",
] as const;

export const ISSUE_DETAIL_EMBEDS = [
  "Category", "Status", "Priority", "PayeeAccount", "Vendor", "AssignedToUser",
  "CreateUser", "UpdateUser", "Property", "Unit", "Tenant", "History", "Properties",
  "WorkOrders", "ServiceManagerIssueWorkOrders", "LineItems", "ServiceLineItems",
  "Items", "Attachments", "Files", "Documents", "UserDefinedValues", "UserDefinedFields",
] as const;

const DETAIL_ENDPOINTS = {
  history: "ServiceManagerIssues/{ticket_id}/History",
  properties: "ServiceManagerIssues/{ticket_id}/Properties",
  line_items: "ServiceManagerIssues/{ticket_id}/LineItems",
  attachments: "ServiceManagerIssues/{ticket_id}/Attachments",
  files: "ServiceManagerIssues/{ticket_id}/Files",
  documents: "ServiceManagerIssues/{ticket_id}/Documents",
  user_defined_values: "ServiceManagerIssues/{ticket_id}/UserDefinedValues",
  user_defined_fields: "ServiceManagerIssues/{ticket_id}/UserDefinedFields",
} as const;

const WORK_ORDER_FIELDS = [
  "ServiceManagerIssueWorkOrderID", "WorkOrderID", "ServiceManagerIssueID",
  "HasInvoiceLink", "InvoiceID", "InvoiceDetailID", "HasVendorBillLink", "VendorBillID",
  "HasOwnerBillLink", "OwnerBillID", "PayeeAccountID", "PropertyID", "UnitID",
  "TenantID", "VendorID", "OwnerID", "AccountID", "JobID", "Description", "Quantity",
  "Cost", "Price", "InventoryItemID", "HasPurchaseOrderLink", "PurchaseOrderID",
  "SmartReceiptID", "QuickBillID", "CreateDate", "CreateUserID", "UpdateDate",
  "UpdateUserID", "MetaTag",
] as const;

const WORK_ORDER_EMBEDS = [
  "PayeeAccount", "Property", "Unit", "Tenant", "Vendor", "Owner", "Job", "InventoryItem",
] as const;

export const DEFAULT_DOWNLOAD_ENDPOINT_TEMPLATES = [
  "ServiceManagerIssues/{ticket_id}/Attachments/{file_id}",
  "ServiceManagerIssues/{ticket_id}/Files/{file_id}",
  "ServiceManagerIssues/{ticket_id}/Documents/{file_id}",
  "Files/{file_id}",
  "Documents/{file_id}",
] as const;

const FILE_ID_KEYS = [
  "FileID", "FileId", "fileID", "fileId", "AttachmentID", "AttachmentId",
  "DocumentID", "DocumentId", "ID", "Id",
] as const;
const FILENAME_KEYS = ["FileName", "Filename", "Name", "DocumentName", "Title"] as const;
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const MIN_DATE = new Date(-8_640_000_000_000_000);

export interface NewestTicketOptions {
  limit?: number;
  pageSize?: number;
  page_size?: number;
  maxPages?: number | null;
  max_pages?: number | null;
}

export function parseTicketDateTime(value: unknown): Date {
  if (value === null || value === undefined || value === "") return new Date(MIN_DATE);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(MIN_DATE) : value;
  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? new Date(MIN_DATE) : parsed;
}

export const parse_ticket_datetime = parseTicketDateTime;

export function ticketCreatedAt(ticket: Row): Date {
  return new Date(Math.max(
    parseTicketDateTime(ticket.CreateDate).getTime(),
    parseTicketDateTime(ticket.DateCreated).getTime(),
    parseTicketDateTime(ticket.IssueDate).getTime(),
  ));
}

export const ticket_created_at = ticketCreatedAt;

export async function getNewestServiceTickets(
  client: ServiceTicketClient,
  options: NewestTicketOptions = {},
): Promise<Row[]> {
  const pageSize = options.pageSize ?? options.page_size ?? 1_000;
  const maxPages = options.maxPages ?? options.max_pages ?? null;
  const tickets: Row[] = [];
  for await (const page of client.iterPages("ServiceManagerIssues", {
    fields: SERVICE_TICKET_FIELDS,
    pageSize,
    maxPages,
  })) {
    for (const value of page.data) {
      const row = asRow(value);
      if (row) tickets.push(row);
    }
  }
  const limit = Math.max(0, Math.trunc(options.limit ?? 5));
  return tickets.sort((left, right) =>
    ticketCreatedAt(right).getTime() - ticketCreatedAt(left).getTime()
  ).slice(0, limit);
}

export const get_newest_service_tickets = getNewestServiceTickets;

export interface TicketDetailOptions {
  exportDir?: string | null;
  export_dir?: string | null;
  downloadAttachments?: boolean;
  download_attachments?: boolean;
}

export interface TicketDetails extends Row {
  ticket_id: number | string;
  issue: unknown;
  history: unknown[] | Row;
  properties: unknown[] | Row;
  work_orders: unknown[];
  line_items: unknown[] | Row;
  attachments: unknown[] | Row;
  files: unknown[] | Row;
  documents: unknown[] | Row;
  user_defined_values: unknown[] | Row;
  user_defined_fields: unknown[] | Row;
  related: Row;
  billing_rows: Row[];
  billing_summary: Row;
  billing_documents: Record<string, Row>;
  downloads: Row[];
  errors: Row[];
  unavailable_endpoints: Row[];
}

export async function getServiceTicketDetails(
  client: ServiceTicketClient,
  issueId: string | number | bigint,
  options: TicketDetailOptions = {},
): Promise<TicketDetails> {
  const ticketId = String(issueId).trim();
  const exportDir = options.exportDir ?? options.export_dir ?? null;
  const downloadAttachments =
    options.downloadAttachments ?? options.download_attachments ?? true;
  const errors: Row[] = [];
  const unavailableEndpoints: Row[] = [];
  const details: TicketDetails = {
    ticket_id: parseInteger(ticketId) ?? ticketId,
    issue: null,
    history: [],
    properties: [],
    work_orders: [],
    line_items: [],
    attachments: [],
    files: [],
    documents: [],
    user_defined_values: [],
    user_defined_fields: [],
    related: {},
    billing_rows: [],
    billing_summary: billingSummary([]),
    billing_documents: emptyBillingDocuments(),
    downloads: [],
    errors,
    unavailable_endpoints: unavailableEndpoints,
  };

  const issueEndpoint = `ServiceManagerIssues/${ticketId}`;
  details.issue = await safeGet(client, issueEndpoint, errors, {
    params: {
      fields: ISSUE_DETAIL_FIELDS.join(","),
      embed: ISSUE_DETAIL_EMBEDS.join(","),
    },
  });
  if (details.issue === null) {
    details.issue = await safeGet(client, issueEndpoint, errors);
  }

  for (const [key, template] of Object.entries(DETAIL_ENDPOINTS)) {
    const endpoint = template.replace("{ticket_id}", ticketId);
    details[key] = collectionPayload(
      await safeGet(client, endpoint, errors, {
        unavailableEndpoints,
        defaultValue: [],
      }),
    );
  }

  details.work_orders = collectionList(
    await safeGet(client, "ServiceManagerIssueWorkOrders", errors, {
      unavailableEndpoints,
      defaultValue: [],
      params: {
        filters: RQL.eq("ServiceManagerIssueID", parseInteger(ticketId) ?? ticketId),
        fields: WORK_ORDER_FIELDS.join(","),
        embed: WORK_ORDER_EMBEDS.join(","),
      },
    }),
  );

  applyEmbeddedIssueDetails(details);
  await resolveRelatedResources(client, details, errors, unavailableEndpoints);
  await applyBillingOverview(client, details, errors, unavailableEndpoints);

  if (downloadAttachments && exportDir !== null) {
    const attachmentsDir = path.join(exportDir, "attachments");
    for (const row of attachmentRows(details)) {
      details.downloads.push(await downloadAttachment(client, ticketId, row, attachmentsDir));
    }
  }
  if (exportDir !== null) {
    await privateDirectory(exportDir);
    await writePrivateJson(path.join(exportDir, "details.json"), details);
  }
  return details;
}

export const get_service_ticket_details = getServiceTicketDetails;

interface SafeGetOptions {
  params?: QueryRecord;
  unavailableEndpoints?: Row[];
  defaultValue?: unknown;
}

async function safeGet(
  client: ServiceTicketClient,
  endpoint: string,
  errors: Row[],
  options: SafeGetOptions = {},
): Promise<unknown> {
  try {
    return jsonable(await client.get(endpoint, {}, options.params ?? {}));
  } catch (error) {
    if (!(error instanceof RentManagerAPIError)) throw error;
    if (options.unavailableEndpoints && isUnsupportedEndpoint(error)) {
      options.unavailableEndpoints.push(errorRecord(endpoint, error));
      return options.defaultValue ?? null;
    }
    errors.push(errorRecord(endpoint, error));
    return options.defaultValue ?? null;
  }
}

function applyEmbeddedIssueDetails(details: TicketDetails): void {
  const issue = asRow(details.issue);
  if (!issue) return;
  const embeddedKeys: Record<string, readonly string[]> = {
    work_orders: ["WorkOrders", "ServiceManagerIssueWorkOrders", "IssueWorkOrders"],
    line_items: ["LineItems", "ServiceLineItems", "Items"],
    attachments: ["Attachments", "Attachment", "IssueAttachments"],
    files: ["Files", "IssueFiles"],
    documents: ["Documents", "IssueDocuments"],
    user_defined_values: ["UserDefinedValues"],
    user_defined_fields: ["UserDefinedFields"],
  };
  for (const [detailKey, issueKeys] of Object.entries(embeddedKeys)) {
    const current = details[detailKey];
    if (
      (Array.isArray(current) && current.length > 0) ||
      (!Array.isArray(current) && current !== null && current !== undefined)
    ) continue;
    for (const issueKey of issueKeys) {
      const embedded = issue[issueKey];
      if (!embedded) continue;
      details[detailKey] = detailKey === "work_orders"
        ? collectionList(embedded)
        : jsonable(embedded);
      break;
    }
  }
}

function collectionPayload(value: unknown): unknown[] | Row {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  const row = asRow(value);
  return row && Object.keys(row).length === 0 ? [] : (row ?? []);
}

function collectionList(value: unknown): unknown[] {
  const normalized = collectionPayload(jsonable(value));
  return Array.isArray(normalized) ? normalized : [normalized];
}

async function resolveRelatedResources(
  client: ServiceTicketClient,
  details: TicketDetails,
  errors: Row[],
  unavailableEndpoints: Row[],
): Promise<void> {
  const issue = asRow(details.issue);
  if (!issue) return;
  const relatedSpecs = [
    ["status", "StatusID", "ServiceManagerStatuses/{id}"],
    ["category", "CategoryID", "ServiceManagerCategories/{id}"],
    ["priority", "PriorityID", "ServiceManagerPriorities/{id}"],
    ["vendor", "VendorID", "Vendors/{id}"],
    ["assigned_to_user", "AssignedToUserID", "Users/{id}"],
    ["create_user", "CreateUserID", "Users/{id}"],
    ["update_user", "UpdateUserID", "Users/{id}"],
    ["property", "PropertyID", "Properties/{id}"],
    ["unit", "UnitID", "Units/{id}"],
    ["tenant", "TenantID", "Tenants/{id}"],
  ] as const;
  const cache = new Map<string, unknown>();
  for (const [name, idKey, template] of relatedSpecs) {
    const itemId = parseId(issue[idKey]);
    if (itemId === null) continue;
    const endpoint = template.replace("{id}", String(itemId));
    if (!cache.has(endpoint)) {
      cache.set(endpoint, await safeGet(client, endpoint, errors, { unavailableEndpoints }));
    }
    const value = cache.get(endpoint);
    if (value !== null && value !== undefined) details.related[name] = value;
  }

  const ownerId =
    parseId(issue.OwnerID) ??
    parseId(issue.PrimaryOwnerID) ??
    firstCollectionInteger(details.properties, "PrimaryOwnerID");
  if (ownerId !== null) {
    const endpoint = `Owners/${ownerId}`;
    if (!cache.has(endpoint)) {
      cache.set(endpoint, await safeGet(client, endpoint, errors, { unavailableEndpoints }));
    }
    const value = cache.get(endpoint);
    if (value !== null && value !== undefined) details.related.owner = value;
  }
}

async function applyBillingOverview(
  client: ServiceTicketClient,
  details: TicketDetails,
  errors: Row[],
  unavailableEndpoints: Row[],
): Promise<void> {
  details.billing_rows = billingRows(details);
  details.billing_summary = billingSummary(details.billing_rows);
  details.billing_documents = await resolveBillingDocuments(
    client,
    details.billing_rows,
    errors,
    unavailableEndpoints,
  );
}

function billingRows(details: TicketDetails): Row[] {
  const rows: Row[] = [];
  for (const [index, value] of details.work_orders.entries()) {
    const row = asRow(value);
    if (row) rows.push(billingRow("work_order", index, row, details));
  }
  if (rows.length === 0 && Array.isArray(details.line_items)) {
    for (const [index, value] of details.line_items.entries()) {
      const row = asRow(value);
      if (row) rows.push(billingRow("line_item", index, row, details));
    }
  }
  return rows;
}

function billingRow(source: string, index: number, row: Row, details: TicketDetails): Row {
  const issue = asRow(details.issue) ?? {};
  const owner = asRow(details.related.owner) ?? {};
  const type = billingType(row);
  const billTo = billToType(row, issue, type);
  const tenantId = parseId(row.TenantID) ?? parseId(issue.TenantID);
  const vendorId = parseId(row.VendorID) ?? parseId(issue.VendorID);
  const ownerId = parseId(row.OwnerID) ?? parseId(issue.OwnerID) ?? parseId(owner.OwnerID);
  return {
    source,
    source_index: index,
    billing_type: type,
    bill_to_type: billTo,
    bill_to_id: billToId(row, billTo, tenantId, vendorId, ownerId),
    service_manager_issue_work_order_id: parseId(row.ServiceManagerIssueWorkOrderID),
    work_order_id: parseId(row.WorkOrderID),
    service_manager_issue_id: parseId(row.ServiceManagerIssueID) ?? parseId(issue.ServiceManagerIssueID),
    description: row.Description,
    quantity: parseNumber(row.Quantity),
    cost: parseNumber(row.Cost),
    price: parseNumber(row.Price),
    payee_account_id: parseId(row.PayeeAccountID),
    tenant_id: tenantId,
    vendor_id: vendorId,
    owner_id: ownerId,
    property_id: parseId(row.PropertyID) ?? parseId(issue.PropertyID),
    unit_id: parseId(row.UnitID) ?? parseId(issue.UnitID),
    job_id: parseId(row.JobID),
    inventory_item_id: parseId(row.InventoryItemID),
    invoice_id: parseId(row.InvoiceID),
    invoice_detail_id: parseId(row.InvoiceDetailID),
    vendor_bill_id: parseId(row.VendorBillID),
    owner_bill_id: parseId(row.OwnerBillID),
    purchase_order_id: parseId(row.PurchaseOrderID),
    quick_bill_id: parseId(row.QuickBillID),
    smart_receipt_id: parseId(row.SmartReceiptID),
    raw: jsonable(row),
  };
}

function billingType(row: Row): string {
  if (truthy(row.HasInvoiceLink) || parseId(row.InvoiceID) !== null || parseId(row.InvoiceDetailID) !== null) {
    return "tenant_invoice";
  }
  if (truthy(row.HasVendorBillLink) || parseId(row.VendorBillID) !== null) return "vendor_bill";
  if (truthy(row.HasOwnerBillLink) || parseId(row.OwnerBillID) !== null) return "owner_bill";
  if (truthy(row.HasPurchaseOrderLink) || parseId(row.PurchaseOrderID) !== null) return "purchase_order";
  if (parseId(row.QuickBillID) !== null) return "quick_bill";
  if (parseId(row.SmartReceiptID) !== null) return "smart_receipt";
  return "unbilled";
}

function billToType(row: Row, issue: Row, billingTypeValue: string): string {
  if (billingTypeValue === "tenant_invoice") {
    return parseId(row.TenantID) !== null || parseId(issue.TenantID) !== null ? "tenant" : "account";
  }
  if (billingTypeValue === "vendor_bill") return "vendor";
  if (billingTypeValue === "owner_bill") return "owner";
  if (billingTypeValue === "purchase_order") {
    return parseId(row.VendorID) !== null ||
      parseId(issue.VendorID) !== null ||
      parseId(row.PayeeAccountID) !== null
      ? "vendor"
      : "purchase_order";
  }
  if (billingTypeValue === "quick_bill" || billingTypeValue === "smart_receipt") return "payee";
  return "unbilled";
}

function billToId(
  row: Row,
  billToTypeValue: string,
  tenantId: number | null,
  vendorId: number | null,
  ownerId: number | null,
): number | null {
  if (billToTypeValue === "tenant") return tenantId ?? parseId(row.AccountID);
  if (billToTypeValue === "vendor") return vendorId ?? parseId(row.PayeeAccountID);
  if (billToTypeValue === "owner") return ownerId ?? parseId(row.PayeeAccountID);
  if (billToTypeValue === "account") return parseId(row.AccountID);
  if (billToTypeValue === "payee") return parseId(row.PayeeAccountID);
  return null;
}

function countBy(rows: Row[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key] ?? "unknown");
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function billingSummary(rows: Row[]): Row {
  const billingTypeCounts = countBy(rows, "billing_type");
  return {
    row_count: rows.length,
    total_cost: sumNumeric(rows.map((row) => row.cost)),
    total_price: sumNumeric(rows.map((row) => row.price)),
    billing_type_counts: billingTypeCounts,
    bill_to_type_counts: countBy(rows, "bill_to_type"),
    unbilled_count: billingTypeCounts.unbilled ?? 0,
  };
}

async function resolveBillingDocuments(
  client: ServiceTicketClient,
  billingRowsValue: Row[],
  errors: Row[],
  unavailableEndpoints: Row[],
): Promise<Record<string, Row>> {
  const documents = emptyBillingDocuments();
  const cache = new Map<string, unknown>();
  const specs = [
    ["invoices", "invoice_id", "Invoices/{id}"],
    ["vendor_bills", "vendor_bill_id", "Bills/{id}"],
    ["owner_bills", "owner_bill_id", "Bills/{id}"],
    ["purchase_orders", "purchase_order_id", "PurchaseOrders/{id}"],
  ] as const;
  for (const row of billingRowsValue) {
    for (const [group, idKey, template] of specs) {
      const itemId = parseId(row[idKey]);
      if (itemId === null) continue;
      const endpoint = template.replace("{id}", String(itemId));
      if (!cache.has(endpoint)) {
        cache.set(endpoint, await safeGet(client, endpoint, errors, { unavailableEndpoints }));
      }
      const value = cache.get(endpoint);
      if (value !== null && value !== undefined) {
        (documents[group] as Row)[String(itemId)] = value;
      }
    }
  }
  return documents;
}

function emptyBillingDocuments(): Record<string, Row> {
  return { invoices: {}, vendor_bills: {}, owner_bills: {}, purchase_orders: {} };
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const number = typeof value === "number"
    ? value
    : Number(String(value).trim().replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function sumNumeric(values: unknown[]): number {
  return values.reduce<number>((total, value) => total + (parseNumber(value) ?? 0), 0);
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "yes", "y", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function firstCollectionInteger(value: unknown, key: string): number | null {
  for (const item of collectionList(value)) {
    const row = asRow(item);
    if (!row) continue;
    const parsed = parseId(row[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function downloadEndpointTemplates(): string[] {
  const raw = (process.env.RM_TICKET_DOWNLOAD_ENDPOINT_TEMPLATES ?? "").trim();
  if (raw) {
    const templates = raw.split(",").map((item) => item.trim()).filter(Boolean);
    if (templates.length) return templates;
  }
  return [...DEFAULT_DOWNLOAD_ENDPOINT_TEMPLATES];
}

async function downloadAttachment(
  client: ServiceTicketClient,
  ticketId: string,
  row: Row,
  attachmentsDir: string,
): Promise<Row> {
  const fileId = extractFileId(row);
  const filename = attachmentFilename(row, fileId);
  const attempts: Row[] = [];
  const result: Row = {
    ok: false,
    file_id: fileId,
    filename,
    path: null,
    metadata: row,
    attempts,
  };
  if (fileId === null) {
    attempts.push({ endpoint: null, ok: false, status_code: null, error: "Missing file id." });
    return result;
  }
  for (const template of downloadEndpointTemplates()) {
    const endpoint = template
      .replace("{ticket_id}", ticketId)
      .replace("{file_id}", String(fileId));
    try {
      const content = await client.downloadBytes(endpoint);
      await privateDirectory(attachmentsDir);
      const filePath = await uniquePath(attachmentsDir, filename);
      await writeFile(filePath, content, { mode: 0o600 });
      await chmod(filePath, 0o600).catch(() => undefined);
      attempts.push({ endpoint, ok: true, status_code: 200, error: null });
      Object.assign(result, {
        ok: true,
        path: filePath,
        endpoint,
        size: content.byteLength,
      });
      return result;
    } catch (error) {
      if (!(error instanceof RentManagerAPIError)) throw error;
      attempts.push({ ...errorRecord(endpoint, error), ok: false });
    }
  }
  return result;
}

function attachmentRows(details: TicketDetails): Row[] {
  const rows: Row[] = [];
  for (const key of ["attachments", "files", "documents"]) {
    const value = details[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const row = asRow(item);
        if (row) rows.push(row);
      }
    } else {
      const row = asRow(value);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function attachmentFilename(row: Row, fileId: number | null): string {
  for (const key of FILENAME_KEYS) {
    const value = String(row[key] ?? "").trim();
    if (value) return sanitizeFilename(value);
  }
  return `ticket-file-${fileId ?? "unknown"}`;
}

function sanitizeFilename(value: string): string {
  const name = value.replaceAll("\\", "/").split("/").at(-1)?.trim() ?? "";
  return name.replace(INVALID_FILENAME_CHARS, "_").replace(/^[ .]+|[ .]+$/g, "") || "attachment";
}

async function uniquePath(directory: string, filename: string): Promise<string> {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension) || "attachment";
  let candidate = path.join(directory, filename);
  for (let counter = 2; await exists(candidate); counter += 1) {
    candidate = path.join(directory, `${stem}-${counter}${extension}`);
  }
  const root = path.resolve(directory);
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new TypeError(`Refusing to write outside export directory: ${candidate}`);
  }
  return candidate;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractTicketId(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractTicketId(item);
      if (parsed !== null) return parsed;
    }
  }
  const row = asRow(value);
  if (row) {
    for (const key of ["ServiceManagerIssueID", "IssueID", "TicketID", "ID", "Id"]) {
      const parsed = parseInteger(row[key]);
      if (parsed !== null) return parsed;
    }
  }
  return parseInteger(value);
}

function extractFileId(value: unknown): number | null {
  const row = asRow(value);
  if (row) {
    for (const key of FILE_ID_KEYS) {
      const parsed = parseInteger(row[key]);
      if (parsed !== null) return parsed;
    }
    for (const nested of Object.values(row)) {
      const parsed = extractFileId(nested);
      if (parsed !== null) return parsed;
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractFileId(item);
      if (parsed !== null) return parsed;
    }
  }
  return parseInteger(value);
}

function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const text = String(value).trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseId(value: unknown): number | null {
  const parsed = parseInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function asRow(value: unknown): Row | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if ("toJSON" in value && typeof value.toJSON === "function") {
    return value.toJSON() as Row;
  }
  return value as Row;
}

function jsonable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonable);
  const row = asRow(value);
  if (row) {
    return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, jsonable(item)]));
  }
  return value;
}

function errorRecord(endpoint: string | null, error: RentManagerAPIError): Row {
  return {
    endpoint,
    status_code: error.statusCode,
    error: error.message,
    developer_message: error.developerMessage,
    user_message: error.userMessage,
  };
}

function isUnsupportedEndpoint(error: RentManagerAPIError): boolean {
  const message = [
    error.developerMessage,
    error.userMessage,
    error.message,
  ].map((part) => String(part ?? "")).join(" ").toLowerCase();
  return error.statusCode === 404 && message.includes("no http resource was found");
}

async function privateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => undefined);
}

async function writePrivateJson(filePath: string, payload: unknown): Promise<void> {
  await privateDirectory(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600).catch(() => undefined);
}

export interface ExportTicketOptions extends NewestTicketOptions {
  exportRoot?: string | null;
  export_root?: string | null;
}

export async function exportNewestServiceTicketDetails(
  client: ServiceTicketClient,
  options: ExportTicketOptions = {},
): Promise<Row> {
  const tickets = await getNewestServiceTickets(client, options);
  const limit = Math.max(0, Math.trunc(options.limit ?? 5));
  const root = options.exportRoot ?? options.export_root ?? "service-ticket-exports";
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const exportDir = path.join(root, `${stamp}-newest-${limit}`);
  await privateDirectory(exportDir);
  const manifest: Row = {
    exported_at: new Date().toISOString(),
    export_dir: exportDir,
    ticket_count: 0,
    tickets: [],
  };
  const summaries = manifest.tickets as Row[];
  for (const ticket of tickets) {
    const ticketId = extractTicketId(ticket);
    if (ticketId === null) {
      summaries.push({
        ticket_id: null,
        source_ticket: ticket,
        details: null,
        details_path: null,
        download_count: 0,
        error_count: 1,
        errors: [{ endpoint: "ServiceManagerIssues", error: "Unable to determine ticket id." }],
      });
      continue;
    }
    const ticketDir = path.join(exportDir, `ticket-${ticketId}`);
    const details = await getServiceTicketDetails(client, ticketId, {
      exportDir: ticketDir,
      downloadAttachments: true,
    });
    const successful = details.downloads.filter((item) => item.ok);
    const failed = details.downloads.filter((item) => !item.ok);
    summaries.push({
      ticket_id: ticketId,
      title: ticket.Title,
      created_at: ticketCreatedAt(ticket).toISOString(),
      details_path: path.join(ticketDir, "details.json"),
      download_count: successful.length,
      error_count: details.errors.length + failed.length,
      unavailable_endpoint_count: details.unavailable_endpoints.length,
      details,
    });
  }
  manifest.ticket_count = summaries.length;
  await writePrivateJson(path.join(exportDir, "manifest.json"), manifest);
  return manifest;
}

export const export_newest_service_ticket_details = exportNewestServiceTicketDetails;

export interface CreateServiceTicketInput {
  title: string;
  description: string;
  propertyId?: number | null;
  property_id?: number | null;
  unitId?: number | null;
  unit_id?: number | null;
  tenantId?: number | null;
  tenant_id?: number | null;
  vendorId?: number | null;
  vendor_id?: number | null;
  statusId?: number | null;
  status_id?: number | null;
  categoryId?: number | null;
  category_id?: number | null;
  lineItems?: Row[] | null;
  line_items?: Row[] | null;
  extra?: Row | null;
}

export function createServiceTicket(
  client: ServiceTicketClient,
  input: CreateServiceTicketInput,
): Promise<unknown> {
  const payload: Row = {
    Title: input.title,
    Description: input.description,
    IsClosed: false,
  };
  const optionalValues = {
    PropertyID: input.propertyId ?? input.property_id,
    UnitID: input.unitId ?? input.unit_id,
    TenantID: input.tenantId ?? input.tenant_id,
    VendorID: input.vendorId ?? input.vendor_id,
    StatusID: input.statusId ?? input.status_id,
    CategoryID: input.categoryId ?? input.category_id,
  };
  for (const [key, value] of Object.entries(optionalValues)) {
    if (value !== null && value !== undefined) payload[key] = value;
  }
  const lineItems = input.lineItems ?? input.line_items;
  if (lineItems?.length) payload.LineItems = lineItems;
  Object.assign(payload, input.extra ?? {});
  return client.serviceManager.issues.create(payload);
}

export const create_service_ticket = createServiceTicket;

export interface UpdateTicketLineItemsInput {
  issueId?: number;
  issue_id?: number;
  lineItems?: Row[];
  line_items?: Row[];
  note?: string | null;
}

export function updateTicketLineItems(
  client: ServiceTicketClient,
  input: UpdateTicketLineItemsInput,
): Promise<unknown> {
  const issueId = input.issueId ?? input.issue_id;
  if (issueId === undefined) throw new TypeError("issueId is required.");
  const payload: Row = { LineItems: input.lineItems ?? input.line_items ?? [] };
  if (input.note) payload.NoteText = input.note;
  return client.serviceManager.issues.update(issueId, payload);
}

export const update_ticket_line_items = updateTicketLineItems;
