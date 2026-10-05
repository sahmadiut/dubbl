import { roundRatio } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { payrollInteger, payrollNumber, payrollSum } from "@/lib/payroll/exact";
const max = (a: bigint, b: bigint) => a > b ? a : b;
const min = (a: bigint, b: bigint) => a < b ? a : b;
function nonnegative(value: number) { const n = payrollInteger(value); if (n < 0n) throw new WireCompatibilityError("Payroll tax inputs must be nonnegative"); return n; }
function basisPoints(value: number) { const n = nonnegative(value); if (n > 10000n) throw new WireCompatibilityError("Payroll basis points must be 0..10000"); return n; }
const tax = (wage: bigint, rate: number) => payrollNumber(roundRatio(wage * basisPoints(rate), 10000n, "half-away-from-zero"));

/**
 * Pure payroll-tax math — no DB access, so it is fully unit-testable.
 *
 * All monetary amounts are integer cents. Rates are basis points
 * (10000 bp = 100%). Every result is rounded to whole cents with explicit half-away-from-zero rounding
 * and guarded against divide-by-zero / negative inputs.
 *
 * The progressive engine implements the IRS Pub 15-T "Percentage Method":
 *   1. Annualize the period wage (periodWage × payPeriodsPerYear).
 *   2. Subtract the standard deduction and the value of withholding allowances
 *      to get the annual taxable wage.
 *   3. Walk the MARGINAL brackets to get the tentative annual tax:
 *        tax = baseAmountCents + (annualWage − bracketFloor) × rate
 *      where baseAmountCents is the cumulative tax on all lower brackets
 *      (Pub 15-T column C). When baseAmountCents is not supplied it is derived
 *      by summing the lower brackets.
 *   4. Divide by payPeriodsPerYear to get the per-period withholding and add
 *      any flat additional withholding the employee elected.
 */

/** One marginal tax bracket. Mirrors the persisted taxBracket row shape. */
export interface MarginalBracket {
  /** Annual bracket floor in cents (inclusive). */
  minIncome: number;
  /** Annual bracket ceiling in cents (exclusive). null = no upper limit. */
  maxIncome?: number | null;
  /** Marginal rate in basis points (e.g. 2200 = 22%). */
  rate: number;
  /**
   * Cumulative tax on all income below minIncome, in cents (Pub 15-T col C).
   * When null/undefined the engine derives it from the lower brackets so a
   * schedule that only lists floor + rate still computes correctly.
   */
  baseAmountCents?: number | null;
}

export interface ComputePeriodWithholdingInput {
  /**
   * Annualized taxable wage in cents BEFORE the standard deduction and
   * allowances are removed (typically periodWage × payPeriodsPerYear).
   */
  annualTaxableWage: number;
  /** Marginal brackets for the employee's jurisdiction / filing status / year. */
  brackets: MarginalBracket[];
  /** Filing status — accepted for symmetry/logging; bracket selection is the caller's job. */
  filingStatus?: string | null;
  /** Number of pay periods in a year (e.g. 12 monthly, 26 biweekly, 52 weekly). */
  payPeriodsPerYear: number;
  /** Number of withholding allowances claimed. */
  allowances?: number;
  /** Annual value of one allowance, in cents. */
  allowanceValueCents?: number;
  /** Annual standard deduction, in cents. */
  standardDeductionCents?: number;
  /** Flat extra amount the employee elected to withhold each period, in cents. */
  additionalWithholding?: number;
}

export interface PeriodWithholdingResult {
  /** Withholding for THIS pay period, in cents (includes additionalWithholding). */
  periodWithholding: number;
  /** Tentative tax for the whole year, in cents (before dividing by periods). */
  annualTax: number;
  /** Annual wage after standard deduction + allowances, in cents (never negative). */
  taxableAfterDeductions: number;
}

