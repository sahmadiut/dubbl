import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assetLoanUiPayload, assetLoanJson } from "../lib/money/asset-loan-ui";
import { assetCentsInput, assetCentsDecimal, assetMoneyDisplay, assetPercent } from "../lib/money/asset-display";

test("asset/loan UI preserves fixed cents, low digits and safe-max input", () => {
  for (const currency of ["USD", "JPY", "KWD", "IRR"]) for (const amount of [0, 29, 1250, Number.MAX_SAFE_INTEGER]) {
    const row = assetLoanUiPayload({ purchasePrice: amount, purchasePriceMinor: String(amount), currency });
    assert.equal(assetCentsInput(assetCentsDecimal(row.purchasePrice)), String(amount));
  }
  assert.equal(assetMoneyDisplay(9007199254740991n + 29n), "$90,071,992,547,410.20");
  assert.equal(assetMoneyDisplay(-1n), "-$0.01");
  assert.equal(assetPercent(9007199254740990n, 9007199254740991n), 99.99);
  assert.equal(assetPercent(-1n, 29n), 0);
  assert.equal(assetPercent(30n, 29n), 100);
  for (const input of ["1.001", "1e2", "-0", "-1", "90071992547409.92"]) assert.throws(() => assetCentsInput(input));
});

test("asset/loan UI rejects missing, conflicting, malformed, unsafe and signed-invalid saved aliases", () => {
  for (const row of [
    { purchasePrice: 29 }, { purchasePriceMinor: "29" }, { purchasePrice: 29, purchasePriceMinor: "28" },
    { purchasePrice: 29, purchasePriceMinor: "029" }, { purchasePrice: 0.29, purchasePriceMinor: "29" },
    { purchasePrice: -0, purchasePriceMinor: "0" }, { purchasePrice: -1, purchasePriceMinor: "-1" },
    { purchasePrice: Number.MAX_SAFE_INTEGER + 1, purchasePriceMinor: "9007199254740992" },
    { residualValue: null, residualValueMinor: null }, { disposalAmount: null, disposalAmountMinor: "0" },
    { remainingBalance: -1, remainingBalanceMinor: "-1" }, { amount: 29 },
    { costs: [], total: 29 }, { totalMinor: "29" },
    { purchaseDate: "2024-01-01", assetNumber: "Missing" },
    { startDate: "2024-01-01", termMonths: 12 }, { periodNumber: 1 },
    { defaultDepreciationMethod: "straight_line" },
  ]) assert.throws(() => assetLoanUiPayload({ asset: row }));
  assert.doesNotThrow(() => assetLoanUiPayload({ asset: { disposalAmount: null, disposalAmountMinor: null,
    revaluedAmount: null, revaluedAmountMinor: null, revaluations: [{ changeAmount: -29, changeAmountMinor: "-29" }] },
    depreciationEntries: [{ amount: 29, amountMinor: "29" }], pagination: { total: 42 }, interestRate: 3333, usefulLifeMonths: 60 }));
});

test("asset/loan UI checks mutation totals, histories and schedules before adoption", async () => {
  const payload = { asset: { netBookValue: 29, netBookValueMinor: "29" },
    costs: [{ amount: 29, amountMinor: "29" }], total: 29, totalMinor: "29",
    schedule: [{ totalPayment: 29, totalPaymentMinor: "29", remainingBalance: 0, remainingBalanceMinor: "0" }] };
  assert.deepEqual(await assetLoanJson(Response.json(payload)), payload);
  await assert.rejects(assetLoanJson(Response.json({ schedule: [{ totalPayment: 29 }] })));
  assert.deepEqual(await assetLoanJson(Response.json({ error: "Period locked" }, { status: 409 })), { error: "Period locked" });
});

test("every scoped page and create drawer validates saved JSON and uses exact inputs", () => {
  function inspect(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) { inspect(path); continue; }
      const source = readFileSync(path, "utf8");
      if (path.replaceAll("\\", "/").endsWith("asset-categories/page.tsx")) {
        assert.match(source, /assetCategoryJson/, path);
        assert.match(readFileSync("i18n/asset-category-presentation.ts", "utf8"), /return assetLoanJson\(response\)/);
      } else if (path.replaceAll("\\", "/").includes("fixed-assets/")) {
        assert.match(source, /fixedAssetJson/, path);
        assert.match(readFileSync("i18n/fixed-asset-presentation.ts", "utf8"), /await assetLoanJson\(response\)/);
      } else {
        assert.match(source, /loanJson/, path);
        assert.match(readFileSync("i18n/loan-presentation.ts", "utf8"), /await assetLoanJson\(response\)/);
      }
      assert.doesNotMatch(source, /\.json\(\)|from "@\/lib\/money"|parseFloat\(|parseMajor\(|accumulatedDepreciation\s*\//, path);
      assert.match(source, /role="alert"/, path);
    }
  }
  for (const folder of ["fixed-assets", "asset-categories", "loans"]) inspect("app/(dashboard)/accounting/" + folder);
  const drawer = readFileSync("components/dashboard/create-drawer.tsx", "utf8");
  assert.match(drawer, /fixedAssetJson\(res, t, t\("createFailed"\), "asset"\);\s+toast.success\(t\("created"\)\)/);
  assert.match(drawer, /loanJson\(res, t, t\("createFailed"\), "loan"\);\s+toast.success\(t\("created"\)\)/);
  assert.match(drawer, /principalAmountMinor: assetCentsInput\(principalAmount\)/);
});
