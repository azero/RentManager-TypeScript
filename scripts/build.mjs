import { rm } from "node:fs/promises";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, "dist");
const entryPoints = {
  index: path.join(root, "src", "index.ts"),
  catalog: path.join(root, "src", "catalog.ts"),
  "workflows/index": path.join(root, "src", "workflows", "index.ts"),
};

await rm(outdir, { recursive: true, force: true });

const common = {
  entryPoints,
  outdir,
  bundle: true,
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
};

await Promise.all([
  build({
    ...common,
    format: "esm",
    outExtension: { ".js": ".js" },
  }),
  build({
    ...common,
    format: "cjs",
    outExtension: { ".js": ".cjs" },
  }),
]);
