# Source baseline

This port was implemented against the following `main` revisions:

- `azero/rentmanager_python` — `9788a6a`
- `azero/rentmanager_php` — `69bfed3`

The imported `src/data/catalog.json` has SHA-256:

```text
C58333F6C17013E6977953FA591AC9723FA9CDF8D2BEC698DDF72DF4E7087ED5
```

The catalog is copied byte-for-byte from the PHP revision. Runtime behavior,
specialized resources, and the richer service-ticket workflow were ported from
the Python revision, with the PHP implementation used to verify naming and
Node-appropriate compatibility decisions.

Run `npm run generate` after a catalog update and `npm run check` before
releasing. `npm run check:generated` fails if committed generated sources no
longer match the source catalog.
