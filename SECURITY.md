# Security

Do not include credentials, API tokens, private keys, `.env` files, exports, or
real customer data in issues, tests, commits, or support requests.

Report suspected vulnerabilities privately to the repository owner rather than
opening a public issue. Include the affected version, reproduction steps, and
impact, while replacing all customer and credential data with synthetic values.

Token storage is memory-only unless `FileTokenStore` is selected explicitly.
Persistent token files and service-ticket exports should remain outside shared
or web-served directories.
