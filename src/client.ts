import { errorFromResponse, RentManagerTransportError } from "./errors.js";
import { GENERATED_RESOURCE_DEFINITIONS, type GeneratedResourceProperties } from "./generated/resources.js";
import { InMemoryTokenStore, type TokenStore } from "./token-store.js";
import { Page, parseLinkHeader, totalResultsFromHeaders } from "./pagination.js";
import { QueryParams } from "./query.js";
import {
  AmenitiesResource,
  ChargeTypesResource,
  ContactsResource,
  GLAccountsResource,
  LeasesResource,
  LocationsResource,
  OwnersResource,
  type PaginationOptions,
  PropertiesResource,
  PropertyGroupsResource,
  ProspectsResource,
  RecurringChargesResource,
  ReportWriterReportsResource,
  type Resource,
  type ResourceClient,
  ServiceManagerNamespace,
  TasksResource,
  TenantsResource,
  type IterPagesOptions,
  UnitsResource,
  UnitTypesResource,
  UsersResource,
  VendorsResource,
} from "./resource.js";
import { FetchTransport, type Transport } from "./transport.js";
import type {
  ClientOptions,
  ClientSettings,
  HeaderRecord,
  MultipartFiles,
  QueryParamsInput,
  QueryRecord,
  RequestOptions,
} from "./types.js";
import type { TransportResponse } from "./response.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

type PositionalClientOptions = Omit<ClientSettings, "username" | "password">;
type NormalizedClientOptions = ClientSettings & { corpId: string };

function normalizeOptions(
  optionsOrCorpId: ClientOptions | string,
  username?: string,
  password?: string,
  options: PositionalClientOptions = {},
): NormalizedClientOptions {
  if (typeof optionsOrCorpId === "object") {
    const corpId = optionsOrCorpId.corpId ?? optionsOrCorpId.corp_id;
    if (!corpId) throw new TypeError("corpId is required.");
    return {
      ...optionsOrCorpId,
      corpId,
      locationId: optionsOrCorpId.locationId ?? optionsOrCorpId.location_id,
      baseUrl: optionsOrCorpId.baseUrl ?? optionsOrCorpId.base_url,
      timeoutMs: optionsOrCorpId.timeoutMs ?? optionsOrCorpId.timeout_ms,
      maxRetries: optionsOrCorpId.maxRetries ?? optionsOrCorpId.max_retries,
      retryBackoffSeconds:
        optionsOrCorpId.retryBackoffSeconds ?? optionsOrCorpId.retry_backoff_seconds,
      tokenStore: optionsOrCorpId.tokenStore ?? optionsOrCorpId.token_store,
    };
  }
  if (username === undefined || password === undefined) {
    throw new TypeError("username and password are required.");
  }
  return { ...options, corpId: optionsOrCorpId, username, password };
}

