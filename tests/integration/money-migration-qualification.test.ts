import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type pg from "pg";
import { applyCurrent, historicalSchema, withDatabase } from "./fixtures";

// Independent SQL oracle: no report service, ORM monetary mapping or Number sums.
// Synthetic historical records qualify preservation, not production accounting policy.
const tenants = [
  ["qualification-usd", "USD", "1250"],
  ["qualification-irr", "IRR", "123456789"],
  ["qualification-jpy", "JPY", "1250"],
  ["qualification-kwd", "KWD", "1250"],
] as const;
const tables = ["organization", "chart_account", "journal_entry", "journal_line", "contact",
  "invoice", "bill", "bank_account", "payment", "payment_allocation", "period_lock"];
type Columns = Record<string, string[]>;
const quote = (value: string) => {
  assert.match(value, /^[a-z_][a-z_0-9]*$/);
  return `"${value}"`;
};

async function seed(pool: pg.Pool) {
  for (const [slug, currency, opening] of tenants) {
    const { rows: [org] } = await pool.query(`INSERT INTO organization (name, slug, default_currency)
      VALUES ('Migration qualification', $1, $2) RETURNING id`, [slug, currency]);
    const accounts: Record<string, string> = {};
    for (const [code, type] of [["1000", "asset"], ["1100", "asset"], ["2000", "liability"],
      ["3000", "equity"], ["3200", "equity"], ["4000", "revenue"], ["5000", "expense"]]) {
      const { rows: [account] } = await pool.query(`INSERT INTO chart_account
        (organization_id, code, name, type, currency_code) VALUES ($1, $2, $2, $3, $4) RETURNING id`,
      [org.id, code, type, currency]);
      accounts[code] = account.id;
    }
    let entryNumber = 0;
    const post = async (legs: [string, string, string][]) => {
      const { rows: [entry] } = await pool.query(`INSERT INTO journal_entry
        (organization_id, entry_number, date, description, status)
        VALUES ($1, $2, '2025-12-01', 'Synthetic qualification posting', 'posted') RETURNING id`,
      [org.id, ++entryNumber]);
      for (const [code, debit, credit] of legs) await pool.query(`INSERT INTO journal_line
        (journal_entry_id, account_id, debit_amount, credit_amount, currency_code, exchange_rate)
        VALUES ($1, $2, $3, $4, $5, 1000000)`, [entry.id, accounts[code], debit, credit, currency]);
      return entry.id;
    };
    await post([["1000", opening, "0"], ["3000", "0", opening]]);
    const invoiceEntry = await post([["1100", "22001", "0"], ["4000", "0", "22001"]]);
    const receiptEntry = await post([["1000", "1001", "0"], ["1100", "0", "1001"]]);
    const billEntry = await post([["5000", "7003", "0"], ["2000", "0", "7003"]]);
    const paymentEntry = await post([["2000", "2002", "0"], ["1000", "0", "2002"]]);
    await post([["4000", "22001", "0"], ["5000", "0", "7003"], ["3200", "0", "14998"]]);
    const { rows: [contact] } = await pool.query(`INSERT INTO contact (organization_id, name, type, currency_code)
      VALUES ($1, 'Synthetic counterparty', 'both', $2) RETURNING id`, [org.id, currency]);
    const { rows: [invoice] } = await pool.query(`INSERT INTO invoice
      (organization_id, contact_id, invoice_number, issue_date, due_date, status, subtotal, total,
        amount_paid, amount_due, currency_code, journal_entry_id)
      VALUES ($1, $2, 'Q-1', '2025-12-01', '2025-12-31', 'partial', 22001, 22001, 1001, 21000, $3, $4)
      RETURNING id`, [org.id, contact.id, currency, invoiceEntry]);
    const { rows: [bill] } = await pool.query(`INSERT INTO bill
      (organization_id, contact_id, bill_number, issue_date, due_date, status, subtotal, total,
        amount_paid, amount_due, currency_code, journal_entry_id)
      VALUES ($1, $2, 'Q-1', '2025-12-01', '2025-12-31', 'partial', 7003, 7003, 2002, 5001, $3, $4)
      RETURNING id`, [org.id, contact.id, currency, billEntry]);
    const { rows: [bank] } = await pool.query(`INSERT INTO bank_account
      (organization_id, account_name, currency_code, chart_account_id, balance)
      VALUES ($1, 'Synthetic bank', $2, $3, $4) RETURNING id`,
    [org.id, currency, accounts["1000"], (BigInt(opening) - 1001n).toString()]);
    for (const [type, amount, entry, documentType, document] of [
      ["received", "1001", receiptEntry, "invoice", invoice.id],
      ["made", "2002", paymentEntry, "bill", bill.id],
    ]) {
      const { rows: [payment] } = await pool.query(`INSERT INTO payment
        (organization_id, contact_id, payment_number, type, date, amount, bank_account_id, currency_code, journal_entry_id)
        VALUES ($1, $2, $3, $4, '2025-12-01', $5, $6, $7, $8) RETURNING id`,
      [org.id, contact.id, `Q-${type}`, type, amount, bank.id, currency, entry]);
      await pool.query(`INSERT INTO payment_allocation (payment_id, document_type, document_id, amount)
        VALUES ($1, $2, $3, $4)`, [payment.id, documentType, document, amount]);
    }
    await pool.query(`INSERT INTO period_lock (organization_id, lock_date, reason)
      VALUES ($1, '2025-12-31', 'Synthetic historical lock')`, [org.id]);
  }
}

