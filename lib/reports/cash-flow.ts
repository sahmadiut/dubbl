/**
 * Cash-flow statement computation (authoritative).
 *
 * This is the single shared place that builds a cash-flow statement so the REST
 * route and any other caller produce identical figures. It is layered on top of
 * the shared exact GL aggregation in gl-query.ts and scoped source-type sums.
 * All queries inherit the caller-owned snapshot, organization and posted-only
 * filters; balances retain the natural-sign conventions.
 *
 * Two methods are supported:
 *
 *  - INDIRECT (default): start from net income for the period, add back non-cash
 *    expenses (depreciation, identified via `journalEntry.sourceType =
 *    'depreciation'`), then adjust for working-capital movements (AR / AP /
 *    inventory deltas). Investing = fixed-asset deltas; financing = loan
 *    movements (`sourceType = 'loan_payment'`) + equity deltas.
 *
 *  - DIRECT: the existing cash-source/bank-account income heuristic, with
 *    depreciation removed from expenses paid and the indirect investing and
 *    financing classification. It is not per-payment cash tracing.
 *
 * Cross-check: regardless of method, the computed net change in cash is
 * reconciled against the movement on the cash/bank accounts themselves
 * (closing - opening). The difference is surfaced as `reconciliation` so callers
 * can flag a statement that does not tie out.
 *
 * All amounts are integer minor units (cents).
 */
import { db } from "@/lib/db";
import { chartAccount, journalEntry, journalLine } from "@/lib/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  aggregateAsAtExact,
  aggregateByDateRangeExact,
  type ExactAccountAggregate,
  type DateRange,
  type ReportBasis,
  type GLQueryOptions,
} from "./gl-query";

/** Cash-flow presentation method. */
export type CashFlowMethod = "indirect" | "direct";

/**
 * chartAccount.subType values treated as cash/bank for cash-flow purposes.
 * (The gl-query cash *basis* only treats `bank` as cash; cash-flow additionally
 * recognises an explicit `cash` subType for the on-hand cash account.)
 */
const CASH_SUBTYPES = ["cash", "bank"] as const;
const AR_SUBTYPES = ["accounts_receivable"] as const;
const AP_SUBTYPES = ["accounts_payable", "current_liability"] as const;
const INVENTORY_SUBTYPES = ["inventory"] as const;
const FIXED_ASSET_SUBTYPES = ["fixed_asset", "property_plant_equipment"] as const;

function inSubTypes(
  agg: Pick<ExactAccountAggregate, "subType">,
  subTypes: readonly string[]
): boolean {
  return agg.subType != null && subTypes.includes(agg.subType);
}

export function cashBalanceExact(accounts: ExactAccountAggregate[]) {
  return accounts.filter(account => account.type === "asset" && inSubTypes(account, CASH_SUBTYPES))
    .reduce((total, account) => total + account.balance, 0n);
}

/** Return the calendar day immediately before an ISO YYYY-MM-DD date. */
function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface CashFlowLineItem {
  accountId?: string;
  code?: string;
  name: string;
  /** Cash effect in integer cents (positive = inflow, negative = outflow). */
  amount: bigint;
}

export interface OperatingActivities {
  netIncome: bigint;
  /** Non-cash depreciation added back (positive). */
  depreciation: bigint;
  workingCapitalChanges: {
    /** Cash effect of AR movement (increase in AR = outflow = negative). */
    accountsReceivable: bigint;
    /** Cash effect of AP movement (increase in AP = inflow = positive). */
    accountsPayable: bigint;
    /** Cash effect of inventory movement (increase = outflow = negative). */
    inventory: bigint;
  };
  /** Net cash from operating activities. */
  total: bigint;
}

export interface InvestingActivities {
  items: CashFlowLineItem[];
  total: bigint;
}

export interface FinancingActivities {
  /** Cash effect of loan movements (sourceType=loan_payment); outflow negative. */
  loanPayments: bigint;
  /** Cash effect of equity movements (issuance positive, drawings negative). */
  equityChanges: bigint;
  items: CashFlowLineItem[];
  total: bigint;
}

/** Reconciliation of the indirect/direct net change vs. actual cash movement. */
export interface CashReconciliation {
  /** Net change derived from the activity sections. */
  computedNetChange: bigint;
  /** Actual movement on cash/bank accounts (closing - opening). */
  cashAccountMovement: bigint;
  /** computedNetChange - cashAccountMovement; 0 means the statement ties out. */
  difference: bigint;
  /** Convenience flag: true when |difference| === 0. */
  balanced: boolean;
}

export interface CashFlowStatement {
  startDate: string;
  endDate: string;
  method: CashFlowMethod;
  basis: ReportBasis;
  openingCashBalance: bigint;
  operatingActivities: OperatingActivities;
  investingActivities: InvestingActivities;
  financingActivities: FinancingActivities;
  netCashChange: bigint;
  closingCashBalance: bigint;
  reconciliation: CashReconciliation;
}

