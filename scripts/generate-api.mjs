import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const backendContract = resolve(root, "..", "one", "contracts", "openapi.json");
const pinnedContract = resolve(root, "contracts", "openapi.json");
const output = resolve(root, "src", "api", "schema.d.ts");
const source = existsSync(backendContract) ? backendContract : pinnedContract;

if (!existsSync(source)) {
  console.error(`OpenAPI contract not found at ${source}`);
  process.exit(1);
}

console.log(`Generating TypeScript client types from ${source}`);
const result = spawnSync("openapi-typescript", [source, "-o", output], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
