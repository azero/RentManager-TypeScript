export type Awaitable<T> = T | PromiseLike<T>;

export type QueryScalar = string | number | boolean | bigint | Date | null | undefined;
export type QueryValue = QueryScalar | readonly QueryScalar[];
export type QueryRecord = Record<string, unknown>;
export type HeaderRecord = Record<string, string>;

export interface QueryParamsInput {
  fields?: string | readonly string[] | null;
  embed?: string | readonly string[] | null;
  embeds?: string | readonly string[] | null;
  filter?: string | readonly string[] | null;
  filters?: string | readonly string[] | null;
  pageNumber?: number | null;
  page_number?: number | null;
  pagenumber?: number | null;
  pageSize?: number | null;
  page_size?: number | null;
  pagesize?: number | null;
  noContent?: boolean | null;
  no_content?: boolean | null;
  nocontent?: boolean | null;
  orderBy?: string | readonly string[] | null;
  order_by?: string | readonly string[] | null;
  orderby?: string | readonly string[] | null;
  saveOptions?: SaveOptions | null;
  save_options?: SaveOptions | null;
  SaveOptions?: SaveOptions | null;
  extra?: QueryRecord;
  [key: string]: unknown;
}

export type SaveOptions =
  | string
  | readonly string[]
  | Readonly<Record<string, boolean>>;

export type BinaryBody = Blob | ArrayBuffer | ArrayBufferView | string;

export type MultipartTuple =
  | readonly [filename: string | null, body: BinaryBody]
  | readonly [filename: string | null, body: BinaryBody, contentType: string];

export interface MultipartPart {
  body: BinaryBody;
  filename?: string | null;
  contentType?: string;
}

export type MultipartValue = BinaryBody | MultipartTuple | MultipartPart;
export type MultipartFiles = FormData | Readonly<Record<string, MultipartValue | readonly MultipartValue[]>>;

export interface RequestOptions {
  params?: QueryRecord | null;
  query?: QueryParamsInput | null;
  json?: unknown;
  data?: unknown;
  files?: MultipartFiles | null;
  auth?: boolean;
  headers?: HeaderRecord | null;
  signal?: AbortSignal | null;
}

export interface ClientSettings {
  username: string;
  password: string;
  locationId?: number | null | undefined;
  location_id?: number | null | undefined;
  baseUrl?: string | null | undefined;
  base_url?: string | null | undefined;
  timeout?: number | undefined;
  timeoutMs?: number | undefined;
  timeout_ms?: number | undefined;
  maxRetries?: number | undefined;
  max_retries?: number | undefined;
  retryBackoffSeconds?: number | undefined;
  retry_backoff_seconds?: number | undefined;
  tokenStore?: import("./token-store.js").TokenStore | null | undefined;
  token_store?: import("./token-store.js").TokenStore | null | undefined;
  transport?: import("./transport.js").Transport | null | undefined;
}

export type ClientOptions = ClientSettings &
  (
    | { corpId: string; corp_id?: string }
    | { corpId?: string; corp_id: string }
  );
