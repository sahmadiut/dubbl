import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertFunctionalCurrencyEnabled, CurrencyRolloutError, IRR_FINANCIAL_GATE_PASSED, readCurrencyRollout } from "../lib/currency/rollout";
import { functionalCurrencySchema } from "../lib/currency/functional-currency";

test("functional IRR is disabled by default in every runtime", () => {
  for (const NODE_ENV of [undefined, "development", "test", "production"]) {
    const env = { NODE_ENV };
    assert.deepEqual(readCurrencyRollout(env), { irrEnabled: false });
    assert.throws(() => assertFunctionalCurrencyEnabled(" irr ", env), CurrencyRolloutError);
    for (const code of ["USD", "EUR", "JPY", "KWD"]) {
      assert.doesNotThrow(() => assertFunctionalCurrencyEnabled(code, env));
    }
  }
});

test("environment flags cannot attest financial readiness", () => {
  for (const NODE_ENV of ["development", "production"]) {
    assert.throws(() => readCurrencyRollout({ IRR_PRODUCTION_ENABLED: "true", NODE_ENV }), /before financial qualification/);
    assert.deepEqual(readCurrencyRollout({ IRR_PRODUCTION_ENABLED: "false", NODE_ENV }), { irrEnabled: false });
  }
  assert.throws(() => readCurrencyRollout({ IRR_PRODUCTION_ENABLED: "true", IRR_FINANCIAL_GATE_PASSED: "true" }), /before financial qualification/);
  assert.throws(() => assertFunctionalCurrencyEnabled("IRR", { NEXT_PUBLIC_IRR_PRODUCTION_ENABLED: "true" }), CurrencyRolloutError);
});

test("ambiguous flag values fail closed, even for non-IRR selection", () => {
  for (const value of ["", "1", "0", "TRUE", "False", "yes", " true "]) {
    assert.throws(() => readCurrencyRollout({ IRR_PRODUCTION_ENABLED: value }), /exactly true or false/);
    assert.throws(() => assertFunctionalCurrencyEnabled("USD", { IRR_PRODUCTION_ENABLED: value }), CurrencyRolloutError);
    assert.throws(() => readCurrencyRollout({ IRR_TESTING_ENABLED: value }), /exactly true or false/);
  }
});

test("explicit temporary testing opt-in allows IRR without claiming production readiness", () => {
  assert.equal(IRR_FINANCIAL_GATE_PASSED, false);
  for (const NODE_ENV of ["development", "test"]) {
    const env = { NODE_ENV, IRR_PRODUCTION_ENABLED: "false", IRR_TESTING_ENABLED: "true" };
    assert.deepEqual(readCurrencyRollout(env), { irrEnabled: true });
    assert.doesNotThrow(() => assertFunctionalCurrencyEnabled("IRR", env));
    assert.deepEqual(readCurrencyRollout({ ...env, IRR_TESTING_ENABLED: "false" }), { irrEnabled: false });
    assert.throws(() => readCurrencyRollout({ ...env, IRR_PRODUCTION_ENABLED: "true" }), /before financial qualification/);
  }
  for (const NODE_ENV of [undefined, "production", "preview", "Development"]) {
    assert.throws(() => readCurrencyRollout({ NODE_ENV, IRR_TESTING_ENABLED: "true" }), /development or test runtime/);
  }
  assert.deepEqual(readCurrencyRollout({ NEXT_PUBLIC_IRR_TESTING_ENABLED: "true" }), { irrEnabled: false });
});

test("temporary testing opt-in reaches the actual shared REST/MCP currency schema", () => {
  const env: Record<string, string | undefined> = process.env;
  const previous = process.env.IRR_TESTING_ENABLED;
  const previousRuntime = env.NODE_ENV;
  try {
    env.NODE_ENV = "test";
    process.env.IRR_TESTING_ENABLED = "true";
    assert.equal(functionalCurrencySchema.parse(" irr "), "IRR");
    process.env.IRR_TESTING_ENABLED = "false";
    assert.throws(() => functionalCurrencySchema.parse("IRR"), CurrencyRolloutError);
  } finally {
    if (previous === undefined) delete process.env.IRR_TESTING_ENABLED;
    else process.env.IRR_TESTING_ENABLED = previous;
    if (previousRuntime === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousRuntime;
  }
});

test("REST and MCP shared selection schema normalizes codes and rejects IRR", () => {
  const previous = process.env.IRR_PRODUCTION_ENABLED;
  process.env.IRR_PRODUCTION_ENABLED = "false";
  try {
    assert.equal(functionalCurrencySchema.parse(" usd "), "USD");
    assert.equal(functionalCurrencySchema.parse("JPY"), "JPY");
    assert.throws(() => functionalCurrencySchema.parse(" irr "), CurrencyRolloutError);
    assert.throws(() => functionalCurrencySchema.parse("not-a-currency"), /Unrecognized/);
    process.env.IRR_PRODUCTION_ENABLED = "true";
    assert.throws(() => functionalCurrencySchema.parse("IRR"), /before financial qualification/);
  } finally {
    if (previous === undefined) delete process.env.IRR_PRODUCTION_ENABLED;
    else process.env.IRR_PRODUCTION_ENABLED = previous;
  }
});

test("DB-backed server startup rejects premature IRR configuration before connecting", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    try {
      await import('./lib/db/index.ts');
      process.exitCode = 1;
    } catch (err) {
      if (err.name !== 'CurrencyRolloutError' || !err.message.includes('before financial qualification')) {
        process.exitCode = 2;
      }
    }
  `], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, IRR_PRODUCTION_ENABLED: "true", DATABASE_URL: "postgresql://fixture@127.0.0.1:1/unused" },
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("MCP currency selection surfaces rollout and authorization failures without DB writes", async () => {
  const previous = process.env.IRR_PRODUCTION_ENABLED;
  process.env.IRR_PRODUCTION_ENABLED = "false";
  try {
    const { registerOrganizationTools } = await import("../lib/mcp/tools/organization");
    const invoke = async (role: "owner" | "member", currencyCode: string) => {
      let handler: ((params: { currencyCode: string }) => Promise<{ isError?: boolean; content: { text: string }[] }>) | undefined;
      const server = { registerTool(name: string, _config: unknown, callback: typeof handler) {
        if (name === "set_organization_currency") handler = callback;
      } } as unknown as McpServer;
      registerOrganizationTools(server, { userId: "fixture-user", organizationId: "fixture-org", role });
      assert.ok(handler);
      return handler({ currencyCode });
    };
    const deniedIRR = await invoke("owner", " irr ");
    assert.equal(deniedIRR.isError, true);
    assert.deepEqual(JSON.parse(deniedIRR.content[0].text), {
      error: "IRR functional currency is disabled pending financial qualification", status: 403,
    });
    const deniedPermission = await invoke("member", "USD");
    assert.equal(deniedPermission.isError, true);
    assert.deepEqual(JSON.parse(deniedPermission.content[0].text), { error: "Insufficient permissions", status: 403 });
  } finally {
    if (previous === undefined) delete process.env.IRR_PRODUCTION_ENABLED;
    else process.env.IRR_PRODUCTION_ENABLED = previous;
  }
});
