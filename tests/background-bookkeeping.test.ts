import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("background bookkeeping guards shared exact posting and actual Trigger delegates", () => {
  const maintenance = readFileSync("lib/api/bookkeeping-maintenance.ts", "utf8");
  assert.doesNotMatch(maintenance, /Math\.(?:round|floor|ceil)|parseFloat\(|from ["']@\/lib\/money["']|\.insert\(journal(?:Entry|Line)\)/);
  for (const operation of ["depreciateAssetForMaintenance", "postLoanPayment", "recognizeRevenueEntry"]) {
    assert.match(maintenance, new RegExp(`await ${operation}\\(`));
  }
  const reverse = readFileSync("lib/api/auto-reverse.ts", "utf8");
  assert.doesNotMatch(reverse, /getExchangeRate|convertAmount|parseFloat\(|Math\.round|from ["']@\/lib\/money["']/);
  for (const field of ["rateExact", "rateDirection", "rateFormatVersion", "rateMigrationStatus", "rateProvenance", "costCenterId", "projectId"]) {
    assert.match(reverse, new RegExp(`${field}: line\\.${field}`));
  }
  const scheduled = readFileSync("trigger/scheduled.ts", "utf8"), auto = readFileSync("trigger/auto-reverse.ts", "utf8");
  assert.match(scheduled, /run: async \(\) => processBookkeepingMaintenance\(\)/);
  assert.match(auto, /run: async \(\) => processAutoReversals\(\)/);
});