export interface CashFlowOptions {
  /** 'indirect' (default) or 'direct'. */
  method?: CashFlowMethod;
  /** Reporting basis passed through to gl-query. Defaults to 'accrual'. */
  basis?: ReportBasis;
  /** Caller-owned read snapshot, shared by every aggregation. */
  database?: GLQueryOptions["database"];
}

/**
 * Sum the period debit on entries whose `sourceType` matches, restricted to the
 * org/posted/date window. Used for depreciation add-back and loan movements,
 * which are identified by entry sourceType rather than by account subType.
 */
async function sumBySourceType(
  organizationId: string,
  range: DateRange,
  sourceType: string,
  column: "debit" | "credit" | "creditMinusDebit",
  database: GLQueryOptions["database"]
): Promise<bigint> {
  const expr =
    column === "debit"
      ? sql<string>`coalesce(sum(${journalLine.debitAmount}), 0)::text`
      : column === "credit"
        ? sql<string>`coalesce(sum(${journalLine.creditAmount}), 0)::text`
        : sql<string>`coalesce(sum(${journalLine.creditAmount}) - sum(${journalLine.debitAmount}), 0)::text`;

  const [row] = await (database ?? db)
    .select({ total: expr })
    .from(journalLine)
    .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
    .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id))
    .where(
      and(
        eq(journalEntry.organizationId, organizationId),
        eq(chartAccount.organizationId, organizationId),
        eq(journalEntry.status, "posted"),
        isNull(journalEntry.deletedAt),
        eq(journalEntry.sourceType, sourceType),
        gte(journalEntry.date, range.startDate),
        lte(journalEntry.date, range.endDate)
      )
    );
  return BigInt(row?.total ?? "0");
}

/** Cumulative cash/bank balance as at a date (natural debit-positive). */
async function cashBalanceAsAt(
  organizationId: string,
  asAt: string,
  basis: ReportBasis,
  database: GLQueryOptions["database"]
): Promise<bigint> {
  const assets = await aggregateAsAtExact(organizationId, asAt, {
    basis, database,
    accountTypes: ["asset"],
  });
  return cashBalanceExact(assets);
}

/**
 * Build a cash-flow statement for the period using the shared GL aggregation.
 */
export async function buildCashFlowExact(
  organizationId: string,
  range: DateRange,
  opts: CashFlowOptions = {}
): Promise<CashFlowStatement> {
  const method: CashFlowMethod = opts.method ?? "indirect";
  const basis: ReportBasis = opts.basis ?? "accrual";

  // One aggregation of the period's activity across all account types; we slice
  // it by type/subType below instead of issuing several queries.
  const periodAccounts = await aggregateByDateRangeExact(organizationId, range, {
    basis, database: opts.database,
  });

  // Opening / closing cash from the cash/bank accounts (cumulative balances).
  const openingCash = range.startDate === "0001-01-01" ? 0n : await cashBalanceAsAt(
    organizationId,
    dayBefore(range.startDate),
    basis, opts.database
  );
  const closingCash = await cashBalanceAsAt(organizationId, range.endDate, basis, opts.database);
  const cashAccountMovement = closingCash - openingCash;

  let operatingActivities: OperatingActivities;
  let investingActivities: InvestingActivities;
  let financingActivities: FinancingActivities;

  if (method === "direct") {
    ({ operatingActivities, investingActivities, financingActivities } =
      await buildDirect(organizationId, range, periodAccounts, opts.database));
  } else {
    ({ operatingActivities, investingActivities, financingActivities } =
      await buildIndirect(organizationId, range, periodAccounts, opts.database));
  }

  const netCashChange =
    operatingActivities.total +
    investingActivities.total +
    financingActivities.total;

  const reconciliation: CashReconciliation = {
    computedNetChange: netCashChange,
    cashAccountMovement,
    difference: netCashChange - cashAccountMovement,
    balanced: netCashChange - cashAccountMovement === 0n,
  };

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    method,
    basis,
    openingCashBalance: openingCash,
    operatingActivities,
    investingActivities,
    financingActivities,
    netCashChange,
    // Anchor closing on actual opening + computed change so the statement reads
    // consistently; the reconciliation line exposes any drift vs. the ledger.
    closingCashBalance: openingCash + netCashChange,
    reconciliation,
  };
}

