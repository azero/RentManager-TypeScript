# Python/PHP parity

The TypeScript package treats the Python runtime behavior and PHP generated
catalog as the compatibility specification.

| Capability | TypeScript implementation |
| --- | --- |
| Authentication | `authenticate`, token authorization, location changes, cached tokens |
| Transport | Fetch-based, injectable, timeouts, retries, automatic one-time 401 reauthentication |
| Generic API | `request`, `get`, `post`, `delete`, `action`, multipart upload, binary download |
| Queries | All RQL operators, fields, embeds, filters, ordering, pagination, `SaveOptions`, extra parameters |
| Pagination | `Page`, link parsing, total-result parsing, async page iteration |
| Errors | Full status-class mapping and structured Rent Manager error payloads |
| Models | 361 permissive runtime model classes retaining unknown WAPI fields |
| Resources | 338 catalog resources plus all specialized core child/action methods |
| Endpoint registry | 1,579 entries with model, confidence, and source metadata |
| Naming compatibility | camelCase TypeScript names plus snake_case Python aliases; generated client resources expose both |
| Workflows | Email lookup; newest-ticket selection; ticket details, relations, billing, documents, attachments, and private export |

JavaScript is asynchronous by design. `AsyncRentManagerClient` is retained as a
compatibility subclass, while `RentManagerClient` already returns promises and
async iterables.

Generated model fields are permissive because the authenticated WAPI Help
catalog provides names but not a stable public schema for every field type.
Frequently used core fields retain concrete TypeScript types; other catalog
fields are `unknown` and extra fields are preserved.

The exact upstream revisions and imported catalog checksum are recorded in
[SOURCE_BASELINE.md](SOURCE_BASELINE.md).