/** Annual intermediates stay bigint even when annualization exceeds the safe wire range. */
export function computeExactPeriodWithholding(input: Omit<ComputePeriodWithholdingInput, "annualTaxableWage"> & { annualTaxableWage: bigint }) {
  const periods = nonnegative(input.payPeriodsPerYear);
  if (periods === 0n) throw new WireCompatibilityError("Pay periods must be positive");
  const reduction = nonnegative(input.standardDeductionCents ?? 0) + nonnegative(input.allowances ?? 0) * nonnegative(input.allowanceValueCents ?? 0);
  const taxableAfterDeductions = max(0n, input.annualTaxableWage - reduction);
  const additional = nonnegative(input.additionalWithholding ?? 0);
  const sorted = [...input.brackets].sort((a, b) => a.minIncome < b.minIncome ? -1 : a.minIncome > b.minIncome ? 1 : 0);
  let derived = 0n, annualTax = 0n;
  for (let i = 0; i < sorted.length; i++) {
    const bracket = sorted[i], floor = nonnegative(bracket.minIncome), rate = basisPoints(bracket.rate);
    const ceiling = bracket.maxIncome == null ? null : nonnegative(bracket.maxIncome);
    if (ceiling !== null && ceiling <= floor) throw new WireCompatibilityError("Payroll bracket ceiling must exceed floor");
    if (i > 0) {
      const previous = sorted[i - 1], previousFloor = nonnegative(previous.minIncome);
      if (floor <= previousFloor || (previous.maxIncome != null && nonnegative(previous.maxIncome) !== floor))
        throw new WireCompatibilityError("Payroll bracket schedule has duplicate, overlapping or missing bands");
      derived += roundRatio((floor - previousFloor) * basisPoints(previous.rate), 10000n, "half-away-from-zero");
    }
    const base = bracket.baseAmountCents == null ? derived : nonnegative(bracket.baseAmountCents);
    if (taxableAfterDeductions >= floor) {
      if (i === sorted.length - 1 && ceiling !== null && taxableAfterDeductions >= ceiling)
        throw new WireCompatibilityError("Payroll wage exceeds configured bracket schedule");
      annualTax = base + roundRatio((taxableAfterDeductions - floor) * rate, 10000n, "half-away-from-zero");
    }
  }
  return { periodWithholding: payrollNumber(roundRatio(annualTax, periods, "half-away-from-zero") + additional), annualTax, taxableAfterDeductions };
}
export function computePeriodWithholding(input: ComputePeriodWithholdingInput): PeriodWithholdingResult {
  const result = computeExactPeriodWithholding({ ...input, annualTaxableWage: nonnegative(input.annualTaxableWage) });
  return { ...result, annualTax: payrollNumber(result.annualTax), taxableAfterDeductions: payrollNumber(result.taxableAfterDeductions) };
}

export interface ComputeFicaInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  /** Year-to-date wage BEFORE this period, in cents. */
  ytdWage: number;
  /** Annual Social Security wage base cap, in cents. */
  ssWageBaseCents: number;
  /** Social Security rate in basis points (e.g. 620 = 6.2%). */
  ssRateBp: number;
  /** Medicare rate in basis points (e.g. 145 = 1.45%). */
  medicareRateBp: number;
  /** YTD wage threshold over which Additional Medicare applies, in cents. */
  addlMedicareThresholdCents: number;
  /** Additional Medicare rate in basis points (e.g. 90 = 0.9%). */
  addlMedicareRateBp: number;
}

export interface FicaResult {
  /** Employee Social Security withheld this period, in cents (capped at wage base). */
  socialSecurity: number;
  /** Employee Medicare withheld this period, in cents (uncapped). */
  medicare: number;
  /** Additional Medicare (0.9%) on YTD wages over the threshold, in cents. */
  additionalMedicare: number;
  /** Sum of all three, in cents. */
  total: number;
}

