import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { getCurrencyMinorUnits, getIsoCurrencies } from "../lib/currency/iso4217";
import { currencyMetadata, money, toMajorDecimal } from "../lib/money/exact";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import { IRR_METADATA } from "../lib/currency/irr-metadata";

test("explicit IRR metadata agrees with the frozen ledger scale and exact display", () => {
  assert.deepEqual(getIsoCurrencies().find(row => row.code === "IRR"), IRR_METADATA);
  assert.equal(getCurrencyMinorUnits("irr"), 0);
  assert.equal(currencyMetadata("IRR").minorUnits, 0);
  assert.equal(toMajorDecimal(money(4000000003n, "IRR")), "4000000003");
  assert.match(bankMoneyDisplay(4000000003n, "IRR"), /4,000,000,003/);
  assert.doesNotMatch(bankMoneyDisplay(4000000003n, "IRR"), /\.00/);
});

for (const mode of ["missing", "throws", "partial"]) test(`IRR survives ${mode} ICU currency enumeration and absent DisplayNames`, () => {
  const code = `
    import assert from 'node:assert/strict';
    Object.defineProperty(Intl, 'supportedValuesOf', { value: ${mode === "partial" ? "() => ['USD']" : mode === "throws" ? "() => { throw new Error('minimal ICU'); }" : "undefined"} });
    Object.defineProperty(Intl, 'DisplayNames', { value: undefined });
    const Original = Intl.NumberFormat;
    Intl.NumberFormat = function(locale, options) {
      const formatter = new Original(locale, options);
      if (options?.currency === 'IRR' && options.minimumFractionDigits === undefined)
        formatter.resolvedOptions = () => ({ maximumFractionDigits: 2 });
      return formatter;
    };
    const { getIsoCurrencies, getCurrencyMinorUnits, isValidCurrencyCode } = await import('./lib/currency/iso4217.ts');
    const { formatMoney } = await import('./lib/money.ts');
    const { bankMoneyDisplay } = await import('./lib/money/bank-display.ts');
    assert.equal(getIsoCurrencies().filter(row => row.code === 'IRR').length, 1);
    assert.equal(getIsoCurrencies().find(row => row.code === 'IRR').decimalPlaces, 0);
    assert.equal(getCurrencyMinorUnits('IRR'), 0);
    assert.ok(isValidCurrencyCode('irr'));
    assert.ok(!isValidCurrencyCode('IRT'));
    assert.match(formatMoney(1250, 'IRR'), /1,250/);
    assert.doesNotMatch(formatMoney(1250, 'IRR'), /\.00/);
    assert.match(bankMoneyDisplay(4000000003n, 'IRR'), /4,000,000,003/);
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", code], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
