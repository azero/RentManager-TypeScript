import type { QueryParamsInput, QueryRecord, SaveOptions } from "./types.js";

export const RQL_OPERATORS = [
  "eq",
  "ne",
  "in",
  "ni",
  "ct",
  "sw",
  "ew",
  "lt",
  "le",
  "gt",
  "ge",
  "bt",
  "gtn",
  "gen",
  "ltn",
  "len",
  "hv",
] as const;

export type RQLOperator = (typeof RQL_OPERATORS)[number];
const RQL_OPERATOR_SET = new Set<string>(RQL_OPERATORS);

function formatRqlValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (value === null) return "null";
  return String(value);
}

export class RQL {
  static filter(field: string, operator: RQLOperator | string, value: unknown = ""): string {
    if (!RQL_OPERATOR_SET.has(operator)) {
      throw new TypeError(
        `Unsupported RQL operator ${JSON.stringify(operator)}. Allowed: ${[...RQL_OPERATORS].sort().join(", ")}`,
      );
    }
    if (typeof field !== "string" || field.length === 0) {
      throw new TypeError("RQL field must be a non-empty string.");
    }
    const formatted =
      Array.isArray(value) || value instanceof Set
        ? `(${[...value].map(formatRqlValue).join(",")})`
        : formatRqlValue(value);
    return `${field},${operator},${formatted}`;
  }

  static eq(field: string, value: unknown): string { return RQL.filter(field, "eq", value); }
  static ne(field: string, value: unknown): string { return RQL.filter(field, "ne", value); }
  static in(field: string, values: Iterable<unknown>): string { return RQL.filter(field, "in", [...values]); }
  static in_(field: string, values: Iterable<unknown>): string { return RQL.in(field, values); }
  static ni(field: string, values: Iterable<unknown>): string { return RQL.filter(field, "ni", [...values]); }
  static ct(field: string, value: unknown): string { return RQL.filter(field, "ct", value); }
  static sw(field: string, value: unknown): string { return RQL.filter(field, "sw", value); }
  static ew(field: string, value: unknown): string { return RQL.filter(field, "ew", value); }
  static lt(field: string, value: unknown): string { return RQL.filter(field, "lt", value); }
  static le(field: string, value: unknown): string { return RQL.filter(field, "le", value); }
  static gt(field: string, value: unknown): string { return RQL.filter(field, "gt", value); }
  static ge(field: string, value: unknown): string { return RQL.filter(field, "ge", value); }
  static bt(field: string, start: unknown, end: unknown): string { return RQL.filter(field, "bt", [start, end]); }
  static gtn(field: string, value: unknown): string { return RQL.filter(field, "gtn", value); }
  static gen(field: string, value: unknown): string { return RQL.filter(field, "gen", value); }
  static ltn(field: string, value: unknown): string { return RQL.filter(field, "ltn", value); }
  static len(field: string, value: unknown): string { return RQL.filter(field, "len", value); }
  static hv(field: string, value: unknown = ""): string { return RQL.filter(field, "hv", value); }
}

function asCsv(value: string | readonly string[] | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "string" ? value : value.map(String).join(",");
}

function asFilterList(value: string | readonly string[] | null | undefined): string[] {
  if (value == null) return [];
  return typeof value === "string" ? [value] : value.map(String);
}

function firstDefined<T>(...values: (T | null | undefined)[]): T | undefined {
  return values.find((value): value is T => value !== undefined && value !== null);
}

export class QueryParams {
  readonly input: QueryParamsInput;

  constructor(input: QueryParamsInput = {}) {
    this.input = { ...input };
  }

  toParams(): QueryRecord {
    const input = { ...this.input };
    const params: QueryRecord = {};
    const fields = asCsv(input.fields);
    if (fields) params.fields = fields;

    const embeds = [asCsv(input.embed), asCsv(input.embeds)].filter(
      (value): value is string => Boolean(value),
    );
    if (embeds.length) params.embed = embeds.join(",");

    const filters = [...asFilterList(input.filter), ...asFilterList(input.filters)];
    if (filters.length) params.filters = filters.join(";");

    const pageNumber = firstDefined(input.pageNumber, input.page_number, input.pagenumber);
    const pageSize = firstDefined(input.pageSize, input.page_size, input.pagesize);
    const noContent = firstDefined(input.noContent, input.no_content, input.nocontent);
    const orderBy = asCsv(firstDefined(input.orderBy, input.order_by, input.orderby));
    const saveOptions = firstDefined(input.saveOptions, input.save_options, input.SaveOptions);

    if (pageNumber !== undefined) params.pagenumber = Number(pageNumber);
    if (pageSize !== undefined) params.pagesize = Number(pageSize);
    if (noContent !== undefined) params.nocontent = noContent ? "true" : "false";
    if (orderBy) params.orderby = orderBy;

    const formattedSaveOptions = QueryParams.formatSaveOptions(saveOptions);
    if (formattedSaveOptions) params.SaveOptions = formattedSaveOptions;

    const known = new Set([
      "fields", "embed", "embeds", "filter", "filters",
      "pageNumber", "page_number", "pagenumber",
      "pageSize", "page_size", "pagesize",
      "noContent", "no_content", "nocontent",
      "orderBy", "order_by", "orderby",
      "saveOptions", "save_options", "SaveOptions", "extra",
    ]);
    for (const [key, value] of Object.entries(input)) {
      if (!known.has(key)) params[key] = value;
    }
    Object.assign(params, input.extra ?? {});
    return params;
  }

  static fromKwargs(input: QueryParamsInput = {}): QueryRecord {
    return new QueryParams(input).toParams();
  }

  static formatSaveOptions(value: SaveOptions | null | undefined): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(";");
    return Object.entries(value)
      .map(([key, enabled]) => `${key},${enabled ? "true" : "false"}`)
      .join(";");
  }
}

export function queryParamsFromKwargs(input: QueryParamsInput = {}): QueryRecord {
  return QueryParams.fromKwargs(input);
}
