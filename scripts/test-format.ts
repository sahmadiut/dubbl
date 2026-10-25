import { currencyPartsText } from "../i18n/currency-labels";
import { formatExactMoney, formatExactMoneyAfterAmount } from "../i18n/numbers";

const p = { locale: "fa-IR", numerals: "arabext" as const };
for (let v = 0; v <= 4; v++) {
  const parts = new Intl.NumberFormat(p.locale, {
    numberingSystem: p.numerals,
    style: "currency",
    currency: "IRR",
    notation: "compact",
  }).formatToParts(v);
  console.log(`v=${v}:`, JSON.stringify(currencyPartsText(parts, "IRR", p.locale)));
}

console.log("formatExactMoney(0n):", JSON.stringify(formatExactMoney(0n, "IRR", p)));
console.log("formatExactMoneyAfterAmount(0n):", JSON.stringify(formatExactMoneyAfterAmount(0n, "IRR", p)));
