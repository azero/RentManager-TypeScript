import type { RMBaseModel } from "../models-base.js";

interface ListResource {
  list(): Promise<unknown[]>;
}

export interface EmailLookupClient {
  owners: ListResource;
  tenants: ListResource;
  prospects: ListResource;
  vendors: ListResource;
  contacts: ListResource;
}

export interface EmailMatch {
  entity: string;
  identity: Record<string, unknown>;
  record: Record<string, unknown>;
}

export interface EmailLookupResult {
  sender_email: string;
  total_matches: number;
  matches: EmailMatch[];
}

function asPlain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asPlain);
  if (value !== null && typeof value === "object") {
    const source =
      typeof (value as RMBaseModel).toJSON === "function"
        ? (value as RMBaseModel).toJSON()
        : (value as Record<string, unknown>);
    return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, asPlain(item)]));
  }
  return value;
}

function containsEmail(value: unknown, targetEmail: string): boolean {
  const plain = asPlain(value);
  if (plain === null || plain === undefined) return false;
  if (typeof plain === "string") return plain.toLowerCase().includes(targetEmail);
  if (Array.isArray(plain)) return plain.some((item) => containsEmail(item, targetEmail));
  if (typeof plain === "object") {
    return Object.values(plain).some((item) => containsEmail(item, targetEmail));
  }
  return false;
}

function identity(record: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "ID",
    "ContactID",
    "ParentType",
    "ParentID",
    "TenantID",
    "ProspectID",
    "OwnerID",
    "VendorID",
    "Name",
    "CompanyName",
    "FirstName",
    "LastName",
    "Status",
    "IsActive",
  ];
  return Object.fromEntries(keys.filter((key) => key in record).map((key) => [key, record[key]]));
}

function match(entity: string, record: unknown): EmailMatch {
  const row = asPlain(record) as Record<string, unknown>;
  return { entity, identity: identity(row), record: row };
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
    .join(",")}}`;
}

function dedupe(matches: EmailMatch[]): EmailMatch[] {
  const seen = new Set<string>();
  const output: EmailMatch[] = [];
  for (const item of matches) {
    let key: string | undefined;
    for (const idKey of ["ContactID", "OwnerID", "TenantID", "ProspectID", "VendorID", "ID"]) {
      if (item.record[idKey] !== null && item.record[idKey] !== undefined) {
        key = `${item.entity}:${idKey}:${String(item.record[idKey])}`;
        break;
      }
    }
    key ??= stableValue(item.record);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export async function lookupByEmail(
  client: EmailLookupClient,
  email: string,
  options: { includeContacts?: boolean; include_contacts?: boolean } = {},
): Promise<EmailLookupResult> {
  const target = (email || "").trim().toLowerCase();
  if (!target) return { sender_email: email, total_matches: 0, matches: [] };

  const fetchers: [string, () => Promise<unknown[]>][] = [
    ["Owner", () => client.owners.list()],
    ["Tenant", () => client.tenants.list()],
    ["Prospect", () => client.prospects.list()],
    ["Vendor", () => client.vendors.list()],
  ];
  if (options.includeContacts ?? options.include_contacts ?? true) {
    fetchers.push(["Contact", () => client.contacts.list()]);
  }

  const matches: EmailMatch[] = [];
  for (const [entity, fetch] of fetchers) {
    for (const row of (await fetch()) ?? []) {
      if (containsEmail(row, target)) matches.push(match(entity, row));
    }
  }
  const unique = dedupe(matches);
  return { sender_email: email, total_matches: unique.length, matches: unique };
}

export const lookup_by_email = lookupByEmail;