function wait(milliseconds: number): Promise<void> {
  return milliseconds > 0
    ? new Promise((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve();
}

function withoutPaginationControls<T extends QueryParamsInput>(input: T): QueryParamsInput {
  const query = { ...input };
  for (const key of [
    "params",
    "pageNumber",
    "page_number",
    "pageSize",
    "page_size",
    "startPage",
    "start_page",
    "maxPages",
    "max_pages",
  ]) {
    delete query[key];
  }
  return query;
}

export interface RentManagerClient extends GeneratedResourceProperties {}

export class RentManagerClient implements ResourceClient {
  readonly corpId: string;
  readonly corp_id: string;
  readonly username: string;
  readonly password: string;
  readonly baseUrl: string;
  readonly base_url: string;
  locationId: number | null;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffSeconds: number;
  readonly tokenStore: TokenStore;
  readonly token_store: TokenStore;
  readonly transport: Transport;
  #token: string | null = null;
  #resources = new Map<string, Resource>();

  readonly contacts: ContactsResource;
  readonly tasks: TasksResource;
  readonly owners: OwnersResource;
  readonly tenants: TenantsResource;
  readonly prospects: ProspectsResource;
  readonly vendors: VendorsResource;
  readonly properties: PropertiesResource;
  readonly units: UnitsResource;
  readonly leases: LeasesResource;
  readonly users: UsersResource;
  readonly locations: LocationsResource;
  readonly propertyGroups: PropertyGroupsResource;
  readonly property_groups: PropertyGroupsResource;
  readonly amenities: AmenitiesResource;
  readonly glAccounts: GLAccountsResource;
  readonly gl_accounts: GLAccountsResource;
  readonly chargeTypes: ChargeTypesResource;
  readonly charge_types: ChargeTypesResource;
  readonly unitTypes: UnitTypesResource;
  readonly unit_types: UnitTypesResource;
  readonly recurringCharges: RecurringChargesResource;
  readonly recurring_charges: RecurringChargesResource;
  readonly reportWriterReports: ReportWriterReportsResource;
  readonly report_writer_reports: ReportWriterReportsResource;
  readonly serviceManager: ServiceManagerNamespace;
  readonly service_manager: ServiceManagerNamespace;

  constructor(options: ClientOptions);
  constructor(
    corpId: string,
    username: string,
    password: string,
    options?: PositionalClientOptions,
  );
  constructor(
    optionsOrCorpId: ClientOptions | string,
    username?: string,
    password?: string,
    positionalOptions: PositionalClientOptions = {},
  ) {
    const options = normalizeOptions(optionsOrCorpId, username, password, positionalOptions);
    this.corpId = options.corpId;
    this.corp_id = options.corpId;
    this.username = options.username;
    this.password = options.password;
    this.locationId = options.locationId ?? null;
    this.baseUrl = (options.baseUrl ?? `https://${options.corpId}.api.rentmanager.com`).replace(/\/+$/, "");
    this.base_url = this.baseUrl;
    this.timeoutMs = Math.max(0, options.timeoutMs ?? (options.timeout ?? 15) * 1_000);
    this.maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? 2));
    this.retryBackoffSeconds = Math.max(0, options.retryBackoffSeconds ?? 0.4);
    this.tokenStore = options.tokenStore ?? new InMemoryTokenStore();
    this.token_store = this.tokenStore;
    this.transport = options.transport ?? new FetchTransport();

    this.contacts = this.register("contacts", new ContactsResource(this));
    this.tasks = this.register("tasks", new TasksResource(this));
    this.owners = this.register("owners", new OwnersResource(this));
    this.tenants = this.register("tenants", new TenantsResource(this));
    this.prospects = this.register("prospects", new ProspectsResource(this));
    this.vendors = this.register("vendors", new VendorsResource(this));
    this.properties = this.register("properties", new PropertiesResource(this));
    this.units = this.register("units", new UnitsResource(this));
    this.leases = this.register("leases", new LeasesResource(this));
    this.users = this.register("users", new UsersResource(this));
    this.locations = this.register("locations", new LocationsResource(this));
    this.propertyGroups = this.register("property_groups", new PropertyGroupsResource(this));
    this.property_groups = this.propertyGroups;
    this.amenities = this.register("amenities", new AmenitiesResource(this));
    this.glAccounts = this.register("gl_accounts", new GLAccountsResource(this));
    this.gl_accounts = this.glAccounts;
    this.chargeTypes = this.register("charge_types", new ChargeTypesResource(this));
    this.charge_types = this.chargeTypes;
    this.unitTypes = this.register("unit_types", new UnitTypesResource(this));
    this.unit_types = this.unitTypes;
    this.recurringCharges = this.register("recurring_charges", new RecurringChargesResource(this));
    this.recurring_charges = this.recurringCharges;
    this.reportWriterReports = this.register(
      "report_writer_reports",
      new ReportWriterReportsResource(this),
    );
    this.report_writer_reports = this.reportWriterReports;
    this.serviceManager = new ServiceManagerNamespace(this);
    this.service_manager = this.serviceManager;

    for (const definition of GENERATED_RESOURCE_DEFINITIONS) {
      const resource = new definition.ResourceClass(this);
      this.#resources.set(definition.clientAttr, resource);
      Object.defineProperty(this, definition.clientAttr, {
        configurable: false,
        enumerable: true,
        value: resource,
        writable: false,
      });
      if (definition.camelAttr !== definition.clientAttr) {
        Object.defineProperty(this, definition.camelAttr, {
          configurable: false,
          enumerable: true,
          value: resource,
          writable: false,
        });
      }
    }
  }

  get location_id(): number | null {
    return this.locationId;
  }

  set location_id(value: number | null) {
    this.locationId = value;
  }

  get max_retries(): number {
    return this.maxRetries;
  }

  set max_retries(value: number) {
    this.maxRetries = value;
  }

  get retry_backoff_seconds(): number {
    return this.retryBackoffSeconds;
  }

  set retry_backoff_seconds(value: number) {
    this.retryBackoffSeconds = value;
  }

  static jsonDumps(payload: unknown): string {
    return JSON.stringify(payload);
  }

  static json_dumps(payload: unknown): string {
    return RentManagerClient.jsonDumps(payload);
  }

  jsonDumps(payload: unknown): string {
    return RentManagerClient.jsonDumps(payload);
  }

  json_dumps(payload: unknown): string {
    return this.jsonDumps(payload);
  }

  async close(): Promise<void> {
    await this.transport.close?.();
  }

  aclose(): Promise<void> {
    return this.close();
  }

  resource(clientAttr: string): Resource | undefined {
    return this.#resources.get(clientAttr);
  }

  async authenticate(options: { force?: boolean } | boolean = {}): Promise<string> {
    const force = typeof options === "boolean" ? options : (options.force ?? false);
    if (!force) {
      const cached = this.#token ?? await this.tokenStore.load();
      if (cached) {
        this.#token = cached;
        return cached;
      }
    }

    const response = await this.requestRaw("POST", "Authentication/AuthorizeUser", {
      auth: false,
      json: this.authPayload(),
    });
    const payload = this.decodeResponse(response);
    const token =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).Token
        : payload;
    if (typeof token !== "string" || !token.trim()) {
      throw new RentManagerTransportError(
        "Authentication response did not contain an API token.",
      );
    }
    await this.setToken(token);
    return token;
  }

  authorizeToken<T = unknown>(token: string): Promise<T> {
    return this.request<T>("POST", "Authentication/AuthorizeToken", {
      auth: false,
      params: { token },
    });
  }

  authorize_token<T = unknown>(token: string): Promise<T> {
    return this.authorizeToken<T>(token);
  }

  async changeLocation<T = unknown>(locationId: number): Promise<T> {
    const result = await this.post<T>(
      "Authentication/ChangeLocation",
      undefined,
      {},
      { locationID: locationId },
    );
    this.locationId = locationId;
    return result;
  }

  change_location<T = unknown>(locationId: number): Promise<T> {
    return this.changeLocation<T>(locationId);
  }

  async request<T = unknown>(
    method: string,
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.requestRaw(method, endpoint, options);
    return this.decodeResponse(response) as T;
  }

  async requestRaw(
    method: string,
    endpoint: string,
    options: RequestOptions = {},
    retryAuth = true,
  ): Promise<TransportResponse> {
    const attempts = this.maxRetries + 1;
    if (attempts <= 0) {
      throw new RentManagerTransportError("Request failed.");
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let response: TransportResponse;
      try {
        response = await this.sendOnce(method, endpoint, options);
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) {
          if (error instanceof RentManagerTransportError) throw error;
          throw new RentManagerTransportError(
            error instanceof Error ? error.message : String(error),
            { cause: error },
          );
        }
        await wait(this.retryBackoffSeconds * attempt * 1_000);
        continue;
      }

      if (RETRYABLE_STATUS_CODES.has(response.statusCode) && attempt < attempts) {
        await wait(this.retryBackoffSeconds * attempt * 1_000);
        continue;
      }
      if (response.statusCode === 401 && (options.auth ?? true) && retryAuth) {
        await this.clearToken();
        await this.authenticate({ force: true });
        return this.requestRaw(method, endpoint, options, false);
      }
      if (response.isError) throw errorFromResponse(response);
      return response;
    }
    throw new RentManagerTransportError(
      lastError instanceof Error ? lastError.message : "Request failed.",
      { cause: lastError },
    );
  }

  request_raw(
    method: string,
    endpoint: string,
    options: RequestOptions = {},
    retryAuth = true,
  ): Promise<TransportResponse> {
    return this.requestRaw(method, endpoint, options, retryAuth);
  }

  get<T = unknown>(
    endpoint: string,
    query: QueryParamsInput = {},
    params: QueryRecord = {},
  ): Promise<T> {
    return this.request<T>("GET", endpoint, { query, params });
  }

  async downloadBytes(
    endpoint: string,
    query: QueryParamsInput = {},
    params: QueryRecord = {},
  ): Promise<Uint8Array> {
    const response = await this.requestRaw("GET", endpoint, { query, params });
    return response.body;
  }

  download_bytes(
    endpoint: string,
    query: QueryParamsInput = {},
    params: QueryRecord = {},
  ): Promise<Uint8Array> {
    return this.downloadBytes(endpoint, query, params);
  }

  post<T = unknown>(
    endpoint: string,
    json?: unknown,
    query: QueryParamsInput = {},
    params: QueryRecord = {},
  ): Promise<T> {
    return this.request<T>("POST", endpoint, { query, params, json });
  }

  delete<T = unknown>(
    endpoint: string,
    json?: unknown,
    query: QueryParamsInput = {},
    params: QueryRecord = {},
  ): Promise<T> {
    return this.request<T>("DELETE", endpoint, { query, params, json });
  }

  action<T = unknown>(
    endpoint: string,
    payload?: unknown,
    query: QueryParamsInput = {},
  ): Promise<T> {
    return this.post<T>(endpoint, payload, query);
  }

  postMultipart<T = unknown>(
    endpoint: string,
    files: MultipartFiles,
    data: QueryRecord | null = null,
    params: QueryRecord | null = null,
  ): Promise<T> {
    return this.request<T>("POST", endpoint, { files, data, params });
  }

  post_multipart<T = unknown>(
    endpoint: string,
    files: MultipartFiles,
    data: QueryRecord | null = null,
    params: QueryRecord | null = null,
  ): Promise<T> {
    return this.postMultipart<T>(endpoint, files, data, params);
  }

  async paginate<T = unknown>(
    endpoint: string,
    options: PaginationOptions = {},
  ): Promise<Page<T>> {
    const pageNumber = options.pageNumber ?? options.page_number ?? 1;
    const pageSize = options.pageSize ?? options.page_size ?? 1_000;
    const query = withoutPaginationControls(options);
    const params = {
      ...(options.params ?? {}),
      ...QueryParams.fromKwargs(query),
      ...new QueryParams({ pageNumber, pageSize }).toParams(),
    };
    const response = await this.requestRaw("GET", endpoint, { params });
    const decoded = this.decodeResponse(response);
    const rows = Array.isArray(decoded) ? decoded : [decoded];
    return new Page<T>({
      data: rows as T[],
      statusCode: response.statusCode,
      headers: response.headers,
      pageNumber,
      pageSize,
      totalResults: totalResultsFromHeaders(response.headers),
      links: parseLinkHeader(response.header("Link")),
    });
  }

  async *iterPages<T = unknown>(
    endpoint: string,
    options: IterPagesOptions = {},
  ): AsyncGenerator<Page<T>, void, void> {
    const pageSize = options.pageSize ?? options.page_size ?? 1_000;
    let pageNumber = options.startPage ?? options.start_page ?? 1;
    const maxPages = options.maxPages ?? options.max_pages ?? null;
    const query = withoutPaginationControls(options);
    let yielded = 0;
    while (true) {
      const page = await this.paginate<T>(endpoint, { ...query, pageNumber, pageSize });
      yield page;
      yielded += 1;
      if (maxPages !== null && yielded >= maxPages) break;
      if (!("next" in page.links)) break;
      pageNumber += 1;
    }
  }

  iter_pages<T = unknown>(
    endpoint: string,
    options: IterPagesOptions = {},
  ): AsyncIterable<Page<T>> {
    return this.iterPages<T>(endpoint, options);
  }

  private register<T extends Resource>(clientAttr: string, resource: T): T {
    this.#resources.set(clientAttr, resource);
    return resource;
  }

  private authPayload(): QueryRecord {
    const payload: QueryRecord = {
      Username: this.username,
      Password: this.password,
    };
    if (this.locationId !== null) payload.LocationID = this.locationId;
    return payload;
  }

  private async setToken(token: string): Promise<void> {
    this.#token = token;
    await this.tokenStore.save(token);
  }

  private async clearToken(): Promise<void> {
    this.#token = null;
    await this.tokenStore.clear();
  }

  private async ensureToken(): Promise<void> {
    if (this.#token) return;
    const cached = await this.tokenStore.load();
    if (cached) {
      this.#token = cached;
      return;
    }
    await this.authenticate({ force: true });
  }

  private endpointUrl(endpoint: string): string {
    return `${this.baseUrl}/${String(endpoint).replace(/^\/+|\/+$/g, "")}`;
  }

  private mergedParams(
    params: QueryRecord | null | undefined,
    query: QueryParamsInput | null | undefined,
  ): QueryRecord {
    return { ...(params ?? {}), ...QueryParams.fromKwargs(query ?? {}) };
  }

  private async sendOnce(
    method: string,
    endpoint: string,
    options: RequestOptions,
  ): Promise<TransportResponse> {
    const auth = options.auth ?? true;
    if (auth) await this.ensureToken();
    const headers: HeaderRecord = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };
    if (auth && this.#token) headers["X-RM12Api-ApiToken"] = this.#token;
    return this.transport.request({
      method: method.toUpperCase(),
      url: this.endpointUrl(endpoint),
      headers,
      params: this.mergedParams(options.params, options.query),
      json: options.json,
      data: options.data,
      timeoutMs: this.timeoutMs,
      ...(options.files !== undefined ? { files: options.files } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  }

  private decodeResponse(response: TransportResponse): unknown {
    if (response.statusCode === 204 || response.body.byteLength === 0) return {};
    try {
      return response.json();
    } catch {
      return response.text;
    }
  }
}

/**
 * Compatibility name retained from the Python/PHP packages. JavaScript I/O is
 * asynchronous by default, so it has the same behavior as RentManagerClient.
 */
export class AsyncRentManagerClient extends RentManagerClient {}
