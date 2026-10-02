import assert from "node:assert/strict";
import { ESLint } from "eslint";
import nextTs from "eslint-config-next/typescript";
import { legacyMoneyRule } from "../../scripts/eslint-legacy-money.mjs";
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [...nextTs, {
  files: ["**/*.ts"],
  plugins: { money: { rules: { legacy: legacyMoneyRule({ "tests/grandfathered.ts": { calculateTax: 2 } }) } } },
  rules: { "money/legacy": "error" },
}] });
async function errors(source, file = "tests/new-consumer.ts") {
  const [result] = await eslint.lintText(source, { filePath: file });
  assert.equal(result.fatalErrorCount, 0);
  return result.messages.filter(m => m.ruleId === "money/legacy").length;
}
assert.equal(await errors('import { calculateTax as tax } from "../lib/money"; tax(100, 10);', "tests/grandfathered.ts"), 0);
assert.equal(await errors('import { calculateTax as tax } from "../lib/money"; tax(100, 10); tax(200, 10);', "tests/grandfathered.ts"), 1);
assert.equal(await errors('import { calculateTax } from "@/lib/money";'), 1);
assert.equal(await errors('import * as old from "@/lib/money"; old.calculateTax(100, 10);'), 1);
assert.equal(await errors('export { calculateTax } from "../lib/money";'), 1);
assert.equal(await errors('export * from "../lib/money";'), 1);
assert.equal(await errors('import("@/lib/money");'), 1);
assert.equal(await errors('require("../lib/money");'), 1);
assert.equal(await errors('import { money } from "../lib/money/exact"; money(BigInt(1), "USD");'), 0);
console.log("Legacy money lint gate: 9 regression checks passed");
