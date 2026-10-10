import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { test } from "node:test";

const root = resolve(".");
function routes(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? routes(join(folder, entry.name)) : entry.name === "route.ts" ? [join(folder, entry.name)] : []);
}
test("every remaining direct API JSON route retains an explicit reviewed owner", () => {
  const registry = join(root, ".agentic/registries");
  const audit = JSON.parse(readFileSync(join(registry, "EXACT_BOUNDARY_DIRECT_JSON.json"), "utf8")) as {
    routes: { path: string; policy: string; contract: string }[];
  };
  const actual = routes(join(root, "app/api")).filter(path => readFileSync(path, "utf8").includes("NextResponse.json"))
    .map(path => path.slice(root.length + 1).replaceAll("\\", "/")).sort();
  assert.deepEqual(audit.routes.map(row => row.path).sort(), actual);
  assert.equal(new Set(actual).size, audit.routes.length);
  for (const row of audit.routes) {
    assert.ok(row.policy.length > 30, row.path);
    assert.ok(readFileSync(join(registry, row.contract), "utf8").length > 0, row.contract);
  }
});

test("the parent inventory resolves every linked operation registry for all four rollout groups", () => {
  const registry = join(root, ".agentic/registries"), visited = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const content = readFileSync(join(registry, name), "utf8");
    for (const match of content.matchAll(/\]\(([^/()]+\.md)(?:#[^()]*)?\)/g)) visit(match[1]);
  }
  visit("EXACT_API_BOUNDARY_CONTRACTS.md");
  for (const name of ["FX_WIRE_CONTRACTS.md", "CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md",
    "AUXILIARY_REPORT_INTEGRATION_CONTRACTS.md", "PUBLIC_BOUNDARY_INTEGRATION_CONTRACTS.md",
    "CONTACT_WIRE_CONTRACTS.md", "INVOICE_WRITE_WIRE_CONTRACTS.md", "PAYROLL_RUN_WIRE_CONTRACTS.md",
    "BACKUP_WIRE_CONTRACTS.md", "DOCUMENT_RENDER_WIRE_CONTRACTS.md"]) assert.ok(visited.has(name), name);
});
