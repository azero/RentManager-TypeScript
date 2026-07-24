import type { RMBaseModel, ModelConstructor } from "./models-base.js";
import type { Page } from "./pagination.js";
import { pathSegment } from "./support.js";
import type {
  BinaryBody,
  MultipartFiles,
  QueryParamsInput,
  QueryRecord,
} from "./types.js";
import {
  Amenity,
  Charge,
  ChargeType,
  Contact,
  GLAccount,
  HistoryItem,
  Lease,
  Location,
  Owner,
  OwnerCheck,
  Payment,
  Property,
  PropertyGroup,
  Prospect,
  RecurringCharge,
  ReportWriterReport,
  ServiceManagerCategory,
  ServiceManagerIssue,
  ServiceManagerPriority,
  ServiceManagerStatus,
  Task,
  Tenant,
  Transaction,
  Unit,
  UnitType,
  User,
  UserDefinedField,
  UserDefinedValue,
  Vendor,
  VendorBill,
} from "./generated/models.js";

export type ResourceId = string | number | bigint;

export interface ResourceClient {
  jsonDumps(payload: unknown): string;
  json_dumps(payload: unknown): string;
  get<T = unknown>(endpoint: string, query?: QueryParamsInput, params?: QueryRecord): Promise<T>;
  post<T = unknown>(
    endpoint: string,
    json?: unknown,
    query?: QueryParamsInput,
    params?: QueryRecord,
  ): Promise<T>;
  delete<T = unknown>(
    endpoint: string,
    json?: unknown,
    query?: QueryParamsInput,
    params?: QueryRecord,
  ): Promise<T>;
  postMultipart<T = unknown>(
    endpoint: string,
    files: MultipartFiles,
    data?: QueryRecord | null,
    params?: QueryRecord | null,
  ): Promise<T>;
  paginate<T = unknown>(
    endpoint: string,
    options?: PaginationOptions,
  ): Promise<Page<T>>;
  iterPages<T = unknown>(
    endpoint: string,
    options?: IterPagesOptions,
  ): AsyncIterable<Page<T>>;
}

export interface PaginationOptions extends QueryParamsInput {
  pageNumber?: number | null;
  page_number?: number | null;
  pageSize?: number | null;
  page_size?: number | null;
  params?: QueryRecord | null;
}

export interface IterPagesOptions extends QueryParamsInput {
  pageSize?: number | null;
  page_size?: number | null;
  startPage?: number | null;
  start_page?: number | null;
  maxPages?: number | null;
  max_pages?: number | null;
}

export class Resource<T extends RMBaseModel = RMBaseModel> {
  readonly client: ResourceClient;
  readonly path: string;
  readonly model: ModelConstructor<T> | null;

  constructor(client: ResourceClient, path: string, model: ModelConstructor<T> | null = null) {
    this.client = client;
    this.path = path;
    this.model = model;
  }

  protected coerce<U extends RMBaseModel>(
    value: unknown,
    model: ModelConstructor<U> | null = this.model as unknown as ModelConstructor<U> | null,
  ): U | U[] | unknown {
    if (!model) return value;
    if (Array.isArray(value)) {
      return value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? new model(item as Record<string, unknown>)
          : item,
      );
    }
    if (value !== null && typeof value === "object") {
      return new model(value as Record<string, unknown>);
    }
    return value;
  }

  protected async getChild<U extends RMBaseModel>(
    path: string,
    model: ModelConstructor<U> | null,
    query: QueryParamsInput = {},
  ): Promise<U | U[] | unknown> {
    return this.coerce(await this.client.get(path, query), model);
  }

  protected async postChild<U extends RMBaseModel>(
    path: string,
    payload: unknown,
    model: ModelConstructor<U> | null,
    query: QueryParamsInput = {},
  ): Promise<U | U[] | unknown> {
    return this.coerce(await this.client.post(path, payload, query), model);
  }

  async list(query: QueryParamsInput = {}): Promise<T[]> {
    return this.coerce(await this.client.get(this.path, query)) as T[];
  }

  async get(itemId: ResourceId, query: QueryParamsInput = {}): Promise<T> {
    return this.coerce(
      await this.client.get(`${this.path}/${pathSegment(itemId)}`, query),
    ) as T;
  }

  async create(payload: unknown, query: QueryParamsInput = {}): Promise<T | T[]> {
    return this.coerce(await this.client.post(this.path, payload, query)) as T | T[];
  }

  async update(
    itemId: ResourceId,
    payload: unknown,
    query: QueryParamsInput = {},
  ): Promise<T | T[]> {
    return this.coerce(
      await this.client.post(`${this.path}/${pathSegment(itemId)}`, payload, query),
    ) as T | T[];
  }

  async delete(
    itemId: ResourceId | null = null,
    ids: readonly number[] | null = null,
    query: QueryParamsInput = {},
  ): Promise<unknown> {
    if (itemId !== null) {
      return this.client.delete(`${this.path}/${pathSegment(itemId)}`, undefined, query);
    }
    return this.client.delete(this.path, ids, query);
  }

  async deleteMany(ids: readonly number[], query: QueryParamsInput = {}): Promise<unknown> {
    return this.delete(null, ids, query);
  }

  delete_many(ids: readonly number[], query: QueryParamsInput = {}): Promise<unknown> {
    return this.deleteMany(ids, query);
  }

  paginate(options: PaginationOptions = {}): Promise<Page<T>> {
    return this.client.paginate<T>(this.path, options);
  }

  iterPages(options: IterPagesOptions = {}): AsyncIterable<Page<T>> {
    return this.client.iterPages<T>(this.path, options);
  }

  iter_pages(options: IterPagesOptions = {}): AsyncIterable<Page<T>> {
    return this.iterPages(options);
  }
}

