import type { HeaderRecord } from "./types.js";

export interface PageInput<T> {
  data: T[];
  statusCode: number;
  headers: HeaderRecord;
  pageNumber: number;
  pageSize: number;
  totalResults?: number | null;
  links?: Record<string, string>;
}

export class Page<T = unknown> {
  readonly data: T[];
  readonly statusCode: number;
  readonly status_code: number;
  readonly headers: HeaderRecord;
  readonly pageNumber: number;
  readonly page_number: number;
  readonly pageSize: number;
  readonly page_size: number;
  readonly totalResults: number | null;
  readonly total_results: number | null;
  readonly links: Record<string, string>;

  constructor(input: PageInput<T>) {
    this.data = input.data;
    this.statusCode = input.statusCode;
    this.status_code = input.statusCode;
    this.headers = input.headers;
    this.pageNumber = input.pageNumber;
    this.page_number = input.pageNumber;
    this.pageSize = input.pageSize;
    this.page_size = input.pageSize;
    this.totalResults = input.totalResults ?? null;
    this.total_results = this.totalResults;
    this.links = input.links ?? {};
  }
}

export function parseLinkHeader(value: string | null | undefined): Record<string, string> {
  const links: Record<string, string> = {};
  if (!value) return links;
  for (const part of value.split(",")) {
    const section = part.trim();
    if (!section || !section.includes(";")) continue;
    const [urlPart = "", ...parameterParts] = section.split(";");
    let url = urlPart.trim();
    if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
    let relation: string | undefined;
    for (const parameter of parameterParts) {
      const separator = parameter.indexOf("=");
      const key = (separator >= 0 ? parameter.slice(0, separator) : parameter).trim().toLowerCase();
      const rawValue = separator >= 0 ? parameter.slice(separator + 1).trim() : "";
      if (key === "rel") relation = rawValue.replace(/^"|"$/g, "");
    }
    if (relation) links[relation] = url;
  }
  return links;
}

export const parse_link_header = parseLinkHeader;

export function totalResultsFromHeaders(headers: HeaderRecord): number | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === "x-total-results");
  if (!entry) return null;
  const value = Number.parseInt(entry[1], 10);
  return Number.isNaN(value) ? null : value;
}

export const total_results_from_headers = totalResultsFromHeaders;