/**
 * Compute the employee-side FICA withholding for one pay period.
 *   • Social Security: ssRateBp on wages up to the annual wage base. Once YTD
 *     wages reach the base, no further SS is withheld; a period that straddles
 *     the base is taxed only on the portion below it.
 *   • Medicare: medicareRateBp on the full period wage (no cap).
 *   • Additional Medicare: addlMedicareRateBp on the portion of YTD wages above
 *     the threshold that falls in THIS period.
 */
export function computeFica(input: ComputeFicaInput): FicaResult {
  const wage = nonnegative(input.periodWage), ytd = nonnegative(input.ytdWage);
  const capped = min(wage, max(0n, nonnegative(input.ssWageBaseCents) - ytd));
  const socialSecurity = tax(capped, input.ssRateBp), medicare = tax(wage, input.medicareRateBp);
  const additionalMedicare = tax(max(0n, ytd + wage - max(ytd, nonnegative(input.addlMedicareThresholdCents))), input.addlMedicareRateBp);
  return { socialSecurity, medicare, additionalMedicare, total: payrollSum([socialSecurity, medicare, additionalMedicare]) };
}

export interface ComputeEmployerTaxesInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  /** Year-to-date wage BEFORE this period, in cents. */
  ytdWage: number;
  /** When true, employer matches employee Social Security + Medicare. */
  employerFicaEnabled: boolean;
  /** Annual Social Security wage base cap, in cents. */
  ssWageBaseCents: number;
  /** Employer Social Security rate in basis points (typically 620 = 6.2%). */
  ssRateBp: number;
  /** Employer Medicare rate in basis points (typically 145 = 1.45%, no employer Additional Medicare). */
  medicareRateBp: number;
  /** FUTA rate in basis points (e.g. 60 = 0.6%). */
  futaRateBp: number;
  /** Annual FUTA wage base cap, in cents (e.g. 700000 = $7,000). */
  futaWageBaseCents: number;
  /** SUTA rate in basis points. */
  sutaRateBp: number;
  /** Annual SUTA wage base cap, in cents. */
  sutaWageBaseCents: number;
}

export interface EmployerTaxResult {
  /** Employer Social Security match this period, in cents (capped at wage base). */
  socialSecurity: number;
  /** Employer Medicare match this period, in cents (uncapped, no additional medicare). */
  medicare: number;
  /** FUTA this period, in cents (capped at FUTA wage base). */
  futa: number;
  /** SUTA this period, in cents (capped at SUTA wage base). */
  suta: number;
  /** Sum of all employer taxes, in cents. */
  total: number;
}

/**
 * Compute the EMPLOYER-side payroll taxes for one pay period. These are an
 * expense to the company on top of gross wages (they do NOT reduce employee net
 * pay):
 *   • Employer FICA (when enabled): matches employee SS (capped at the wage
 *     base) and Medicare (uncapped). There is no employer Additional Medicare.
 *   • FUTA / SUTA: unemployment taxes on the slice of this period's wage still
 *     below the respective annual wage base.
 * Every component taxes only the portion of the period wage that remains below
 * its cap given YTD wages, mirroring computeFica's straddle handling.
 */
export function computeEmployerTaxes(input: ComputeEmployerTaxesInput): EmployerTaxResult {
  const wage = nonnegative(input.periodWage), ytd = nonnegative(input.ytdWage);
  const capped = (base: number, rate: number) => tax(min(wage, max(0n, nonnegative(base) - ytd)), rate);
  const socialSecurity = input.employerFicaEnabled ? capped(input.ssWageBaseCents, input.ssRateBp) : 0;
  const medicare = input.employerFicaEnabled ? tax(wage, input.medicareRateBp) : 0;
  const futa = capped(input.futaWageBaseCents, input.futaRateBp), suta = capped(input.sutaWageBaseCents, input.sutaRateBp);
  return { socialSecurity, medicare, futa, suta, total: payrollSum([socialSecurity, medicare, futa, suta]) };
}

/** Map a payFrequency enum value to the number of pay periods per year. */
export function payPeriodsPerYear(payFrequency: string): number {
  switch (payFrequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "monthly":
    default:
      return 12;
  }
}
