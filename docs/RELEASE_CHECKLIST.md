# Release checklist

1. Confirm `CHANGELOG.md`, `package.json`, and the release tag use the same version.
2. Run `npm ci`.
3. Run `npm run check`.
4. Run `npm run test:coverage`.
5. Run `npm audit --audit-level=low`.
6. Run `npm pack --dry-run`.
7. Install the tarball into a clean temporary project and smoke-test ESM and CommonJS on Node.js 18.
8. Tag the verified commit as `vX.Y.Z`.
9. Push `main` and the tag.
10. Publish a GitHub release and attach the generated `.tgz` package.
11. Confirm the repository is public, `main` is the default branch, CI passes, and private vulnerability reporting is enabled.
