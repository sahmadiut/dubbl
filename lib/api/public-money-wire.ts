import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";

/** Add aliases only to explicitly identified money fields; quantities and percentages retain their units. */
export function publicMoneyDto<T extends object, K extends keyof T & string>(value: T, fields: readonly K[]) {
  const aliases = {} as Record<`${K}Minor`, string>;
  for (const field of fields) {
    const amount = value[field];
    if (typeof amount !== "number" || !Number.isSafeInteger(amount)) throw new WireCompatibilityError();
    aliases[`${field}Minor`] = BigInt(amount).toString();
  }
  return { ...value, ...aliases };
}

export function publicLineDto<T extends { unitPrice: number; amount: number; taxAmount: number }>(line: T) {
  return publicMoneyDto(line, ["unitPrice", "amount", "taxAmount"]);
}

/** A statement has one explicit currency; never sum unlike currency units. */
export function publicStatementDto<T extends {
  issueDate: string; invoiceNumber: string; total: number; amountPaid: number;
  amountDue: number; status: string; currencyCode: string;
}>(invoices: T[], currencyCode: string) {
  let balance = 0n;
  const lines = invoices.map(inv => {
    if (inv.currencyCode !== currencyCode) {
      throw new WireCompatibilityError("A portal statement cannot combine different currencies");
    }
    const amounts = publicMoneyDto({ amount: inv.total, paid: inv.amountPaid, balance: inv.amountDue }, ["amount", "paid", "balance"]);
    balance += BigInt(amounts.balanceMinor);
    return {
      date: inv.issueDate, description: `Invoice ${inv.invoiceNumber}`, ...amounts,
      runningBalance: legacyMinor(balance), runningBalanceMinor: balance.toString(),
      status: inv.status, currencyCode,
    };
  });
  return { lines, currencyCode, totalOutstanding: legacyMinor(balance), totalOutstandingMinor: balance.toString() };
}