export class ContactsResource extends Resource<Contact> {
  constructor(client: ResourceClient) { super(client, "Contacts", Contact); }
}

export class TasksResource extends Resource<Task> {
  constructor(client: ResourceClient) { super(client, "Tasks", Task); }
}

export class OwnersResource extends Resource<Owner> {
  constructor(client: ResourceClient) { super(client, "Owners", Owner); }

  history(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Owners/${pathSegment(ownerId)}/History`, HistoryItem, query);
  }
  ownerChecks(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Owners/${pathSegment(ownerId)}/OwnerChecks`, OwnerCheck, query);
  }
  owner_checks(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.ownerChecks(ownerId, query);
  }
  payments(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Owners/${pathSegment(ownerId)}/Payments`, Payment, query);
  }
  charges(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Owners/${pathSegment(ownerId)}/Charges`, Charge, query);
  }
  contact(ownerId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Owners/${pathSegment(ownerId)}/Contact`, Contact, query);
  }
}

export class TenantsResource extends Resource<Tenant> {
  constructor(client: ResourceClient) { super(client, "Tenants", Tenant); }

  transactions(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/Transactions`, Transaction, query);
  }
  history(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/History`, HistoryItem, query);
  }
  contacts(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/Contacts`, Contact, query);
  }
  leases(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/Leases`, Lease, query);
  }
  recurringCharges(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/RecurringCharges`, RecurringCharge, query);
  }
  recurring_charges(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.recurringCharges(tenantId, query);
  }
  createRecurringCharge(tenantId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild(
      `Tenants/${pathSegment(tenantId)}/RecurringCharges`,
      payload,
      RecurringCharge,
      query,
    );
  }
  create_recurring_charge(tenantId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.createRecurringCharge(tenantId, payload, query);
  }
  userDefinedValues(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/UserDefinedValues`, UserDefinedValue, query);
  }
  user_defined_values(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.userDefinedValues(tenantId, query);
  }
  updateUserDefinedValues(tenantId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild(
      `Tenants/${pathSegment(tenantId)}/UserDefinedValues`,
      payload,
      UserDefinedValue,
      query,
    );
  }
  update_user_defined_values(tenantId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.updateUserDefinedValues(tenantId, payload, query);
  }
  userDefinedFields(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/UserDefinedFields`, UserDefinedField, query);
  }
  user_defined_fields(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.userDefinedFields(tenantId, query);
  }
  addresses(tenantId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Tenants/${pathSegment(tenantId)}/Addresses`, null, query);
  }
  uploadUserDefinedValueAttachment(
    tenantId: ResourceId,
    udfId: ResourceId,
    file: BinaryBody,
    filename: string,
    data: QueryRecord = {},
  ) {
    const payload = { UserDefinedFieldID: udfId, ParentID: tenantId, ...data };
    return this.client.postMultipart(
      `Tenants/${pathSegment(tenantId)}/UploadUserDefinedValueAttachment`,
      {
        file: [filename, file],
        udf: [null, this.client.jsonDumps(payload), "application/json"],
      },
    );
  }
  upload_user_defined_value_attachment(
    tenantId: ResourceId,
    udfId: ResourceId,
    file: BinaryBody,
    filename: string,
    data: QueryRecord = {},
  ) {
    return this.uploadUserDefinedValueAttachment(tenantId, udfId, file, filename, data);
  }
}

export class ProspectsResource extends Resource<Prospect> {
  constructor(client: ResourceClient) { super(client, "Prospects", Prospect); }
  history(prospectId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Prospects/${pathSegment(prospectId)}/History`, HistoryItem, query);
  }
  contacts(prospectId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Prospects/${pathSegment(prospectId)}/Contacts`, Contact, query);
  }
}

export class VendorsResource extends Resource<Vendor> {
  constructor(client: ResourceClient) { super(client, "Vendors", Vendor); }
  history(vendorId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Vendors/${pathSegment(vendorId)}/History`, HistoryItem, query);
  }
  transactions(vendorId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Vendors/${pathSegment(vendorId)}/Transactions`, Transaction, query);
  }
  contacts(vendorId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Vendors/${pathSegment(vendorId)}/Contacts`, Contact, query);
  }
  bills(vendorId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Vendors/${pathSegment(vendorId)}/Bills`, VendorBill, query);
  }
}

export class PropertiesResource extends Resource<Property> {
  constructor(client: ResourceClient) { super(client, "Properties", Property); }
  units(propertyId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Properties/${pathSegment(propertyId)}/Units`, Unit, query);
  }
}

