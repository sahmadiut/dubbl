import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { bankReadCount } from "@/lib/api/bank-transaction-read-wire";

interface AccountSuggestion {
  accountId: string;
  accountName: string;
  accountCode: string;
  confidence: number;
  matchCount: number;
  recentDate: string;
}

/**
 * Suggest chart accounts for a bank transaction based on historically
 * categorized transactions with similar descriptions.
 */
export async function suggestAccounts(
  bankAccountId: string,
  description: string,
  limit = 5,
  connection: Pick<typeof db, "execute"> = db
): Promise<AccountSuggestion[]> {
  const normalized = normalizeForMatching(description);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  if (words.length === 0) return [];

  // Find transactions with similar descriptions that have been categorized
  const wordConditions = words
    .slice(0, 5)
    .map((w) => sql`lower(bt.description) LIKE ${"%" + w + "%"}`);

  const results = await connection.execute(sql`
    SELECT
      ca.id AS account_id,
      ca.name AS account_name,
      ca.code AS account_code,
      COUNT(*) AS match_count,
      MAX(bt.date) AS recent_date
    FROM bank_transaction bt
    JOIN chart_account ca ON ca.id = bt.account_id
    JOIN bank_account ba ON ba.id = bt.bank_account_id
    WHERE bt.bank_account_id = ${bankAccountId}
      AND ba.deleted_at IS NULL
      AND ca.organization_id = ba.organization_id
      AND ca.deleted_at IS NULL AND ca.is_active = true
      AND coalesce(bt.currency_code, ba.currency_code) = ba.currency_code
      AND bt.account_id IS NOT NULL
      AND bt.status != 'excluded'
      AND (${sql.join(wordConditions, sql` OR `)})
    GROUP BY ca.id, ca.name, ca.code
    ORDER BY match_count DESC, ca.id
    LIMIT ${limit}
  `);

  const totalMatches = results.rows.reduce((sum, r) => sum + BigInt(r.match_count as string), 0n);
  bankReadCount(totalMatches.toString());

  return results.rows.map((r) => ({
    accountId: r.account_id as string,
    accountName: r.account_name as string,
    accountCode: r.account_code as string,
    confidence: Math.min(
      100,
      Number((BigInt(r.match_count as string) * 100n * 2n + totalMatches) / ((totalMatches || 1n) * 2n))
    ),
    matchCount: bankReadCount(r.match_count as string),
    recentDate: r.recent_date as string,
  }));
}

function normalizeForMatching(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
