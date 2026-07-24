# Contributing

Use Node.js 18 or newer. Install development dependencies with `npm install`,
then run:

```bash
npm run check
```

The endpoint, model, and generated-resource files derive from
`src/data/catalog.json`. After changing the catalog, run `npm run generate` and
commit both the source catalog and generated TypeScript.

Tests must use mock transports. Never add live credentials or customer data.
Live API experiments and all write/delete operations must be explicitly opt-in
and remain outside the automated suite.
