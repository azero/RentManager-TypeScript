# RentManager-TypeScript

[![CI](https://github.com/azero/RentManager-TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/azero/RentManager-TypeScript/actions/workflows/ci.yml)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-339933.svg)](https://nodejs.org/)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue.svg)](LICENSE)

A typed, asynchronous TypeScript SDK for Rent Manager WAPI12, ported from the
companion Python and PHP implementations. It combines generated resource
namespaces for the known API catalog with a generic request interface so newly
discovered endpoints remain usable immediately.

> This is an independent, community-maintained project. It is not affiliated
> with, endorsed by, or supported by Rent Manager or London Computer Systems.
> You need your own authorized WAPI12 account and must follow the provider's
> terms and your organization’s data-handling requirements.

## Features

- Zero runtime dependencies; uses the standard Fetch, FormData, and Blob APIs
- 338 generated resource namespaces and 361 permissive model classes
- 1,579-entry endpoint registry copied from the Python/PHP source catalog
- Automatic authentication, token reuse, one-time 401 reauthentication, retries, and timeouts
- RQL filters, fields, embeds, ordering, save options, pagination, and async page iteration
- Structured API, authentication, permission, conflict, rate-limit, server, and transport errors
- Multipart uploads and raw binary downloads
- Memory or private file-backed token storage
- Email lookup and detailed service-ticket export workflows
- Both camelCase TypeScript names and snake_case Python compatibility aliases

## Install

Until an npm package is published, install from the repository:

```bash
npm install github:azero/RentManager-TypeScript
```

For development:

```bash
npm install
npm run check
```

Node.js 18 or newer is required.

## Quick start

```ts
import { RentManagerClient, RQL } from "@azero/rentmanager-api";

const client = new RentManagerClient({
  corpId: "your-corp-id",
  username: "your-api-user",
  password: "your-password",
  locationId: 1,
});

try {
  const tenants = await client.tenants.list({
    fields: ["TenantID", "Name"],
    filters: [RQL.eq("IsActive", true)],
    pageSize: 100,
  });

  for (const tenant of tenants) {
    console.log(tenant.TenantID, tenant.Name);
  }
} finally {
  await client.close();
}
```

The default base URL is `https://<corp-id>.api.rentmanager.com`. Supply
`baseUrl` for another environment.

## Generic endpoint access

```ts
const rows = await client.get("CustomResource", {
  filters: RQL.ct("Name", "Smith"),
});

const result = await client.action("RecurringCharges/PostRecurringCharges", {
  PostDate: "2026-07-09",
});
```

All generated resources inherit:

```ts
resource.list(query)
resource.get(id, query)
resource.create(payload, query)
resource.update(id, payload, query)
resource.delete(id)
resource.deleteMany(ids, query)
resource.paginate(options)
resource.iterPages(options)
```

Catalog resource properties are available in both naming styles:

```ts
await client.accountGroupMasterPayments.list();   // TypeScript
await client.account_group_master_payments.list(); // Python-compatible
```

## Pagination

```ts
for await (const page of client.tenants.iterPages({
  pageSize: 250,
  filters: RQL.eq("IsActive", true),
})) {
  console.log(page.pageNumber, page.totalResults, page.data);
}
```

## Token storage

Tokens stay in memory by default. Persistent storage is explicit:

```ts
import { FileTokenStore, RentManagerClient } from "@azero/rentmanager-api";

const client = new RentManagerClient({
  corpId: "your-corp-id",
  username: "your-api-user",
  password: "your-password",
  tokenStore: new FileTokenStore(".rentmanager-token.json"),
});
```

Never commit credentials, token files, `.env` files, exports, or customer data.

## Multipart uploads and downloads

```ts
await client.serviceManager.issues.uploadAttachment(123, {
  file: ["photo.jpg", photoBytes, "image/jpeg"],
});

const pdf = await client.downloadBytes("Files/44");
```

## Workflows

```ts
import {
  exportNewestServiceTicketDetails,
  lookupByEmail,
} from "@azero/rentmanager-api/workflows";

const matches = await lookupByEmail(client, "tenant@example.com");

const manifest = await exportNewestServiceTicketDetails(client, {
  limit: 10,
  exportRoot: "service-ticket-exports",
});
```

Ticket exports may contain tenant, vendor, history, billing, and attachment
metadata. The workflow creates private directories/files where the operating
system supports permissions.

## Endpoint coverage

```ts
import { EndpointRegistry } from "@azero/rentmanager-api/catalog";

for (const endpoint of EndpointRegistry.default()) {
  console.log(endpoint.method, endpoint.path, endpoint.confidence);
}
```

See [the parity matrix](docs/PARITY.md) for the porting contract.

## License

This project is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE), matching the Python and PHP
projects. Commercial use requires separate permission from the copyright holder.
