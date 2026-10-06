import { roundRatio } from "@/lib/money/exact";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";

/** Bounded rational PMT; all money is integer cents, rate is annual basis points. */
function parameters(principal: number, rate: number, term: number) {
  if (!Number.isSafeInteger(principal) || principal <= 0 || !Number.isInteger(rate) || rate < 0 || rate > 100000 ||
    !Number.isInteger(term) || term < 1 || term > 1200) throw new WireCompatibilityError("Unsupported loan principal, rate or term");
}
export function calculatePMT(principal: number, rate: number, term: number): number {
  parameters(principal, rate, term);
  const p = BigInt(principal), r = BigInt(rate), d = 120000n;
  const a = (d + r) ** BigInt(term), b = d ** BigInt(term);
  const payment = legacyMinor(rate === 0 ? roundRatio(p, BigInt(term), "half-away-from-zero")
    : roundRatio(p * r * a, d * (a - b), "half-away-from-zero"));
  if (payment <= 0) throw new WireCompatibilityError("Rounded monthly payment must be positive");
  return payment;
}
export interface ScheduleEntry {
  periodNumber: number; date: string; principalAmount: number; interestAmount: number; totalPayment: number; remainingBalance: number;
}
/** Preserve legacy month overflow (Jan 31 + one month can be March), using UTC. */
export function loanPaymentDate(startDate: string, period: number) {
  const start = new Date(startDate + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < "0001-01-01" || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== startDate)
    throw new WireCompatibilityError("Use a valid Gregorian loan start date");
  start.setUTCMonth(start.getUTCMonth() + period);
  const date = start.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new WireCompatibilityError("Loan payment date exceeds supported Gregorian range");
  return date;
}
export function generateAmortizationSchedule(principal: number, rate: number, term: number, startDate: string): ScheduleEntry[] {
  const payment = BigInt(calculatePMT(principal, rate, term)), result: ScheduleEntry[] = [];
  let balance = BigInt(principal), total = 0n;
  for (let i = 1; i <= term; i++) {
    const interest = roundRatio(balance * BigInt(rate), 120000n, "half-away-from-zero");
    const capital = i === term ? balance : payment - interest;
    if (capital < 0n || capital > balance || (i < term && capital === balance))
      throw new WireCompatibilityError("Rounded schedule cannot amortize over the requested term");
    const amount = capital + interest;
    if (amount <= 0n) throw new WireCompatibilityError("Scheduled payment must be positive");
    balance -= capital; total += amount;
    legacyMinor(total);
    result.push({ periodNumber: i, date: loanPaymentDate(startDate, i), principalAmount: legacyMinor(capital),
      interestAmount: legacyMinor(interest), totalPayment: legacyMinor(amount), remainingBalance: legacyMinor(balance) });
  }
  return result;
}
