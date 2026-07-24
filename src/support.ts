const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "api_token",
  "apitoken",
  "access_token",
  "refresh_token",
  "password",
  "secret",
]);

export function redactSensitiveUrl(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    if (url.password) url.password = "[REDACTED]";
    return url.toString();
  } catch {
    return value;
  }
}

export const redact_sensitive_url = redactSensitiveUrl;

export function pathSegment(value: string | number | bigint): string {
  return encodeURIComponent(String(value));
}

export const path_segment = pathSegment;

export function headersToRecord(headers: Headers | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return { ...headers };
}
