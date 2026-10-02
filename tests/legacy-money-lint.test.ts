import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("lint rejects new deprecated money consumers while preserving existing allowances", () => {
  execFileSync(process.execPath, [".agentic/scripts/verify_legacy_money.mjs"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "pipe",
  });
});
