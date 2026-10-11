import { currencyMetadata, parseMajor, roundRatio } from "./exact";
import { invoiceUiMinor as compatibilityMinor, invoiceUiRow as compatibilityRow, invoiceUiAmount, invoiceUiDecimal, invoiceUiPercent } from "./invoice-ui";
export { bankMoneyDisplay as bankUiMoney } from "./bank-display";
export const bankUiDecimal = invoiceUiDecimal;
export const bankUiPercent = invoiceUiPercent;
export function bankUiAmount(text: string, code: string) {
  try { return invoiceUiAmount(text, code); }
  catch { throw new RangeError(`Enter a positive amount with valid decimal places for ${code} and within the supported range`); }
}
export const bankUiAbs = (value: bigint) => value < 0n ? -value : value;
export const bankUiMin = (a: bigint, b: bigint) => a < b ? a : b;
type Row = Record<string, unknown>;
function invoiceUiMinor(row: Row, field: string) {
  if (Object.is(row[field], -0)) throw new RangeError("Negative zero is not canonical saved money");
  return compatibilityMinor(row, field);
}
function invoiceUiRow<T extends Row, K extends keyof T & string>(row: T, fields: readonly K[]) {
  fields.forEach(field => invoiceUiMinor(row, field));
  return compatibilityRow(row, fields);
}