async function historicalColumns(pool: pg.Pool): Promise<Columns> {
  const columns: Columns = {};
  for (const table of tables) columns[table] = (await pool.query(`SELECT column_name
    FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
  [table])).rows.map(row => row.column_name);
  return columns;
}

async function capture(pool: pg.Pool, columns: Columns) {
  const rows: Record<string, unknown> = {};
  for (const table of tables) {
    // Freeze the original column projection so additive snapshots/regime metadata
    // cannot mask history changes. Text casts preserve bigint digits before JSON.
    const data = (await pool.query(`SELECT jsonb_build_array(${columns[table].map(column =>
      `${quote(column)}::text`).join(",")})::text AS value FROM ${quote(table)} ORDER BY value`)).rows;
    const nulls = (await pool.query(`SELECT ${columns[table].map(column =>
      `count(*) FILTER (WHERE ${quote(column)} IS NULL)::text AS ${quote(column)}`).join(",")}
      FROM ${quote(table)}`)).rows[0];
    rows[table] = { count: String(data.length), nulls,
      sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex") };
  }
  const trial = (await pool.query(`SELECT o.slug, a.code, l.currency_code AS currency,
      sum(l.debit_amount)::text AS debit, sum(l.credit_amount)::text AS credit,
      sum(l.debit_amount-l.credit_amount)::text AS balance
    FROM journal_line l JOIN journal_entry e ON e.id=l.journal_entry_id
    JOIN chart_account a ON a.id=l.account_id JOIN organization o ON o.id=e.organization_id
    WHERE e.status='posted' GROUP BY o.slug, a.code, l.currency_code ORDER BY o.slug, a.code, l.currency_code`)).rows;
  const reconciliations = [];
  for (const [slug, currency] of tenants) {
    const { rows: [totals] } = await pool.query(`SELECT
      (SELECT sum(l.debit_amount)::text FROM journal_line l JOIN journal_entry e ON e.id=l.journal_entry_id
        WHERE e.organization_id=o.id AND e.status='posted' AND l.currency_code=$2) AS debit,
      (SELECT sum(l.credit_amount)::text FROM journal_line l JOIN journal_entry e ON e.id=l.journal_entry_id
        WHERE e.organization_id=o.id AND e.status='posted' AND l.currency_code=$2) AS credit,
      (SELECT sum(amount_due)::text FROM invoice WHERE organization_id=o.id AND currency_code=$2 AND deleted_at IS NULL AND status NOT IN ('draft','void')) AS ar,
      (SELECT sum(amount_due)::text FROM bill WHERE organization_id=o.id AND currency_code=$2 AND deleted_at IS NULL AND status NOT IN ('draft','void')) AS ap,
      (SELECT sum(balance)::text FROM bank_account WHERE organization_id=o.id AND currency_code=$2 AND deleted_at IS NULL) AS bank,
      (SELECT sum(l.credit_amount-l.debit_amount)::text FROM journal_line l
        JOIN journal_entry e ON e.id=l.journal_entry_id JOIN chart_account a ON a.id=l.account_id
        WHERE e.organization_id=o.id AND e.status='posted' AND l.currency_code=$2 AND a.code='3200') AS retained
      FROM organization o WHERE slug=$1`, [slug, currency]);
    reconciliations.push({ slug, currency, ...totals });
  }
  const violations = (await pool.query(`SELECT count(*)::text AS count FROM journal_line l
    JOIN journal_entry e ON e.id=l.journal_entry_id JOIN chart_account a ON a.id=l.account_id
    WHERE e.organization_id<>a.organization_id OR l.currency_code<>a.currency_code`)).rows[0];
  return { rows, trial, reconciliations, violations };
}

type Snapshot = Awaited<ReturnType<typeof capture>>;
function assertReconciled(snapshot: Snapshot) {
  assert.deepEqual(snapshot.violations, { count: "0" });
  for (const [slug, currency, opening] of tenants) {
    const total = snapshot.reconciliations.find(row => row.slug === slug)!;
    assert.deepEqual(total, { slug, currency, debit: (BigInt(opening) + 54008n).toString(),
      credit: (BigInt(opening) + 54008n).toString(), ar: "21000", ap: "5001",
      bank: (BigInt(opening) - 1001n).toString(), retained: "14998" });
    for (const [code, expected] of [["1100", total.ar], ["2000", `-${total.ap}`],
      ["1000", total.bank], ["3200", `-${total.retained}`]]) {
      assert.equal(snapshot.trial.find(row => row.slug === slug && row.currency === currency && row.code === code)?.balance, expected);
    }
  }
}

function assertPreserved(before: Snapshot, after: Snapshot) {
  assert.deepEqual(after.reconciliations, before.reconciliations, "Per-tenant/currency financial balances changed");
  assert.deepEqual(after.trial, before.trial, "Account-level trial balance changed");
  assert.deepEqual(after.violations, before.violations, "Tenant/currency integrity changed");
  assert.deepEqual(after.rows, before.rows, "Historical counts, nulls or row checksums changed");
  assertReconciled(after);
}

test("MON-010 reconciles historical trial balance, AR/AP, bank and retained earnings across widening and replay", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0004_faithful_paper_doll");
    await seed(pool);
    const columns = await historicalColumns(pool);
    const before = await capture(pool, columns);
    assertReconciled(before);
    applyCurrent(url);
    assertPreserved(before, await capture(pool, columns));
    applyCurrent(url);
    assertPreserved(before, await capture(pool, columns));
  });
});

test("MON-010 successful schema migration cannot hide balanced financial drift, tenant swaps or changed history", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0004_faithful_paper_doll");
    await seed(pool);
    const columns = await historicalColumns(pool);
    const before = await capture(pool, columns);
    applyCurrent(url);
    assert.equal((await pool.query(`SELECT udt_name FROM information_schema.columns
      WHERE table_name='journal_line' AND column_name='debit_amount'`)).rows[0].udt_name, "int8");
    const mutations = [
      // Every journal remains balanced; a debit=credit-only gate would miss this.
      "UPDATE journal_line SET debit_amount=debit_amount*2, credit_amount=credit_amount*2",
      "UPDATE invoice SET amount_due=amount_due+1",
      "UPDATE bill SET amount_due=amount_due+1",
      "UPDATE bank_account SET balance=balance+1",
      "UPDATE journal_line l SET credit_amount=credit_amount+1 FROM chart_account a WHERE a.id=l.account_id AND a.code='3200'",
      // Identical USD/JPY low-digit values cannot make a currency/tenant swap safe.
      "UPDATE invoice SET currency_code=CASE currency_code WHEN 'USD' THEN 'JPY' WHEN 'JPY' THEN 'USD' ELSE currency_code END",
      // No balance change: the row/null/checksum gate must still detect it.
      "UPDATE invoice SET notes='changed historical narrative'",
      "DELETE FROM period_lock",
      "UPDATE journal_line l SET account_id=(SELECT id FROM chart_account WHERE code='1000' AND organization_id<>e.organization_id LIMIT 1) FROM journal_entry e, chart_account a WHERE e.id=l.journal_entry_id AND a.id=l.account_id AND a.code='1000'",
    ];
    for (const mutation of mutations) {
      await pool.query("BEGIN");
      try {
        await pool.query(mutation);
        const current = await capture(pool, columns);
        assert.throws(() => assertPreserved(before, current), /changed/, mutation);
      } finally {
        await pool.query("ROLLBACK");
      }
    }
    assertPreserved(before, await capture(pool, columns));
  });
});