/** Indirect method: net income + depreciation add-back - working capital. */
async function buildIndirect(
  organizationId: string,
  range: DateRange,
  periodAccounts: ExactAccountAggregate[],
  database: GLQueryOptions["database"]
): Promise<{
  operatingActivities: OperatingActivities;
  investingActivities: InvestingActivities;
  financingActivities: FinancingActivities;
}> {
  // Net income = revenue balance - expense balance (both natural-signed).
  const totalRevenue = periodAccounts
    .filter((a) => a.type === "revenue")
    .reduce((s, a) => s + a.balance, 0n);
  const totalExpenses = periodAccounts
    .filter((a) => a.type === "expense")
    .reduce((s, a) => s + a.balance, 0n);
  const netIncome = totalRevenue - totalExpenses;

  // Depreciation add-back: debit posted on depreciation-sourced entries.
  const depreciation = await sumBySourceType(
    organizationId,
    range,
    "depreciation",
    "debit", database
  );

  // Working-capital deltas (natural-signed period movement).
  const arDelta = periodAccounts
    .filter((a) => a.type === "asset" && inSubTypes(a, AR_SUBTYPES))
    .reduce((s, a) => s + a.balance, 0n);
  const apDelta = periodAccounts
    .filter((a) => a.type === "liability" && inSubTypes(a, AP_SUBTYPES))
    .reduce((s, a) => s + a.balance, 0n);
  const inventoryDelta = periodAccounts
    .filter((a) => a.type === "asset" && inSubTypes(a, INVENTORY_SUBTYPES))
    .reduce((s, a) => s + a.balance, 0n);

  const operatingActivities: OperatingActivities = {
    netIncome,
    depreciation,
    workingCapitalChanges: {
      accountsReceivable: -arDelta, // AR up = cash tied up = outflow
      accountsPayable: apDelta, // AP up = cash retained = inflow
      inventory: -inventoryDelta, // inventory up = outflow
    },
    total: netIncome + depreciation - arDelta + apDelta - inventoryDelta,
  };

  // Investing: fixed-asset deltas (asset increase = cash outflow).
  const fixedAssets = periodAccounts.filter(
    (a) => a.type === "asset" && inSubTypes(a, FIXED_ASSET_SUBTYPES)
  );
  const investingActivities: InvestingActivities = {
    items: fixedAssets.map((a) => ({
      accountId: a.accountId,
      code: a.code,
      name: a.name,
      amount: -a.balance,
    })),
    total: -fixedAssets.reduce((s, a) => s + a.balance, 0n),
  };

  // Financing: loan movements (sourceType) + equity deltas.
  const loanPayments = await sumBySourceType(
    organizationId,
    range,
    "loan_payment",
    "creditMinusDebit", database
  );
  const equityAccounts = periodAccounts.filter((a) => a.type === "equity");
  const equityChanges = equityAccounts.reduce((s, a) => s + a.balance, 0n);

  const financingActivities: FinancingActivities = {
    loanPayments,
    equityChanges,
    items: [
      ...(loanPayments !== 0n
        ? [{ name: "Loan movements", amount: loanPayments }]
        : []),
      ...equityAccounts.map((a) => ({
        accountId: a.accountId,
        code: a.code,
        name: a.name,
        amount: a.balance,
      })),
    ],
    total: loanPayments + equityChanges,
  };

  return { operatingActivities, investingActivities, financingActivities };
}

/**
 * Direct method variant.
 *
 * Operating cash is presented from the income side (revenue collected less
 * expenses paid, adjusted for non-cash depreciation), while investing and
 * financing reuse the same classification as the indirect method. This keeps a
 * direct-style operating section while still tying out via the reconciliation
 * line. The split is intentionally pragmatic - a true line-by-line direct
 * statement would require per-payment cash tracing, which the indirect method
 * already approximates with working-capital deltas.
 */
async function buildDirect(
  organizationId: string,
  range: DateRange,
  periodAccounts: ExactAccountAggregate[],
  database: GLQueryOptions["database"]
): Promise<{
  operatingActivities: OperatingActivities;
  investingActivities: InvestingActivities;
  financingActivities: FinancingActivities;
}> {
  // Cash actually realised from revenue/expense on a cash basis: re-aggregate
  // the income statement on the cash basis so only cash-moving entries count.
  const cashAccounts = await aggregateByDateRangeExact(organizationId, range, {
    basis: "cash", database,
    accountTypes: ["revenue", "expense"],
  });
  const cashRevenue = cashAccounts
    .filter((a) => a.type === "revenue")
    .reduce((s, a) => s + a.balance, 0n);
  const cashExpenses = cashAccounts
    .filter((a) => a.type === "expense")
    .reduce((s, a) => s + a.balance, 0n);

  // Depreciation is non-cash; exclude it from the cash expenses paid.
  const depreciation = await sumBySourceType(
    organizationId,
    range,
    "depreciation",
    "debit", database
  );
  const cashExpensesPaid = cashExpenses - depreciation;

  const operatingActivities: OperatingActivities = {
    // Reuse the same field shape; for the direct method netIncome carries the
    // cash collected from customers and depreciation stays 0 (already excluded).
    netIncome: cashRevenue,
    depreciation: 0n,
    workingCapitalChanges: {
      accountsReceivable: 0n,
      accountsPayable: 0n,
      inventory: 0n,
    },
    total: cashRevenue - cashExpensesPaid,
  };

  // Investing / financing: identical classification to the indirect method.
  const indirect = await buildIndirect(organizationId, range, periodAccounts, database);

  return {
    operatingActivities,
    investingActivities: indirect.investingActivities,
    financingActivities: indirect.financingActivities,
  };
}