export class UnitsResource extends Resource<Unit> {
  constructor(client: ResourceClient) { super(client, "Units", Unit); }
  leases(unitId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Units/${pathSegment(unitId)}/Leases`, Lease, query);
  }
  userDefinedValues(unitId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`Units/${pathSegment(unitId)}/UserDefinedValues`, UserDefinedValue, query);
  }
  user_defined_values(unitId: ResourceId, query: QueryParamsInput = {}) {
    return this.userDefinedValues(unitId, query);
  }
  linkAmenities(unitId: ResourceId, unitAmenityIds: readonly number[] | number) {
    const ids = Array.isArray(unitAmenityIds) ? unitAmenityIds : [unitAmenityIds];
    return this.client.post(`Units/${pathSegment(unitId)}/LinkAmenities`, ids);
  }
  link_amenities(unitId: ResourceId, unitAmenityIds: readonly number[] | number) {
    return this.linkAmenities(unitId, unitAmenityIds);
  }
  unlinkAmenities(unitId: ResourceId, unitAmenityIds: readonly number[] | number) {
    const ids = Array.isArray(unitAmenityIds) ? unitAmenityIds : [unitAmenityIds];
    return this.client.delete(`Units/${pathSegment(unitId)}/UnLinkAmenities`, ids);
  }
  unlink_amenities(unitId: ResourceId, unitAmenityIds: readonly number[] | number) {
    return this.unlinkAmenities(unitId, unitAmenityIds);
  }
}

export class LeasesResource extends Resource<Lease> {
  constructor(client: ResourceClient) { super(client, "Leases", Lease); }
}

export class UsersResource extends Resource<User> {
  constructor(client: ResourceClient) { super(client, "Users", User); }
  currentUser(query: QueryParamsInput = {}) {
    return this.getChild("Users/CurrentUser", User, query);
  }
  current_user(query: QueryParamsInput = {}) { return this.currentUser(query); }
}

export class LocationsResource extends Resource<Location> {
  constructor(client: ResourceClient) { super(client, "Locations", Location); }
}

export class PropertyGroupsResource extends Resource<PropertyGroup> {
  constructor(client: ResourceClient) { super(client, "PropertyGroups", PropertyGroup); }
}

export class AmenitiesResource extends Resource<Amenity> {
  constructor(client: ResourceClient) { super(client, "Amenities", Amenity); }
}

export class GLAccountsResource extends Resource<GLAccount> {
  constructor(client: ResourceClient) { super(client, "GLAccounts", GLAccount); }
}

export class ChargeTypesResource extends Resource<ChargeType> {
  constructor(client: ResourceClient) { super(client, "ChargeTypes", ChargeType); }
}

export class UnitTypesResource extends Resource<UnitType> {
  constructor(client: ResourceClient) { super(client, "UnitTypes", UnitType); }
}

export class RecurringChargesResource extends Resource<RecurringCharge> {
  constructor(client: ResourceClient) { super(client, "RecurringCharges", RecurringCharge); }
  postRecurringCharges(payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild("RecurringCharges/PostRecurringCharges", payload, null, query);
  }
  post_recurring_charges(payload: unknown, query: QueryParamsInput = {}) {
    return this.postRecurringCharges(payload, query);
  }
}

export class ReportWriterReportsResource extends Resource<ReportWriterReport> {
  constructor(client: ResourceClient) { super(client, "ReportWriterReports", ReportWriterReport); }
  run(reportId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(
      `ReportWriterReports/${pathSegment(reportId)}/RunReportWriterReport`,
      null,
      query,
    );
  }
}

export class ServiceManagerIssuesResource extends Resource<ServiceManagerIssue> {
  constructor(client: ResourceClient) {
    super(client, "ServiceManagerIssues", ServiceManagerIssue);
  }
  linkProperty(issueId: ResourceId, propertyId: ResourceId) {
    return this.client.post(
      `ServiceManagerIssues/${pathSegment(issueId)}/LinkProperty`,
      undefined,
      {},
      { propertyID: propertyId },
    );
  }
  link_property(issueId: ResourceId, propertyId: ResourceId) {
    return this.linkProperty(issueId, propertyId);
  }
  linkUnit(issueId: ResourceId, unitId: ResourceId) {
    return this.client.post(
      `ServiceManagerIssues/${pathSegment(issueId)}/LinkUnit`,
      undefined,
      {},
      { unitID: unitId },
    );
  }
  link_unit(issueId: ResourceId, unitId: ResourceId) {
    return this.linkUnit(issueId, unitId);
  }
  history(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/History`, HistoryItem, query);
  }
  addHistory(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild(
      `ServiceManagerIssues/${pathSegment(issueId)}/History`,
      payload,
      HistoryItem,
      query,
    );
  }
  add_history(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.addHistory(issueId, payload, query);
  }
  properties(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/Properties`, Property, query);
  }
  attachments(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/Attachments`, null, query);
  }
  files(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/Files`, null, query);
  }
  documents(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/Documents`, null, query);
  }
  lineItems(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(`ServiceManagerIssues/${pathSegment(issueId)}/LineItems`, null, query);
  }
  line_items(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.lineItems(issueId, query);
  }
  addLineItems(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild(
      `ServiceManagerIssues/${pathSegment(issueId)}/LineItems`,
      payload,
      null,
      query,
    );
  }
  add_line_items(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.addLineItems(issueId, payload, query);
  }
  userDefinedValues(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(
      `ServiceManagerIssues/${pathSegment(issueId)}/UserDefinedValues`,
      UserDefinedValue,
      query,
    );
  }
  user_defined_values(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.userDefinedValues(issueId, query);
  }
  updateUserDefinedValues(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.postChild(
      `ServiceManagerIssues/${pathSegment(issueId)}/UserDefinedValues`,
      payload,
      UserDefinedValue,
      query,
    );
  }
  update_user_defined_values(issueId: ResourceId, payload: unknown, query: QueryParamsInput = {}) {
    return this.updateUserDefinedValues(issueId, payload, query);
  }
  userDefinedFields(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.getChild(
      `ServiceManagerIssues/${pathSegment(issueId)}/UserDefinedFields`,
      UserDefinedField,
      query,
    );
  }
  user_defined_fields(issueId: ResourceId, query: QueryParamsInput = {}) {
    return this.userDefinedFields(issueId, query);
  }
  uploadAttachment(issueId: ResourceId, files: MultipartFiles, data: QueryRecord | null = null) {
    return this.client.postMultipart(
      `ServiceManagerIssues/${pathSegment(issueId)}/Attachments`,
      files,
      data,
    );
  }
  upload_attachment(issueId: ResourceId, files: MultipartFiles, data: QueryRecord | null = null) {
    return this.uploadAttachment(issueId, files, data);
  }
  uploadSignatureFile(issueId: ResourceId, files: MultipartFiles, data: QueryRecord | null = null) {
    return this.client.postMultipart(
      `ServiceManagerIssues/${pathSegment(issueId)}/UploadSignatureFile`,
      files,
      data,
    );
  }
  upload_signature_file(issueId: ResourceId, files: MultipartFiles, data: QueryRecord | null = null) {
    return this.uploadSignatureFile(issueId, files, data);
  }
}

export class ServiceManagerStatusesResource extends Resource<ServiceManagerStatus> {
  constructor(client: ResourceClient) {
    super(client, "ServiceManagerStatuses", ServiceManagerStatus);
  }
}

export class ServiceManagerCategoriesResource extends Resource<ServiceManagerCategory> {
  constructor(client: ResourceClient) {
    super(client, "ServiceManagerCategories", ServiceManagerCategory);
  }
}

export class ServiceManagerPrioritiesResource extends Resource<ServiceManagerPriority> {
  constructor(client: ResourceClient) {
    super(client, "ServiceManagerPriorities", ServiceManagerPriority);
  }
}

export class ServiceManagerNamespace {
  readonly issues: ServiceManagerIssuesResource;
  readonly statuses: ServiceManagerStatusesResource;
  readonly categories: ServiceManagerCategoriesResource;
  readonly priorities: ServiceManagerPrioritiesResource;

  constructor(client: ResourceClient) {
    this.issues = new ServiceManagerIssuesResource(client);
    this.statuses = new ServiceManagerStatusesResource(client);
    this.categories = new ServiceManagerCategoriesResource(client);
    this.priorities = new ServiceManagerPrioritiesResource(client);
  }
}
