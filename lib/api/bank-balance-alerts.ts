import { backgroundTranslator } from "@/i18n/background";
import { db } from "@/lib/db";
import { bankAccount, member, notification, organization } from "@/lib/db/schema";
import { eq, and, sql, inArray, isNull, gte, lt } from "drizzle-orm";
import { deliverNotificationEmail } from "@/lib/notifications/send";
import { money, toMajorDecimal } from "@/lib/money/exact";

export async function checkLowBankBalances(): Promise<{ checked: number; alerted: number }> {
  const start = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const end = new Date(start.getTime() + 86400000);

  // Query bank accounts where balance is below threshold
  const lowBalanceAccounts = await db
    .select({ id: bankAccount.id, organizationId: bankAccount.organizationId })
    .from(bankAccount)
    .innerJoin(organization, eq(organization.id, bankAccount.organizationId))
    .where(
      and(
        sql`${bankAccount.lowBalanceThreshold} IS NOT NULL`,
        eq(bankAccount.isActive, true),
        isNull(bankAccount.deletedAt),
        isNull(organization.deletedAt),
        sql`${bankAccount.balance} < ${bankAccount.lowBalanceThreshold}`
      )
    );

  const checked = lowBalanceAccounts.length;
  let alerted = 0;

  for (const candidate of lowBalanceAccounts) {
    try {
      const notices = await db.transaction(async tx => {
        const [org] = await tx.select({ id: organization.id }).from(organization)
          .where(and(eq(organization.id, candidate.organizationId), isNull(organization.deletedAt))).for("share");
        if (!org) return [];
        // Serialize cron overlap with threshold/balance edits and recheck the target.
        const [account] = await tx.select({ id: bankAccount.id, organizationId: bankAccount.organizationId, accountName: bankAccount.accountName,
          currencyCode: bankAccount.currencyCode, balance: sql<string>`${bankAccount.balance}::text`,
          lowBalanceThreshold: sql<string>`${bankAccount.lowBalanceThreshold}::text` }).from(bankAccount)
          .where(and(eq(bankAccount.id, candidate.id), eq(bankAccount.organizationId, candidate.organizationId), eq(bankAccount.isActive, true),
            isNull(bankAccount.deletedAt), sql`${bankAccount.lowBalanceThreshold} is not null`, sql`${bankAccount.balance} < ${bankAccount.lowBalanceThreshold}`)).for("update");
        if (!account) return [];
        // SQL text keeps full int64 digits; malformed currency skips this account only.
        const balance = toMajorDecimal(money(BigInt(account.balance), account.currencyCode));
        const threshold = toMajorDecimal(money(BigInt(account.lowBalanceThreshold), account.currencyCode));
        const body = backgroundTranslator()("bankBody", { currency: account.currencyCode, balance, threshold });
        const admins = await tx.query.member.findMany({ where: and(eq(member.organizationId, account.organizationId), inArray(member.role, ["owner", "admin"])) });
        const created = [];
        for (const userId of new Set(admins.map(admin => admin.userId))) {
          const prior = await tx.query.notification.findFirst({ where: and(eq(notification.organizationId, account.organizationId), eq(notification.userId, userId),
            eq(notification.type, "low_bank_balance"), eq(notification.entityType, "bank_account"), eq(notification.entityId, account.id),
            gte(notification.createdAt, start), lt(notification.createdAt, end)) });
          if (prior) continue;
          const params = { orgId: account.organizationId, userId, type: "low_bank_balance" as const, title: backgroundTranslator()("bankTitle", { name: account.accountName }),
            body, entityType: "bank_account", entityId: account.id };
          const [row] = await tx.insert(notification).values({ organizationId: account.organizationId, userId, type: params.type, title: params.title,
            body, entityType: params.entityType, entityId: account.id, channel: "in_app" }).returning({ id: notification.id });
          created.push({ params, row });
        }
        return created;
      });
      alerted += notices.length;
      for (const notice of notices) {
        try { await deliverNotificationEmail(notice.params, notice.row); } catch { /* Existing in-app notice remains committed. */ }
      }
    } catch { /* Non-critical: invalid account/failed insert stays retryable; others continue. */ }
  }

  return { checked, alerted };
}