export function bankUiNullable(row: Row, field: string) {
  if (row[field] == null) {
    if (row[`${field}Minor`] != null) throw new RangeError(`Conflicting ${field} aliases`);
    return null;
  }
  return invoiceUiMinor(row, field);
}
function currency(row: Row, expected?: string) {
  if (typeof row.currencyCode !== "string") throw new RangeError("Bank currency is missing");
  if (currencyMetadata(row.currencyCode).code !== row.currencyCode) throw new RangeError("Noncanonical bank currency");
  if (expected && row.currencyCode !== expected) throw new RangeError("Bank currencies disagree");
  return row.currencyCode;
}
export function bankUiAccount(row: Row) {
  currency(row);
  return { ...invoiceUiRow(row, ["balance"]), lowBalanceThreshold: bankUiNullable(row, "lowBalanceThreshold") };
}
export function bankUiTransaction(row: Row, expected?: string) {
  currency(row, expected);
  return { ...invoiceUiRow(row, ["amount"]), balance: bankUiNullable(row, "balance") };
}
export function bankUiDocument(row: Row, expected: string) {
  currency(row, expected);
  return invoiceUiRow(row, ["total", "amountDue"]);
}
export function bankUiCandidate(row: Row, expected: string) {
  const candidate = row.candidate as Row;
  currency(candidate, expected);
  return { ...row, candidate: invoiceUiRow(candidate, ["amount"]) };
}
/** Rules apply to every bank: fixed amounts/conditions deliberately use raw bank minor units. */
export function bankUiRule<T extends Row>(row: T): T {
  const check = (text: unknown) => {
    if (typeof text !== "string" || !/^(0|-?[1-9]\d*)$/.test(text) || bankUiAbs(BigInt(text)) > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Invalid rule minor units");
  };
  const conditions = row.conditions as Row[] | null | undefined;
  if (conditions?.length) {
    for (const condition of conditions) if (condition.field === "amount") {
      const values = typeof condition.value === "string" ? condition.value.split(",") : [];
      if (values.length !== (condition.op === "between" ? 2 : 1)) throw new RangeError("Invalid amount condition");
      values.forEach(check);
    }
  } else if (row.matchField === "amount") check(row.matchValue);
  for (const split of (row.splitAllocations as Row[] | null | undefined) ?? []) {
    if (split.amount !== undefined || split.amountMinor !== undefined) {
      if (invoiceUiMinor(split, "amount") < 0n) throw new RangeError("Fixed rule amounts must be nonnegative");
    }
  }
  return row;
}
export function bankUiReconciliation(row: Row) { return invoiceUiRow(row, ["startBalance", "endBalance"]); }
export function bankUiReport(row: Row) {
  const code = currency(row);
  if (typeof row.glCurrencyCode !== "string") throw new RangeError("Books currency is missing");
  if (currencyMetadata(row.glCurrencyCode).code !== row.glCurrencyCode) throw new RangeError("Noncanonical books currency");
  const statementEndBalance = invoiceUiMinor(row, "statementEndBalance");
  const glBalance = bankUiNullable(row, "glBalance"), difference = bankUiNullable(row, "difference");
  if (code !== row.glCurrencyCode && (difference !== null || row.isBalanced !== false)) throw new RangeError("Different bank and books currencies cannot be compared");
  if (difference !== null && (glBalance === null || statementEndBalance - glBalance !== difference || row.isBalanced !== (difference === 0n))) throw new RangeError("Reconciliation totals disagree");
  const group = (value: unknown) => {
    const g = value as Row;
    const saved = invoiceUiRow(g, ["total"]), transactions = (g.transactions as Row[]).map(t => bankUiTransaction(t, code));
    if (transactions.reduce((sum, row) => sum + row.amount, 0n) !== saved.total) throw new RangeError("Statement group total disagrees");
    return { ...saved, transactions };
  };
  return { ...row, statementEndBalance, glBalance, difference,
    reconciliation: row.reconciliation ? bankUiReconciliation(row.reconciliation as Row) : null,
    reconciled: group(row.reconciled), unreconciled: group(row.unreconciled) };
}
export function bankUiPreview(row: Row, expected: string) {
  currencyMetadata(expected);
  if (row.currencyCode != null && row.currencyCode !== expected) throw new RangeError("Statement currency disagrees with bank");
  return { ...row, openingBalance: bankUiNullable(row, "openingBalance"), closingBalance: bankUiNullable(row, "closingBalance"),
    transactions: (row.transactions as Row[]).map(t => ({ ...invoiceUiRow(t, ["amount"]), balance: bankUiNullable(t, "balance") })),
    duplicates: (row.duplicates as Row[]).map(t => invoiceUiRow(t, ["amount"])) };
}
/** Signed balances reject fractional minor units; numeric compatibility stays bounded. */
export function bankUiBalance(text: string, code: string) {
  if (text.length > 40 || !/^-?\d+(?:\.\d+)?$/.test(text)) throw new RangeError("Enter a valid decimal balance");
  const amount = parseMajor(text, code, "reject").amountMinor;
  if (bankUiAbs(amount) > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Balance exceeds the supported range");
  return amount.toString();
}
export function bankUiMatchAmount(text: string, code: string, transaction: { amount: bigint }, document: { currencyCode: string; amountDue: bigint }) {
  if (!document) throw new RangeError("Select an outstanding document");
  if (document.currencyCode !== code) throw new RangeError("Document currency must match the bank");
  const result = bankUiAmount(text, code), amount = BigInt(result.amountMinor);
  if (amount !== bankUiAbs(transaction.amount)) throw new RangeError("Payment must cover the full statement amount");
  if (amount > document.amountDue) throw new RangeError("Amount exceeds the document balance");
  return result;
}
export function bankUiTransfer(text: string, from?: { id: string; currencyCode: string }, to?: { id: string; currencyCode: string }) {
  if (!from || !to || from.id === to.id || from.currencyCode !== to.currencyCode) throw new RangeError("Select distinct bank accounts in the same currency");
  return bankUiAmount(text, from.currencyCode);
}
export function bankUiSplit(rows: readonly { accountId: string; amount: string; taxRateId: string; memo: string }[], code: string, total: bigint) {
  const selected = rows.filter(row => row.accountId || row.amount);
  if (!selected.length || selected.length > 1000) throw new RangeError("Add at least one category and amount");
  const allocations = selected.map(row => {
    if (!row.accountId) throw new RangeError("Select a category for every amount");
    return { accountId: row.accountId, ...bankUiAmount(row.amount, code), taxRateId: row.taxRateId === "none" ? null : row.taxRateId, memo: row.memo.trim() || null };
  });
  if (allocations.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n) !== bankUiAbs(total)) throw new RangeError("The parts must add up to the transaction amount");
  return allocations;
}
export function bankUiGroups(rows: readonly { balance: bigint; currencyCode: string }[], direction?: "positive" | "negative") {
  const groups = new Map<string, bigint>();
  for (const row of rows) {
    currencyMetadata(row.currencyCode);
    const value = direction === "positive" ? (row.balance > 0n ? row.balance : 0n) : direction === "negative" ? (row.balance < 0n ? -row.balance : 0n) : row.balance;
    groups.set(row.currencyCode, (groups.get(row.currencyCode) ?? 0n) + value);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}
export function bankUiTax(gross: bigint, t: { rate: number; kind?: string; recoverablePercent?: number | null }, isCredit: boolean) {
  const kind = t.kind || "standard";
  if (t.rate <= 0 || kind === "exempt" || kind === "no_vat" || kind === "reverse_charge") return null;
  const bp = t.recoverablePercent ?? 10000;
  if (!Number.isSafeInteger(t.rate) || !Number.isSafeInteger(bp) || bp < 0 || bp > 10000) throw new RangeError("Invalid tax rate");
  const tax = roundRatio(gross * BigInt(t.rate), 10000n + BigInt(t.rate), "half-away-from-zero"), net = gross - tax;
  if (isCredit) return { net, tax, recoverable: tax, absorbed: 0n };
  if (kind === "sales_tax_us") return { net: gross, tax, recoverable: 0n, absorbed: tax };
  const recoverable = roundRatio(tax * BigInt(bp), 10000n, "half-away-from-zero");
  return { net, tax, recoverable, absorbed: tax - recoverable };
}
