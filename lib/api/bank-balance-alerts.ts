import { db } from "@/lib/db";
import { bankAccount, member, notification } from "@/lib/db/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { sendNotification } from "@/lib/notifications/send";
import { money, toMajorDecimal } from "@/lib/money/exact";

export async function checkLowBankBalances(): Promise<{ checked: number; alerted: number }> {
  const today = new Date().toISOString().slice(0, 10);

  // Query bank accounts where balance is below threshold
  const lowBalanceAccounts = await db
    .select({ id: bankAccount.id, organizationId: bankAccount.organizationId, accountName: bankAccount.accountName,
      currencyCode: bankAccount.currencyCode, balance: sql<string>`${bankAccount.balance}::text`,
      lowBalanceThreshold: sql<string>`${bankAccount.lowBalanceThreshold}::text` })
    .from(bankAccount)
    .where(
      and(
        sql`${bankAccount.lowBalanceThreshold} IS NOT NULL`,
        eq(bankAccount.isActive, true),
        isNull(bankAccount.deletedAt),
        sql`${bankAccount.balance} < ${bankAccount.lowBalanceThreshold}`
      )
    );

  const checked = lowBalanceAccounts.length;
  let alerted = 0;

  for (const account of lowBalanceAccounts) {
    // Text projections preserve int64 values; format with the saved currency scale.
    // A malformed historical currency must not prevent other accounts' alerts.
    let body: string;
    try {
      const balance = toMajorDecimal(money(BigInt(account.balance), account.currencyCode));
      const threshold = toMajorDecimal(money(BigInt(account.lowBalanceThreshold), account.currencyCode));
      body = `Balance ${account.currencyCode} ${balance} is below threshold ${account.currencyCode} ${threshold}`;
    } catch { continue; }
    // Deduplicate: only alert once per day per account
    const existingAlert = await db.query.notification.findFirst({
      where: and(
        eq(notification.organizationId, account.organizationId),
        eq(notification.type, "low_bank_balance"),
        eq(notification.entityType, "bank_account"),
        eq(notification.entityId, account.id),
        sql`${notification.createdAt}::date = ${today}::date`
      ),
    });

    if (existingAlert) continue;

    // Get org admins/owners
    const admins = await db.query.member.findMany({
      where: and(
        eq(member.organizationId, account.organizationId),
        inArray(member.role, ["owner", "admin"])
      ),
    });

    for (const admin of admins) {
      try {
        await sendNotification({
          orgId: account.organizationId,
          userId: admin.userId,
          type: "low_bank_balance",
          title: `Low balance alert: ${account.accountName}`,
          body,
          entityType: "bank_account",
          entityId: account.id,
        });
        alerted++;
      } catch {
        // Non-critical
      }
    }
  }

  return { checked, alerted };
}
