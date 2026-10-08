import type Stripe from "stripe";
import { db } from "@/lib/db";
import {
  stripeIntegration,
  stripeEntityMap,
  journalEntry,
  journalLine,
  contact,
  bankAccount,
  bankTransaction,
  payment,
  paymentAllocation,
  invoice,
  chartAccount,
  creditNote,
  creditNoteLine,
  organization,
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { stripe as _stripeClient } from "@/lib/stripe";
import { getNextNumber } from "@/lib/api/numbering";

// Non-null wrapper - callers (webhook handlers) already guard for null stripe
const stripe = _stripeClient!;
import { sendNotification } from "@/lib/notifications/send";
import { stripeMinor, validateStripeObject, stripeMappingMetadata } from "./money";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { assertNotLocked } from "@/lib/api/period-lock";
import { ensureIntegrationAccountsMapped } from "./accounts";
import { money, toMajorDecimal } from "@/lib/money/exact";

async function balanceTransaction(value: string | Stripe.BalanceTransaction, integration: Integration) {
  return typeof value === "string" ? stripe.balanceTransactions.retrieve(value, { stripeAccount: integration.stripeAccountId }) : value;
}

function validateBalance(value: Stripe.BalanceTransaction, currency: string) {
  validateStripeObject(value);
  if (value.currency.toUpperCase() !== currency.toUpperCase()) throw new WireCompatibilityError("Stripe fee currency requires an explicit FX contract");
}

type StripeDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type Integration = typeof stripeIntegration.$inferSelect;

async function runStripeOperation<T>(integration: Integration, object: unknown, handler: (exec: StripeDb) => Promise<T>) {
  validateStripeObject(object);
  stringifyWire(object);
  return db.transaction(async exec => {
    // Serialize duplicate events/number allocation for an organization across all entry points.
    await exec.execute(sql`select pg_advisory_xact_lock(hashtextextended(${integration.organizationId}, 31))`);
    const current = await exec.query.stripeIntegration.findFirst({ where: and(
      eq(stripeIntegration.id, integration.id), eq(stripeIntegration.organizationId, integration.organizationId),
      eq(stripeIntegration.stripeAccountId, integration.stripeAccountId), notDeleted(stripeIntegration.deletedAt),
    ) });
    if (!current) throw new WireCompatibilityError("Stripe integration is no longer active in this organization");
    const org = await exec.query.organization.findFirst({ where: eq(organization.id, integration.organizationId) });
    const raw = object as Record<string, unknown>;
    if (raw.currency && String(raw.currency).toUpperCase() !== org?.defaultCurrency) {
      throw new WireCompatibilityError("Stripe posting requires the organization's functional currency; no implicit FX");
    }
    // Copy freshly scoped mappings, rather than trusting a stale caller-supplied row.
    Object.assign(integration, current);
    const ids = [raw.id, raw.customer, raw.charge, raw.invoice,
      ...(raw.refunds as { data?: { id?: string }[] } | undefined)?.data?.map(r => r.id) ?? []]
      .filter((id): id is string => typeof id === "string");
    const mappings = ids.length ? await exec.query.stripeEntityMap.findMany({ where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId), inArray(stripeEntityMap.stripeEntityId, ids),
    ) }) : [];
    for (const map of mappings) {
      stripeMappingMetadata(map.metadata);
      stringifyWire(map.metadata);
      if (map.dubblEntityType === "contact") {
        // Historical metadata-only fallback maps point to the integration, not a contact.
        if (map.dubblEntityId !== integration.id && !await exec.query.contact.findFirst({ where: and(
          eq(contact.id, map.dubblEntityId), eq(contact.organizationId, integration.organizationId),
        ) })) throw new WireCompatibilityError("Stripe contact mapping is outside this organization");
      }
      let entryId = map.dubblEntityType === "journal_entry" ? map.dubblEntityId : null;
      if (map.dubblEntityType === "credit_note") {
        const cn = await exec.query.creditNote.findFirst({ where: and(eq(creditNote.id, map.dubblEntityId),
          eq(creditNote.organizationId, integration.organizationId)) });
        if (!cn) throw new WireCompatibilityError("Stripe credit note mapping is outside this organization");
        entryId = cn.journalEntryId;
      }
      if (entryId) {
        const entry = await exec.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, entryId),
          eq(journalEntry.organizationId, integration.organizationId)) });
        if (!entry) throw new WireCompatibilityError("Stripe journal mapping is outside this organization");
        await assertNotLocked(integration.organizationId, entry.date, undefined, exec);
      }
    }
    for (const id of [integration.clearingAccountId, integration.revenueAccountId, integration.feesAccountId]) {
      if (id && !await exec.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, id),
        eq(chartAccount.organizationId, integration.organizationId), notDeleted(chartAccount.deletedAt)) })) {
        throw new WireCompatibilityError("Stripe chart account is outside this organization");
      }
    }
    if (integration.payoutBankAccountId) {
      const bank = await exec.query.bankAccount.findFirst({ where: and(and(eq(bankAccount.id, integration.payoutBankAccountId), eq(bankAccount.organizationId, integration.organizationId)),
        eq(bankAccount.organizationId, integration.organizationId), notDeleted(bankAccount.deletedAt)) });
      if (!bank || (raw.object === "payout" && raw.currency && bank.currencyCode !== String(raw.currency).toUpperCase())) {
        throw new WireCompatibilityError("Stripe payout bank has incompatible organization or currency");
      }
      if (bank.chartAccountId && !await exec.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, bank.chartAccountId),
        eq(chartAccount.organizationId, integration.organizationId), notDeleted(chartAccount.deletedAt)) })) {
        throw new WireCompatibilityError("Stripe bank chart account is outside this organization");
      }
    }
    // Provider timestamps remain UTC seconds; invalid timestamps/locked dates fail before mapping writes.
    const timestamps = [raw.created, raw.arrival_date, ...(raw.refunds as { data?: { created?: number }[] } | undefined)?.data?.map(r => r.created) ?? []];
    for (const timestamp of timestamps) if (timestamp != null) {
      if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || !Number.isFinite(new Date(timestamp * 1000).getTime())) {
        throw new WireCompatibilityError("Invalid Stripe UTC timestamp");
      }
      await assertNotLocked(integration.organizationId, new Date(timestamp * 1000).toISOString().slice(0, 10), undefined, exec);
    }
    await assertNotLocked(integration.organizationId, new Date().toISOString().slice(0, 10), undefined, exec);
    await ensureIntegrationAccountsMapped(integration, exec);
    return handler(exec);
  });
}

async function getNextEntryNumber(organizationId: string, exec: StripeDb = db) {
  const [maxResult] = await exec
    .select({ max: sql<number>`coalesce(max(${journalEntry.entryNumber}), 0)` })
    .from(journalEntry)
    .where(eq(journalEntry.organizationId, organizationId));
  return (maxResult?.max || 0) + 1;
}

async function isDuplicate(
  organizationId: string,
  stripeEntityType: string,
  stripeEntityId: string,
  exec: StripeDb = db
) {
  const existing = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, organizationId),
      eq(stripeEntityMap.stripeEntityType, stripeEntityType),
      eq(stripeEntityMap.stripeEntityId, stripeEntityId)
    ),
  });
  return !!existing;
}

async function insertEntityMap(
  organizationId: string,
  stripeEntityType: string,
  stripeEntityId: string,
  dubblEntityType: string,
  dubblEntityId: string,
  metadata?: Record<string, unknown>, exec: StripeDb = db
) {
  await exec.insert(stripeEntityMap).values({
    organizationId,
    stripeEntityType,
    stripeEntityId,
    dubblEntityType,
    dubblEntityId,
    metadata: stripeMappingMetadata(metadata ?? null),
  });
}

async function resolveContact(
  integration: Integration,
  customerId: string | null,
  email: string | null,
  name: string | null,
  exec: StripeDb = db
): Promise<string | null> {
  if (!customerId && !email) return null;

  // Check entity map for existing customer mapping
  if (customerId) {
    const mapped = await exec.query.stripeEntityMap.findFirst({
      where: and(
        eq(stripeEntityMap.organizationId, integration.organizationId),
        eq(stripeEntityMap.stripeEntityType, "customer"),
        eq(stripeEntityMap.stripeEntityId, customerId)
      ),
    });
    if (mapped) return mapped.dubblEntityId;
  }

  // Try to match by email
  if (email) {
    const existing = await exec.query.contact.findFirst({
      where: and(
        eq(contact.organizationId, integration.organizationId),
        eq(contact.email, email),
        notDeleted(contact.deletedAt)
      ),
    });
    if (existing) {
      // Create entity map for future lookups
      if (customerId) {
        await insertEntityMap(
          integration.organizationId,
          "customer",
          customerId,
          "contact",
          existing.id,
          undefined, exec,
        );
      }
      return existing.id;
    }
  }

  // Create new contact
  const [newContact] = await exec
    .insert(contact)
    .values({
      organizationId: integration.organizationId,
      name: name || email || "Stripe Customer",
      email,
      type: "customer",
    })
    .returning();

  if (customerId) {
    await insertEntityMap(
      integration.organizationId,
      "customer",
      customerId,
      "contact",
      newContact.id,
      undefined, exec,
    );
  }

  return newContact.id;
}

/**
 * Resolve or create a chart account by name and type for the organization.
 */
async function resolveOrCreateAccount(
  organizationId: string,
  name: string,
  type: "asset" | "liability" | "equity" | "revenue" | "expense",
  subType: string,
  code: string,
  exec: StripeDb = db
): Promise<string> {
  const existing = await exec.query.chartAccount.findFirst({
    where: and(
      eq(chartAccount.organizationId, organizationId),
      eq(chartAccount.code, code),
      notDeleted(chartAccount.deletedAt)
    ),
  });
  if (existing) return existing.id;

  const [created] = await exec
    .insert(chartAccount)
    .values({
      organizationId,
      code,
      name,
      type,
      subType,
    })
    .returning();
  return created.id;
}

// ──────────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────────

async function handleChargeSucceededImpl(
  integration: Integration,
  charge: Stripe.Charge,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "charge", charge.id, exec)) return;

  if (
    !integration.clearingAccountId ||
    !integration.revenueAccountId ||
    !integration.feesAccountId
  ) {
    throw new Error("Stripe integration accounts not configured");
  }

  // Check if this charge's payment_intent already exists as a dubbl invoice payment
  if (charge.payment_intent) {
    const piId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent.id;

    const existingPayment = await exec.query.payment.findFirst({
      where: and(
        eq(payment.organizationId, integration.organizationId),
        eq(payment.stripePaymentIntentId, piId)
      ),
    });

    if (existingPayment) {
      // Already recorded via invoice payment link - only record the fee
      if (!charge.balance_transaction) return;

      const balanceTx = await balanceTransaction(charge.balance_transaction, integration);
      validateBalance(balanceTx, charge.currency);
      const fee = stripeMinor(balanceTx.fee);

      if (fee > 0) {
        const entryNumber = await getNextEntryNumber(integration.organizationId, exec);
        const [feeEntry] = await exec
          .insert(journalEntry)
          .values({
            organizationId: integration.organizationId,
            entryNumber,
            date: new Date(charge.created * 1000).toISOString().slice(0, 10),
            description: `Stripe fee for ${charge.id}`,
            reference: charge.id,
            status: "posted",
            sourceType: "stripe_fee",
            postedAt: new Date(),
            createdBy: integration.connectedBy,
          })
          .returning();

        await exec.insert(journalLine).values([
          {
            journalEntryId: feeEntry.id,
            accountId: integration.feesAccountId,
            description: `Stripe processing fee`,
            debitAmount: fee,
            creditAmount: 0,
          currencyCode: charge.currency.toUpperCase(),
          },
          {
            journalEntryId: feeEntry.id,
            accountId: integration.clearingAccountId,
            description: `Stripe processing fee`,
            debitAmount: 0,
            creditAmount: fee,
          currencyCode: charge.currency.toUpperCase(),
          },
        ]);

        await insertEntityMap(
          integration.organizationId,
          "charge",
          charge.id,
          "journal_entry",
          feeEntry.id,
          { type: "fee_only" },
          exec,
        );
      }
      return;
    }
  }

  // Resolve contact
  const customerId =
    typeof charge.customer === "string"
      ? charge.customer
      : charge.customer?.id ?? null;
  const contactId = await resolveContact(
    integration,
    customerId,
    charge.billing_details?.email ?? null,
    charge.billing_details?.name ?? null,
    exec,
  );

  const chargeDate = new Date(charge.created * 1000).toISOString().slice(0, 10);
  const currencyCode = charge.currency.toUpperCase();

  // Revenue journal entry: DR Stripe Clearing, CR Revenue
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);
  const [revenueEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: chargeDate,
      description: `Stripe charge ${charge.id}`,
      reference: charge.id,
      status: "posted",
      sourceType: "stripe_charge",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: revenueEntry.id,
      accountId: integration.clearingAccountId,
      description: `Stripe charge ${charge.id}`,
      debitAmount: charge.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: revenueEntry.id,
      accountId: integration.revenueAccountId,
      description: `Stripe charge ${charge.id}`,
      debitAmount: 0,
      creditAmount: charge.amount,
      currencyCode,
    },
  ]);

  await insertEntityMap(
    integration.organizationId,
    "charge",
    charge.id,
    "journal_entry",
    revenueEntry.id,
    { contactId, amount: charge.amount, currency: currencyCode },
    exec,
  );

  // Fee journal entry: DR Fees, CR Stripe Clearing
  if (!charge.balance_transaction) return;

  const balanceTx = await balanceTransaction(charge.balance_transaction, integration);
  validateBalance(balanceTx, charge.currency);
  const fee = stripeMinor(balanceTx.fee);

  if (fee > 0) {
    const feeEntryNumber = await getNextEntryNumber(integration.organizationId, exec);
    const [feeEntry] = await exec
      .insert(journalEntry)
      .values({
        organizationId: integration.organizationId,
        entryNumber: feeEntryNumber,
        date: chargeDate,
        description: `Stripe fee for ${charge.id}`,
        reference: charge.id,
        status: "posted",
        sourceType: "stripe_fee",
        postedAt: new Date(),
        createdBy: integration.connectedBy,
      })
      .returning();

    await exec.insert(journalLine).values([
      {
        journalEntryId: feeEntry.id,
        accountId: integration.feesAccountId,
        description: `Stripe processing fee`,
        debitAmount: fee,
        creditAmount: 0,
      currencyCode: charge.currency.toUpperCase(),
          },
      {
        journalEntryId: feeEntry.id,
        accountId: integration.clearingAccountId,
        description: `Stripe processing fee`,
        debitAmount: 0,
        creditAmount: fee,
      currencyCode: charge.currency.toUpperCase(),
          },
    ]);
  }
}

async function handleChargeRefundedImpl(
  integration: Integration,
  charge: Stripe.Charge,
  exec: StripeDb = db
) {
  if (
    !integration.clearingAccountId ||
    !integration.revenueAccountId ||
    !integration.feesAccountId
  ) {
    throw new Error("Stripe integration accounts not configured");
  }

  const refunds = charge.refunds?.data ?? [];

  for (const refund of refunds) {
    if (await isDuplicate(integration.organizationId, "refund", refund.id, exec)) continue;

    const refundDate = new Date(refund.created * 1000).toISOString().slice(0, 10);
    const currencyCode = refund.currency.toUpperCase();
    const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

    // Reverse revenue: DR Revenue, CR Stripe Clearing
    const [refundEntry] = await exec
      .insert(journalEntry)
      .values({
        organizationId: integration.organizationId,
        entryNumber,
        date: refundDate,
        description: `Stripe refund ${refund.id}`,
        reference: refund.id,
        status: "posted",
        sourceType: "stripe_refund",
        postedAt: new Date(),
        createdBy: integration.connectedBy,
      })
      .returning();

    await exec.insert(journalLine).values([
      {
        journalEntryId: refundEntry.id,
        accountId: integration.revenueAccountId,
        description: `Stripe refund ${refund.id}`,
        debitAmount: refund.amount,
        creditAmount: 0,
        currencyCode,
      },
      {
        journalEntryId: refundEntry.id,
        accountId: integration.clearingAccountId,
        description: `Stripe refund ${refund.id}`,
        debitAmount: 0,
        creditAmount: refund.amount,
        currencyCode,
      },
    ]);

    await insertEntityMap(
      integration.organizationId,
      "refund",
      refund.id,
      "journal_entry",
      refundEntry.id,
      { chargeId: charge.id, amount: refund.amount, currency: currencyCode },
      exec,
    );

    // Reverse fee if applicable (with its own dedup to handle partial failures)
    if (refund.balance_transaction) {
      const feeRefundKey = `refund_fee_${refund.id}`;
      if (!await isDuplicate(integration.organizationId, feeRefundKey, refund.id, exec)) {
        const balanceTx = await stripe.balanceTransactions.retrieve(
          typeof refund.balance_transaction === "string"
            ? refund.balance_transaction
            : refund.balance_transaction.id,
          { stripeAccount: integration.stripeAccountId }
        );

        // Fee refund is negative fee on the balance transaction
        validateBalance(balanceTx, refund.currency);
        const feeRefund = legacyMinor(BigInt(stripeMinor(balanceTx.fee, true)) < 0n ? -BigInt(balanceTx.fee) : BigInt(balanceTx.fee));
        if (feeRefund > 0) {
          const feeEntryNumber = await getNextEntryNumber(integration.organizationId, exec);
          const [feeRefundEntry] = await exec
            .insert(journalEntry)
            .values({
              organizationId: integration.organizationId,
              entryNumber: feeEntryNumber,
              date: refundDate,
              description: `Stripe fee refund for ${refund.id}`,
              reference: refund.id,
              status: "posted",
              sourceType: "stripe_fee_refund",
              postedAt: new Date(),
              createdBy: integration.connectedBy,
            })
            .returning();

          await exec.insert(journalLine).values([
            {
              journalEntryId: feeRefundEntry.id,
              accountId: integration.clearingAccountId,
              description: `Stripe fee refund`,
              debitAmount: feeRefund,
              creditAmount: 0,
            currencyCode: refund.currency.toUpperCase(),
          },
            {
              journalEntryId: feeRefundEntry.id,
              accountId: integration.feesAccountId,
              description: `Stripe fee refund`,
              debitAmount: 0,
              creditAmount: feeRefund,
            currencyCode: refund.currency.toUpperCase(),
          },
          ]);

          await insertEntityMap(
            integration.organizationId,
            feeRefundKey,
            refund.id,
            "journal_entry",
            feeRefundEntry.id,
            { feeRefund },
            exec,
          );
        }
      }
    }

    // Update invoice status if refund is linked to a payment
    const piId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

    if (piId) {
      const existingPayment = await exec.query.payment.findFirst({
        where: and(
          eq(payment.organizationId, integration.organizationId),
          eq(payment.stripePaymentIntentId, piId)
        ),
      });

      if (existingPayment) {
        // Find invoice allocation for this payment
        const allocations = await exec.query.paymentAllocation.findMany({
          where: eq(paymentAllocation.paymentId, existingPayment.id),
        });

        for (const alloc of allocations) {
          if (alloc.documentType !== "invoice") continue;

          const inv = await exec.query.invoice.findFirst({
            where: and(eq(invoice.id, alloc.documentId), eq(invoice.organizationId, integration.organizationId)),
          });
          if (!inv) continue;

          const newAmountPaid = legacyMinor(BigInt(inv.amountPaid) > BigInt(refund.amount) ? BigInt(inv.amountPaid) - BigInt(refund.amount) : 0n);
          const newAmountDue = legacyMinor(BigInt(inv.total) - BigInt(newAmountPaid));
          let newStatus: "sent" | "partial" | "paid" = "sent";
          if (newAmountPaid > 0 && newAmountPaid < inv.total) {
            newStatus = "partial";
          } else if (newAmountPaid >= inv.total) {
            newStatus = "paid";
          }

          await exec
            .update(invoice)
            .set({
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(and(eq(invoice.id, inv.id), eq(invoice.organizationId, integration.organizationId)));
        }
      }
    }
  }
}

async function handlePayoutPaidImpl(
  integration: Integration,
  payout: Stripe.Payout,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "payout", payout.id, exec)) return;

  if (!integration.clearingAccountId || !integration.payoutBankAccountId) {
    throw new Error("Stripe integration accounts not configured for payouts");
  }

  // Look up the bank account to get its chart account
  const bankAcct = await exec.query.bankAccount.findFirst({
    where: and(eq(bankAccount.id, integration.payoutBankAccountId), eq(bankAccount.organizationId, integration.organizationId)),
  });

  const payoutDate = new Date(payout.arrival_date * 1000).toISOString().slice(0, 10);
  const currencyCode = payout.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // DR Bank, CR Stripe Clearing
  const [payoutEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: payoutDate,
      description: `Stripe payout ${payout.id}`,
      reference: payout.id,
      status: "posted",
      sourceType: "stripe_payout",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  // Use the bank account's linked chart account if available
  const bankChartAccountId = bankAcct?.chartAccountId ?? integration.clearingAccountId;

  await exec.insert(journalLine).values([
    {
      journalEntryId: payoutEntry.id,
      accountId: bankChartAccountId,
      description: `Stripe payout ${payout.id}`,
      debitAmount: payout.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: payoutEntry.id,
      accountId: integration.clearingAccountId,
      description: `Stripe payout ${payout.id}`,
      debitAmount: 0,
      creditAmount: payout.amount,
      currencyCode,
    },
  ]);

  // Create bank transaction (auto-reconciled since we create journal entry + bank tx together)
  await exec.insert(bankTransaction).values({
    bankAccountId: integration.payoutBankAccountId,
    date: payoutDate,
    description: `Stripe payout ${payout.id}`,
    amount: payout.amount,
    status: "reconciled",
    sourceType: "stripe",
    externalTransactionId: payout.id,
    currencyCode,
    journalEntryId: payoutEntry.id,
  });

  await insertEntityMap(
    integration.organizationId,
    "payout",
    payout.id,
    "journal_entry",
    payoutEntry.id,
    { amount: payout.amount, currency: currencyCode },
    exec,
  );
}

async function handlePayoutFailedImpl(
  integration: Integration,
  payout: Stripe.Payout,
  exec: StripeDb = db
) {
  // Update integration status to error
  await exec
    .update(stripeIntegration)
    .set({
      status: "error",
      lastError: payout.failure_message ?? "Payout failed",
      updatedAt: new Date(),
    })
    .where(eq(stripeIntegration.id, integration.id));
}

async function handlePayoutCanceledImpl(
  integration: Integration,
  payout: Stripe.Payout,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "payout_canceled", payout.id, exec)) return;

  // Look up the original payout entity map
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "payout"),
      eq(stripeEntityMap.stripeEntityId, payout.id)
    ),
  });

  if (!mapped) return;

  // Void the linked journal entry
  await exec
    .update(journalEntry)
    .set({
      status: "void",
      voidReason: "Stripe payout canceled",
      updatedAt: new Date(),
    })
    .where(and(eq(journalEntry.id, mapped.dubblEntityId), eq(journalEntry.organizationId, integration.organizationId)));

  // Exclude the bank transaction (it didn't happen)
  await exec
    .update(bankTransaction)
    .set({
      status: "excluded",
    })
    .where(and(eq(bankTransaction.journalEntryId, mapped.dubblEntityId), eq(bankTransaction.bankAccountId, integration.payoutBankAccountId!)));

  await insertEntityMap(
    integration.organizationId,
    "payout_canceled",
    payout.id,
    "journal_entry",
    mapped.dubblEntityId,
    { voidedAt: new Date().toISOString() },
    exec,
  );
}

async function handlePayoutReversedImpl(
  integration: Integration,
  payout: Stripe.Payout,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "payout_reversed", payout.id, exec)) return;

  // Look up the original payout entity map
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "payout"),
      eq(stripeEntityMap.stripeEntityId, payout.id)
    ),
  });

  if (!mapped) return;

  if (!integration.clearingAccountId || !integration.payoutBankAccountId) return;

  // Look up bank account chart account
  const bankAcct = await exec.query.bankAccount.findFirst({
    where: and(eq(bankAccount.id, integration.payoutBankAccountId), eq(bankAccount.organizationId, integration.organizationId)),
  });
  const bankChartAccountId = bankAcct?.chartAccountId ?? integration.clearingAccountId;

  const reversalDate = new Date().toISOString().slice(0, 10);
  const currencyCode = payout.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // Reverse the payout: DR Stripe Clearing, CR Bank
  const [reversalEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: reversalDate,
      description: `Stripe payout reversal ${payout.id}`,
      reference: payout.id,
      status: "posted",
      sourceType: "stripe_payout_reversal",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: reversalEntry.id,
      accountId: integration.clearingAccountId,
      description: `Stripe payout reversal ${payout.id}`,
      debitAmount: payout.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: reversalEntry.id,
      accountId: bankChartAccountId,
      description: `Stripe payout reversal ${payout.id}`,
      debitAmount: 0,
      creditAmount: payout.amount,
      currencyCode,
    },
  ]);

  // Create a negative bank transaction for the reversal
  await exec.insert(bankTransaction).values({
    bankAccountId: integration.payoutBankAccountId,
    date: reversalDate,
    description: `Stripe payout reversal ${payout.id}`,
    amount: -payout.amount,
    status: "reconciled",
    sourceType: "stripe",
    externalTransactionId: `${payout.id}_reversal`,
    currencyCode,
    journalEntryId: reversalEntry.id,
  });

  await insertEntityMap(
    integration.organizationId,
    "payout_reversed",
    payout.id,
    "journal_entry",
    reversalEntry.id,
    { amount: payout.amount, currency: currencyCode },
    exec,
  );
}

async function handleDisputeCreatedImpl(
  integration: Integration,
  dispute: Stripe.Dispute,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "dispute", dispute.id, exec)) return;

  if (!integration.revenueAccountId) {
    throw new Error("Stripe integration accounts not configured");
  }

  // Resolve or create a Stripe Disputes liability account
  const disputeAccountId = await resolveOrCreateAccount(
    integration.organizationId,
    "Stripe Disputes",
    "liability",
    "current_liability",
    "STRIPE-DISPUTES",
    exec,
  );

  const disputeDate = new Date(dispute.created * 1000).toISOString().slice(0, 10);
  const currencyCode = dispute.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // DR Revenue, CR Dispute Liability
  const [disputeEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: disputeDate,
      description: `Stripe dispute ${dispute.id}`,
      reference: dispute.id,
      status: "posted",
      sourceType: "stripe_dispute",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: disputeEntry.id,
      accountId: integration.revenueAccountId,
      description: `Stripe dispute ${dispute.id}`,
      debitAmount: dispute.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: disputeEntry.id,
      accountId: disputeAccountId,
      description: `Stripe dispute ${dispute.id}`,
      debitAmount: 0,
      creditAmount: dispute.amount,
      currencyCode,
    },
  ]);

  await insertEntityMap(
    integration.organizationId,
    "dispute",
    dispute.id,
    "journal_entry",
    disputeEntry.id,
    { chargeId: typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id, amount: dispute.amount, currency: currencyCode },
    exec,
  );

  // If the charge was linked to a payment, update invoice amountPaid/amountDue
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (chargeId) {
    const chargeMap = await exec.query.stripeEntityMap.findFirst({
      where: and(
        eq(stripeEntityMap.organizationId, integration.organizationId),
        eq(stripeEntityMap.stripeEntityType, "charge"),
        eq(stripeEntityMap.stripeEntityId, chargeId)
      ),
    });

    if (chargeMap?.metadata && typeof chargeMap.metadata === "object") {
      // Look up payment by charge's payment intent
      const charge = await stripe.charges.retrieve(chargeId, {
        stripeAccount: integration.stripeAccountId,
      });
      const piId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;

      if (piId) {
        const existingPayment = await exec.query.payment.findFirst({
          where: and(
            eq(payment.organizationId, integration.organizationId),
            eq(payment.stripePaymentIntentId, piId)
          ),
        });

        if (existingPayment) {
          const allocations = await exec.query.paymentAllocation.findMany({
            where: eq(paymentAllocation.paymentId, existingPayment.id),
          });

          for (const alloc of allocations) {
            if (alloc.documentType !== "invoice") continue;
            const inv = await exec.query.invoice.findFirst({
              where: and(eq(invoice.id, alloc.documentId), eq(invoice.organizationId, integration.organizationId)),
            });
            if (!inv) continue;

            const newAmountPaid = legacyMinor(BigInt(inv.amountPaid) > BigInt(dispute.amount) ? BigInt(inv.amountPaid) - BigInt(dispute.amount) : 0n);
            const newAmountDue = legacyMinor(BigInt(inv.total) - BigInt(newAmountPaid));
            await exec
              .update(invoice)
              .set({
                amountPaid: newAmountPaid,
                amountDue: newAmountDue,
                status: newAmountPaid <= 0 ? "sent" : newAmountPaid < inv.total ? "partial" : "paid",
                updatedAt: new Date(),
              })
              .where(and(eq(invoice.id, inv.id), eq(invoice.organizationId, integration.organizationId)));
          }
        }
      }
    }
  }
}

async function handleDisputeClosedImpl(
  integration: Integration,
  dispute: Stripe.Dispute,
  exec: StripeDb = db
) {
  if (!integration.revenueAccountId) {
    throw new Error("Stripe integration accounts not configured");
  }

  // Check if we have the original dispute entry
  const disputeMap = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "dispute"),
      eq(stripeEntityMap.stripeEntityId, dispute.id)
    ),
  });

  if (!disputeMap) return;

  // Check for duplicate reversal/settlement
  if (await isDuplicate(integration.organizationId, "dispute_closed", dispute.id, exec)) return;

  // Lost dispute: settle liability by moving it to clearing (money left the account)
  if (dispute.status === "lost") {
    const disputeAccountId = await resolveOrCreateAccount(
      integration.organizationId,
      "Stripe Disputes",
      "liability",
      "current_liability",
      "STRIPE-DISPUTES",
      exec,
    );

    const closeDate = new Date().toISOString().slice(0, 10);
    const currencyCode = dispute.currency.toUpperCase();
    const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

    // Settle: DR Dispute Liability, CR Stripe Clearing
    const [settlementEntry] = await exec
      .insert(journalEntry)
      .values({
        organizationId: integration.organizationId,
        entryNumber,
        date: closeDate,
        description: `Stripe dispute lost ${dispute.id}`,
        reference: dispute.id,
        status: "posted",
        sourceType: "stripe_dispute_settlement",
        postedAt: new Date(),
        createdBy: integration.connectedBy,
      })
      .returning();

    await exec.insert(journalLine).values([
      {
        journalEntryId: settlementEntry.id,
        accountId: disputeAccountId,
        description: `Stripe dispute settlement ${dispute.id}`,
        debitAmount: dispute.amount,
        creditAmount: 0,
        currencyCode,
      },
      {
        journalEntryId: settlementEntry.id,
        accountId: integration.clearingAccountId!,
        description: `Stripe dispute settlement ${dispute.id}`,
        debitAmount: 0,
        creditAmount: dispute.amount,
        currencyCode,
      },
    ]);

    await insertEntityMap(
      integration.organizationId,
      "dispute_closed",
      dispute.id,
      "journal_entry",
      settlementEntry.id,
      { status: "lost", amount: dispute.amount, currency: currencyCode },
      exec,
    );

    // Book the dispute fee if present
    if (integration.feesAccountId && integration.clearingAccountId) {
      const balanceTxs = dispute.balance_transactions ?? [];
      const disputeTx = balanceTxs.find((bt) => bt.reporting_category === "dispute");
      if (disputeTx) {
        validateBalance(disputeTx, dispute.currency);
        const disputeFee = Math.abs(stripeMinor(disputeTx.fee, true));
        if (disputeFee > 0) {
          const feeEntryNumber = await getNextEntryNumber(integration.organizationId, exec);
          const [feeEntry] = await exec
            .insert(journalEntry)
            .values({
              organizationId: integration.organizationId,
              entryNumber: feeEntryNumber,
              date: closeDate,
              description: `Stripe dispute fee ${dispute.id}`,
              reference: dispute.id,
              status: "posted",
              sourceType: "stripe_fee",
              postedAt: new Date(),
              createdBy: integration.connectedBy,
            })
            .returning();

          await exec.insert(journalLine).values([
            {
              journalEntryId: feeEntry.id,
              accountId: integration.feesAccountId,
              description: `Stripe dispute fee`,
              debitAmount: disputeFee,
              creditAmount: 0,
              currencyCode,
            },
            {
              journalEntryId: feeEntry.id,
              accountId: integration.clearingAccountId,
              description: `Stripe dispute fee`,
              debitAmount: 0,
              creditAmount: disputeFee,
              currencyCode,
            },
          ]);
        }
      }
    }

    return;
  }

  // Only reverse revenue if merchant won the dispute
  if (dispute.status !== "won") return;

  const disputeAccountId = await resolveOrCreateAccount(
    integration.organizationId,
    "Stripe Disputes",
    "liability",
    "current_liability",
    "STRIPE-DISPUTES",
    exec,
  );

  const closeDate = new Date().toISOString().slice(0, 10);
  const currencyCode = dispute.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // Reverse: DR Dispute Liability, CR Revenue
  const [reversalEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: closeDate,
      description: `Stripe dispute won ${dispute.id}`,
      reference: dispute.id,
      status: "posted",
      sourceType: "stripe_dispute_reversal",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: reversalEntry.id,
      accountId: disputeAccountId,
      description: `Stripe dispute reversal ${dispute.id}`,
      debitAmount: dispute.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: reversalEntry.id,
      accountId: integration.revenueAccountId,
      description: `Stripe dispute reversal ${dispute.id}`,
      debitAmount: 0,
      creditAmount: dispute.amount,
      currencyCode,
    },
  ]);

  await insertEntityMap(
    integration.organizationId,
    "dispute_closed",
    dispute.id,
    "journal_entry",
    reversalEntry.id,
    { status: "won", amount: dispute.amount, currency: currencyCode },
    exec,
  );

  // Reverse dispute fee if applicable
  if (integration.feesAccountId && integration.clearingAccountId) {
    // Stripe charges a dispute fee when created and refunds it when won
    // The fee is typically in the balance_transactions on the dispute
    const balanceTxs = dispute.balance_transactions ?? [];
    const reversalTx = balanceTxs.find((bt) => bt.reporting_category === "dispute_reversal");
    if (reversalTx) {
      validateBalance(reversalTx, dispute.currency);
      const feeRefund = Math.abs(stripeMinor(reversalTx.fee, true));
      if (feeRefund > 0) {
        const feeEntryNumber = await getNextEntryNumber(integration.organizationId, exec);
        const [feeReversalEntry] = await exec
          .insert(journalEntry)
          .values({
            organizationId: integration.organizationId,
            entryNumber: feeEntryNumber,
            date: closeDate,
            description: `Stripe dispute fee reversal ${dispute.id}`,
            reference: dispute.id,
            status: "posted",
            sourceType: "stripe_fee_refund",
            postedAt: new Date(),
            createdBy: integration.connectedBy,
          })
          .returning();

        await exec.insert(journalLine).values([
          {
            journalEntryId: feeReversalEntry.id,
            accountId: integration.clearingAccountId,
            description: `Stripe dispute fee reversal`,
            debitAmount: feeRefund,
            creditAmount: 0,
            currencyCode,
          },
          {
            journalEntryId: feeReversalEntry.id,
            accountId: integration.feesAccountId,
            description: `Stripe dispute fee reversal`,
            debitAmount: 0,
            creditAmount: feeRefund,
            currencyCode,
          },
        ]);
      }
    }
  }
}

async function handleInvoicePaidImpl(
  integration: Integration,
  stripeInvoice: Stripe.Invoice,
  exec: StripeDb = db
) {
  const invoiceId = stripeInvoice.id;
  if (!invoiceId) return;

  // Check if we already processed this invoice
  if (await isDuplicate(integration.organizationId, "stripe_invoice", invoiceId, exec)) return;

  // Extract payment_intent ID for dedup and payment overlap checks
  const invoiceRaw = stripeInvoice as unknown as Record<string, unknown>;
  const invoiceChargeId = typeof invoiceRaw.charge === "string" ? invoiceRaw.charge : null;
  const invoicePIId = typeof invoiceRaw.payment_intent === "string" ? invoiceRaw.payment_intent : null;

  // Prevent double-booking: if this invoice's charge was already processed by handleChargeSucceeded, skip
  if (invoiceChargeId && await isDuplicate(integration.organizationId, "charge", invoiceChargeId, exec)) return;

  // Fallback: check via payment_intent if charge field isn't present
  if (!invoiceChargeId && invoicePIId) {
    const pi = await stripe.paymentIntents.retrieve(invoicePIId, { stripeAccount: integration.stripeAccountId });
    const latestChargeId = typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : (pi.latest_charge as { id?: string } | null)?.id ?? null;
    if (latestChargeId && await isDuplicate(integration.organizationId, "charge", latestChargeId, exec)) return;
  }

  if (
    !integration.clearingAccountId ||
    !integration.revenueAccountId ||
    !integration.feesAccountId
  ) {
    throw new Error("Stripe integration accounts not configured");
  }

  const amountPaid = stripeInvoice.amount_paid;
  if (!amountPaid || amountPaid <= 0) return;

  // Try to find matching internal invoice by customer mapping
  const customerId = typeof stripeInvoice.customer === "string"
    ? stripeInvoice.customer
    : (stripeInvoice.customer as { id?: string } | null)?.id ?? null;

  const contactId = await resolveContact(
    integration,
    customerId,
    stripeInvoice.customer_email ?? null,
    stripeInvoice.customer_name ?? null,
    exec,
  );

  const paidDate = stripeInvoice.status_transitions?.paid_at
    ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const currencyCode = stripeInvoice.currency.toUpperCase();

  // Extract tax info (compute from total - subtotal, or sum total_taxes)
  const subtotal = stripeInvoice.subtotal ?? amountPaid;
  const taxTotal = legacyMinor(BigInt(amountPaid) > BigInt(subtotal) ? BigInt(amountPaid) - BigInt(subtotal) : 0n);

  // Create journal entry: DR Clearing, CR Revenue (and CR Tax Liability if applicable)
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);
  const [entry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: paidDate,
      description: `Stripe invoice payment ${invoiceId}`,
      reference: invoiceId,
      status: "posted",
      sourceType: "stripe_charge",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  if (taxTotal > 0) {
    // 3-line entry: DR Clearing, CR Revenue (subtotal), CR Tax Liability (tax)
    const taxAccountId = await resolveOrCreateAccount(
      integration.organizationId,
      "Tax Liability",
      "liability",
      "current_liability",
      "2200",
      exec,
    );

    await exec.insert(journalLine).values([
      {
        journalEntryId: entry.id,
        accountId: integration.clearingAccountId,
        description: `Stripe invoice payment ${invoiceId}`,
        debitAmount: amountPaid,
        creditAmount: 0,
        currencyCode,
      },
      {
        journalEntryId: entry.id,
        accountId: integration.revenueAccountId,
        description: `Stripe invoice payment ${invoiceId}`,
        debitAmount: 0,
        creditAmount: subtotal,
        currencyCode,
      },
      {
        journalEntryId: entry.id,
        accountId: taxAccountId,
        description: `Stripe invoice tax ${invoiceId}`,
        debitAmount: 0,
        creditAmount: taxTotal,
        currencyCode,
      },
    ]);
  } else {
    // 2-line entry: DR Clearing, CR Revenue (unchanged behavior)
    await exec.insert(journalLine).values([
      {
        journalEntryId: entry.id,
        accountId: integration.clearingAccountId,
        description: `Stripe invoice payment ${invoiceId}`,
        debitAmount: amountPaid,
        creditAmount: 0,
        currencyCode,
      },
      {
        journalEntryId: entry.id,
        accountId: integration.revenueAccountId,
        description: `Stripe invoice payment ${invoiceId}`,
        debitAmount: 0,
        creditAmount: amountPaid,
        currencyCode,
      },
    ]);
  }

  // Create payment record if we have a contact, but skip if a payment already exists
  // for this PI (e.g. created by checkout.session.completed for a Dubbl invoice)
  if (contactId) {
    let paymentExists = false;
    if (invoicePIId) {
      const existing = await exec.query.payment.findFirst({
        where: and(
          eq(payment.organizationId, integration.organizationId),
          eq(payment.stripePaymentIntentId, invoicePIId)
        ),
      });
      paymentExists = !!existing;
    }

    if (!paymentExists) {
      const paymentNumber = await getNextNumber(
        integration.organizationId,
        "payment",
        "payment_number",
        "PAY",
        exec,
      );

      await exec.insert(payment).values({
        organizationId: integration.organizationId,
        contactId,
        paymentNumber,
        type: "received",
        date: paidDate,
        amount: amountPaid,
        method: "card",
        reference: invoiceId,
        currencyCode,
        journalEntryId: entry.id,
        stripePaymentIntentId: invoicePIId,
        createdBy: integration.connectedBy,
      });
    }
  }

  await insertEntityMap(
    integration.organizationId,
    "stripe_invoice",
    invoiceId,
    "journal_entry",
    entry.id,
    { amount: amountPaid, currency: currencyCode },
    exec,
  );
}

async function handleInvoiceVoidedImpl(
  integration: Integration,
  stripeInvoice: Stripe.Invoice,
  exec: StripeDb = db
) {
  // Look up entity map for this invoice
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "stripe_invoice"),
      eq(stripeEntityMap.stripeEntityId, stripeInvoice.id)
    ),
  });

  if (!mapped) return;

  // Void the linked journal entry
  await exec
    .update(journalEntry)
    .set({
      status: "void",
      voidReason: "Stripe invoice voided",
      updatedAt: new Date(),
    })
    .where(and(eq(journalEntry.id, mapped.dubblEntityId), eq(journalEntry.organizationId, integration.organizationId)));

  // Update entity map metadata
  await exec
    .update(stripeEntityMap)
    .set({
      metadata: {
        ...(mapped.metadata as Record<string, unknown> ?? {}),
        voided: true,
      },
    })
    .where(eq(stripeEntityMap.id, mapped.id));
}

async function handleCustomerCreatedImpl(
  integration: Integration,
  customer: Stripe.Customer,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "customer", customer.id, exec)) return;

  // Try to find existing contact by email
  if (customer.email) {
    const existing = await exec.query.contact.findFirst({
      where: and(
        eq(contact.organizationId, integration.organizationId),
        eq(contact.email, customer.email),
        notDeleted(contact.deletedAt)
      ),
    });
    if (existing) {
      await insertEntityMap(
        integration.organizationId,
        "customer",
        customer.id,
        "contact",
        existing.id,
        undefined, exec,
      );
      return;
    }
  }

  // Create new contact
  const address = customer.address;
  const [newContact] = await exec
    .insert(contact)
    .values({
      organizationId: integration.organizationId,
      name: customer.name || customer.email || "Stripe Customer",
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      type: "customer",
      addresses: address
        ? {
            billing: {
              line1: address.line1 ?? undefined,
              line2: address.line2 ?? undefined,
              city: address.city ?? undefined,
              state: address.state ?? undefined,
              postalCode: address.postal_code ?? undefined,
              country: address.country ?? undefined,
            },
          }
        : undefined,
    })
    .returning();

  await insertEntityMap(
    integration.organizationId,
    "customer",
    customer.id,
    "contact",
    newContact.id,
    undefined, exec,
  );
}

async function handleCustomerUpdatedImpl(
  integration: Integration,
  customer: Stripe.Customer,
  exec: StripeDb = db
) {
  // Look up existing mapping
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "customer"),
      eq(stripeEntityMap.stripeEntityId, customer.id)
    ),
  });

  if (mapped) {
    // Update existing contact
    const address = customer.address;
    await exec
      .update(contact)
      .set({
        name: customer.name || undefined,
        email: customer.email ?? undefined,
        phone: customer.phone ?? undefined,
        addresses: address
          ? {
              billing: {
                line1: address.line1 ?? undefined,
                line2: address.line2 ?? undefined,
                city: address.city ?? undefined,
                state: address.state ?? undefined,
                postalCode: address.postal_code ?? undefined,
                country: address.country ?? undefined,
              },
            }
          : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(contact.id, mapped.dubblEntityId), eq(contact.organizationId, integration.organizationId)));
  } else {
    // Create if not found
    await handleCustomerCreatedImpl(integration, customer, exec);
  }
}

// ──────────────────────────────────────────────────
// Subscription lifecycle handlers
// ──────────────────────────────────────────────────

async function handleSubscriptionCreatedImpl(
  integration: Integration,
  subscription: Stripe.Subscription,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "subscription", subscription.id, exec)) return;

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;

  const contactId = await resolveContact(integration, customerId, null, null, exec);

  await insertEntityMap(
    integration.organizationId,
    "subscription",
    subscription.id,
    "contact",
    contactId ?? integration.id,
    {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      items: subscription.items?.data?.map((item) => ({
        priceId: item.price?.id,
        amount: item.price?.unit_amount,
        amountMinor: item.price?.unit_amount == null ? null : String(stripeMinor(item.price.unit_amount)),
        currencyCode: item.price?.currency?.toUpperCase(),
        interval: item.price?.recurring?.interval,
        quantity: item.quantity,
      })),
    },
    exec,
  );
}

async function handleSubscriptionUpdatedImpl(
  integration: Integration,
  subscription: Stripe.Subscription,
  exec: StripeDb = db
) {
  const existing = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "subscription"),
      eq(stripeEntityMap.stripeEntityId, subscription.id)
    ),
  });

  if (existing) {
    await exec
      .update(stripeEntityMap)
      .set({
        metadata: {
          ...(existing.metadata as Record<string, unknown> ?? {}),
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          items: subscription.items?.data?.map((item) => ({
            priceId: item.price?.id,
            amount: item.price?.unit_amount,
        amountMinor: item.price?.unit_amount == null ? null : String(stripeMinor(item.price.unit_amount)),
        currencyCode: item.price?.currency?.toUpperCase(),
            interval: item.price?.recurring?.interval,
            quantity: item.quantity,
          })),
        },
      })
      .where(eq(stripeEntityMap.id, existing.id));
  } else {
    await handleSubscriptionCreatedImpl(integration, subscription, exec);
  }
}

async function handleSubscriptionDeletedImpl(
  integration: Integration,
  subscription: Stripe.Subscription,
  exec: StripeDb = db
) {
  const existing = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "subscription"),
      eq(stripeEntityMap.stripeEntityId, subscription.id)
    ),
  });

  if (existing) {
    await exec
      .update(stripeEntityMap)
      .set({
        metadata: {
          ...(existing.metadata as Record<string, unknown> ?? {}),
          status: "canceled",
          canceledAt: subscription.canceled_at,
        },
      })
      .where(eq(stripeEntityMap.id, existing.id));
  } else {
    await insertEntityMap(
      integration.organizationId,
      "subscription",
      subscription.id,
      "contact",
      integration.id,
      { status: "canceled", canceledAt: subscription.canceled_at },
      exec,
    );
  }
}

// ──────────────────────────────────────────────────
// Failed payment handlers
// ──────────────────────────────────────────────────

async function handleInvoicePaymentFailedImpl(
  integration: Integration,
  stripeInvoice: Stripe.Invoice,
  exec: StripeDb = db
) {
  const invoiceId = stripeInvoice.id;
  if (!invoiceId) return;
  if (await isDuplicate(integration.organizationId, "invoice_payment_failed", invoiceId, exec)) return;

  const customerId = typeof stripeInvoice.customer === "string"
    ? stripeInvoice.customer
    : (stripeInvoice.customer as { id?: string } | null)?.id ?? null;

  await resolveContact(
    integration,
    customerId,
    stripeInvoice.customer_email ?? null,
    stripeInvoice.customer_name ?? null,
    exec,
  );

  const reason = stripeInvoice.last_finalization_error?.message ?? "Payment failed";

  await insertEntityMap(
    integration.organizationId,
    "invoice_payment_failed",
    invoiceId,
    "notification",
    integration.id,
    { reason, amount: stripeInvoice.amount_due },
    exec,
  );

  if (integration.connectedBy) {
    await sendNotification({
      orgId: integration.organizationId,
      userId: integration.connectedBy,
      type: "stripe_payment_failed",
      title: `Stripe invoice payment failed`,
      body: `Invoice ${invoiceId}: ${reason} (${toMajorDecimal(money(BigInt(stripeInvoice.amount_due), stripeInvoice.currency))} ${stripeInvoice.currency.toUpperCase()})`,
      entityType: "stripe_invoice",
      entityId: invoiceId,
    });
  }
}

async function handlePaymentIntentFailedImpl(
  integration: Integration,
  paymentIntent: Stripe.PaymentIntent,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "payment_intent_failed", paymentIntent.id, exec)) return;

  const existingPayment = await exec.query.payment.findFirst({
    where: and(
      eq(payment.organizationId, integration.organizationId),
      eq(payment.stripePaymentIntentId, paymentIntent.id)
    ),
  });

  const reason = paymentIntent.last_payment_error?.message ?? "Payment failed";

  await insertEntityMap(
    integration.organizationId,
    "payment_intent_failed",
    paymentIntent.id,
    "notification",
    existingPayment?.id ?? integration.id,
    { reason, amount: paymentIntent.amount },
    exec,
  );

  if (integration.connectedBy) {
    await sendNotification({
      orgId: integration.organizationId,
      userId: integration.connectedBy,
      type: "stripe_payment_failed",
      title: `Stripe payment failed`,
      body: `PaymentIntent ${paymentIntent.id}: ${reason} (${toMajorDecimal(money(BigInt(paymentIntent.amount), paymentIntent.currency))} ${paymentIntent.currency.toUpperCase()})`,
      entityType: "payment_intent",
      entityId: paymentIntent.id,
    });
  }
}

// ──────────────────────────────────────────────────
// Customer deleted handler
// ──────────────────────────────────────────────────

async function handleCustomerDeletedImpl(
  integration: Integration,
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  exec: StripeDb = db
) {
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "customer"),
      eq(stripeEntityMap.stripeEntityId, customer.id)
    ),
  });

  if (!mapped) return;

  await exec
    .update(stripeEntityMap)
    .set({
      metadata: {
        ...(mapped.metadata as Record<string, unknown> ?? {}),
        stripeDeleted: true,
        deletedAt: new Date().toISOString(),
      },
    })
    .where(eq(stripeEntityMap.id, mapped.id));
}

// ──────────────────────────────────────────────────
// Charge expired handler
// ──────────────────────────────────────────────────

async function handleChargeExpiredImpl(
  integration: Integration,
  charge: Stripe.Charge,
  exec: StripeDb = db
) {
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "charge"),
      eq(stripeEntityMap.stripeEntityId, charge.id)
    ),
  });

  if (!mapped) return;

  // Void the linked journal entry (revenue)
  await exec
    .update(journalEntry)
    .set({
      status: "void",
      voidReason: "Stripe uncaptured charge expired",
      updatedAt: new Date(),
    })
    .where(and(eq(journalEntry.id, mapped.dubblEntityId), eq(journalEntry.organizationId, integration.organizationId)));

  // Also void any fee entry for this charge (stored as separate journal entry with same reference)
  await exec
    .update(journalEntry)
    .set({
      status: "void",
      voidReason: "Stripe uncaptured charge expired",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(journalEntry.organizationId, integration.organizationId),
        eq(journalEntry.reference, charge.id),
        eq(journalEntry.sourceType, "stripe_fee")
      )
    );

  await exec
    .update(stripeEntityMap)
    .set({
      metadata: {
        ...(mapped.metadata as Record<string, unknown> ?? {}),
        expired: true,
      },
    })
    .where(eq(stripeEntityMap.id, mapped.id));
}

// ──────────────────────────────────────────────────
// Transfer tracking handlers
// ──────────────────────────────────────────────────

async function handleTransferCreatedImpl(
  integration: Integration,
  transfer: Stripe.Transfer,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "transfer", transfer.id, exec)) return;

  if (!integration.clearingAccountId) {
    throw new Error("Stripe integration clearing account not configured");
  }

  const transferAccountId = await resolveOrCreateAccount(
    integration.organizationId,
    "Stripe Transfers",
    "liability",
    "current_liability",
    "STRIPE-TRANSFERS",
    exec,
  );

  const transferDate = new Date(transfer.created * 1000).toISOString().slice(0, 10);
  const currencyCode = transfer.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // DR Stripe Transfers, CR Stripe Clearing
  const [transferEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: transferDate,
      description: `Stripe transfer ${transfer.id}`,
      reference: transfer.id,
      status: "posted",
      sourceType: "stripe_transfer",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: transferEntry.id,
      accountId: transferAccountId,
      description: `Stripe transfer ${transfer.id}`,
      debitAmount: transfer.amount,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: transferEntry.id,
      accountId: integration.clearingAccountId,
      description: `Stripe transfer ${transfer.id}`,
      debitAmount: 0,
      creditAmount: transfer.amount,
      currencyCode,
    },
  ]);

  await insertEntityMap(
    integration.organizationId,
    "transfer",
    transfer.id,
    "journal_entry",
    transferEntry.id,
    {
      amount: transfer.amount,
      currency: currencyCode,
      destination: typeof transfer.destination === "string"
        ? transfer.destination
        : transfer.destination?.id ?? null,
    },
    exec,
  );
}

async function handleTransferReversedImpl(
  integration: Integration,
  transfer: Stripe.Transfer,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "transfer_reversal", transfer.id, exec)) return;

  if (!integration.clearingAccountId) {
    throw new Error("Stripe integration clearing account not configured");
  }

  // Look up original transfer
  const originalMap = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "transfer"),
      eq(stripeEntityMap.stripeEntityId, transfer.id)
    ),
  });

  if (!originalMap) return;

  const transferAccountId = await resolveOrCreateAccount(
    integration.organizationId,
    "Stripe Transfers",
    "liability",
    "current_liability",
    "STRIPE-TRANSFERS",
    exec,
  );

  const reversalDate = new Date().toISOString().slice(0, 10);
  const currencyCode = transfer.currency.toUpperCase();
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

  // DR Clearing, CR Stripe Transfers
  const [reversalEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: reversalDate,
      description: `Stripe transfer reversal ${transfer.id}`,
      reference: transfer.id,
      status: "posted",
      sourceType: "stripe_transfer_reversal",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  await exec.insert(journalLine).values([
    {
      journalEntryId: reversalEntry.id,
      accountId: integration.clearingAccountId,
      description: `Stripe transfer reversal ${transfer.id}`,
      debitAmount: transfer.amount_reversed,
      creditAmount: 0,
      currencyCode,
    },
    {
      journalEntryId: reversalEntry.id,
      accountId: transferAccountId,
      description: `Stripe transfer reversal ${transfer.id}`,
      debitAmount: 0,
      creditAmount: transfer.amount_reversed,
      currencyCode,
    },
  ]);

  await insertEntityMap(
    integration.organizationId,
    "transfer_reversal",
    transfer.id,
    "journal_entry",
    reversalEntry.id,
    { reversedAmount: transfer.amount_reversed, currency: currencyCode },
    exec,
  );
}

// ──────────────────────────────────────────────────
// Credit note handlers
// ──────────────────────────────────────────────────

async function handleStripeCreditNoteCreatedImpl(
  integration: Integration,
  stripeCN: Stripe.CreditNote,
  exec: StripeDb = db
) {
  if (await isDuplicate(integration.organizationId, "stripe_credit_note", stripeCN.id, exec)) return;

  if (!integration.revenueAccountId) {
    throw new Error("Stripe integration revenue account not configured");
  }

  // Resolve contact from customer
  const customerId = typeof stripeCN.customer === "string"
    ? stripeCN.customer
    : (stripeCN.customer as { id?: string } | null)?.id ?? null;

  const contactId = await resolveContact(integration, customerId, null, null, exec);
  if (!contactId) {
    throw new Error("Could not resolve contact for credit note");
  }

  // Generate credit note number
  const creditNoteNumber = await getNextNumber(
    integration.organizationId,
    "credit_note",
    "credit_note_number",
    "CN",
    exec,
  );

  // Find linked internal invoice if exists
  let linkedInvoiceId: string | null = null;
  if (stripeCN.invoice) {
    const invoiceStripeId = typeof stripeCN.invoice === "string"
      ? stripeCN.invoice
      : stripeCN.invoice.id;
    const invoiceMap = await exec.query.stripeEntityMap.findFirst({
      where: and(
        eq(stripeEntityMap.organizationId, integration.organizationId),
        eq(stripeEntityMap.stripeEntityType, "stripe_invoice"),
        eq(stripeEntityMap.stripeEntityId, invoiceStripeId)
      ),
    });
    if (invoiceMap) {
      // The dubblEntityId points to a journal_entry, but we need the invoice ID
      // Check if there's a linked invoice via the payment
      linkedInvoiceId = null; // We store the reference but don't force a link
    }
  }

  const issueDate = new Date(stripeCN.created * 1000).toISOString().slice(0, 10);
  const currencyCode = stripeCN.currency.toUpperCase();

  // Insert credit note record
  const [newCN] = await exec
    .insert(creditNote)
    .values({
      organizationId: integration.organizationId,
      contactId,
      invoiceId: linkedInvoiceId,
      creditNoteNumber,
      issueDate,
      status: "sent",
      reference: stripeCN.id,
      subtotal: stripeCN.subtotal,
      taxTotal: legacyMinor(BigInt(stripeCN.total) - BigInt(stripeCN.subtotal)),
      total: stripeCN.total,
      amountApplied: stripeCN.total,
      amountRemaining: 0,
      currencyCode,
      sentAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  // Insert credit note lines
  const lines = stripeCN.lines?.data ?? [];
  if (lines.length > 0) {
    await exec.insert(creditNoteLine).values(
      lines.map((line, idx) => ({
        creditNoteId: newCN.id,
        description: line.description ?? `Credit note line ${idx + 1}`,
        quantity: (line.quantity ?? 1) * 100,
        unitPrice: line.unit_amount ?? 0,
        accountId: integration.revenueAccountId!,
        amount: line.amount,
        sortOrder: idx,
      }))
    );
  }

  // Create journal entry
  const entryNumber = await getNextEntryNumber(integration.organizationId, exec);
  const journalLines: {
    journalEntryId: string;
    accountId: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    currencyCode: string;
  }[] = [];

  const [cnEntry] = await exec
    .insert(journalEntry)
    .values({
      organizationId: integration.organizationId,
      entryNumber,
      date: issueDate,
      description: `Stripe credit note ${stripeCN.id}`,
      reference: stripeCN.id,
      status: "posted",
      sourceType: "stripe_credit_note",
      postedAt: new Date(),
      createdBy: integration.connectedBy,
    })
    .returning();

  // DR Revenue for subtotal
  journalLines.push({
    journalEntryId: cnEntry.id,
    accountId: integration.revenueAccountId,
    description: `Stripe credit note ${stripeCN.id}`,
    debitAmount: stripeCN.subtotal,
    creditAmount: 0,
    currencyCode,
  });

  // DR Tax Liability if tax > 0
  const taxAmount = legacyMinor(BigInt(stripeCN.total) - BigInt(stripeCN.subtotal));
  if (taxAmount > 0) {
    const taxAccountId = await resolveOrCreateAccount(
      integration.organizationId,
      "Tax Liability",
      "liability",
      "current_liability",
      "2200",
      exec,
    );
    journalLines.push({
      journalEntryId: cnEntry.id,
      accountId: taxAccountId,
      description: `Stripe credit note tax ${stripeCN.id}`,
      debitAmount: taxAmount,
      creditAmount: 0,
      currencyCode,
    });
  }

  // CR Accounts Receivable for total
  const arAccountId = await resolveOrCreateAccount(
    integration.organizationId,
    "Accounts Receivable",
    "asset",
    "current_asset",
    "1200",
    exec,
  );
  journalLines.push({
    journalEntryId: cnEntry.id,
    accountId: arAccountId,
    description: `Stripe credit note ${stripeCN.id}`,
    debitAmount: 0,
    creditAmount: stripeCN.total,
    currencyCode,
  });

  await exec.insert(journalLine).values(journalLines);

  // Update credit note with journal entry ID
  await exec
    .update(creditNote)
    .set({ journalEntryId: cnEntry.id })
    .where(eq(creditNote.id, newCN.id));

  await insertEntityMap(
    integration.organizationId,
    "stripe_credit_note",
    stripeCN.id,
    "credit_note",
    newCN.id,
    { amount: stripeCN.total, invoiceId: linkedInvoiceId },
    exec,
  );
}

async function handleStripeCreditNoteUpdatedImpl(
  integration: Integration,
  stripeCN: Stripe.CreditNote,
  exec: StripeDb = db
) {
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "stripe_credit_note"),
      eq(stripeEntityMap.stripeEntityId, stripeCN.id)
    ),
  });

  if (!mapped) {
    await handleStripeCreditNoteCreatedImpl(integration, stripeCN, exec);
    return;
  }

  // Update local credit note amounts
  await exec
    .update(creditNote)
    .set({
      subtotal: stripeCN.subtotal,
      taxTotal: legacyMinor(BigInt(stripeCN.total) - BigInt(stripeCN.subtotal)),
      total: stripeCN.total,
      updatedAt: new Date(),
    })
    .where(and(eq(creditNote.id, mapped.dubblEntityId), eq(creditNote.organizationId, integration.organizationId)));

  // Update linked journal entry lines to match new amounts
  const cn = await exec.query.creditNote.findFirst({
    where: and(eq(creditNote.id, mapped.dubblEntityId), eq(creditNote.organizationId, integration.organizationId)),
  });

  if (cn?.journalEntryId) {
    // Void old journal entry and create a corrected one
    await exec
      .update(journalEntry)
      .set({
        status: "void",
        voidReason: "Stripe credit note amounts updated",
        updatedAt: new Date(),
      })
      .where(and(eq(journalEntry.id, cn.journalEntryId), eq(journalEntry.organizationId, integration.organizationId)));

    if (!integration.revenueAccountId) return;

    const currencyCode = stripeCN.currency.toUpperCase();
    const issueDate = new Date(stripeCN.created * 1000).toISOString().slice(0, 10);
    const entryNumber = await getNextEntryNumber(integration.organizationId, exec);

    const newJournalLines: {
      journalEntryId: string;
      accountId: string;
      description: string;
      debitAmount: number;
      creditAmount: number;
      currencyCode: string;
    }[] = [];

    const [newEntry] = await exec
      .insert(journalEntry)
      .values({
        organizationId: integration.organizationId,
        entryNumber,
        date: issueDate,
        description: `Stripe credit note ${stripeCN.id} (updated)`,
        reference: stripeCN.id,
        status: "posted",
        sourceType: "stripe_credit_note",
        postedAt: new Date(),
        createdBy: integration.connectedBy,
      })
      .returning();

    // DR Revenue for subtotal
    newJournalLines.push({
      journalEntryId: newEntry.id,
      accountId: integration.revenueAccountId,
      description: `Stripe credit note ${stripeCN.id}`,
      debitAmount: stripeCN.subtotal,
      creditAmount: 0,
      currencyCode,
    });

    // DR Tax Liability if tax > 0
    const taxAmount = legacyMinor(BigInt(stripeCN.total) - BigInt(stripeCN.subtotal));
    if (taxAmount > 0) {
      const taxAccountId = await resolveOrCreateAccount(
        integration.organizationId,
        "Tax Liability",
        "liability",
        "current_liability",
        "2200",
        exec,
      );
      newJournalLines.push({
        journalEntryId: newEntry.id,
        accountId: taxAccountId,
        description: `Stripe credit note tax ${stripeCN.id}`,
        debitAmount: taxAmount,
        creditAmount: 0,
        currencyCode,
      });
    }

    // CR Accounts Receivable for total
    const arAccountId = await resolveOrCreateAccount(
      integration.organizationId,
      "Accounts Receivable",
      "asset",
      "current_asset",
      "1200",
      exec,
    );
    newJournalLines.push({
      journalEntryId: newEntry.id,
      accountId: arAccountId,
      description: `Stripe credit note ${stripeCN.id}`,
      debitAmount: 0,
      creditAmount: stripeCN.total,
      currencyCode,
    });

    await exec.insert(journalLine).values(newJournalLines);

    // Update credit note to point to new journal entry
    await exec
      .update(creditNote)
      .set({ journalEntryId: newEntry.id })
      .where(and(eq(creditNote.id, mapped.dubblEntityId), eq(creditNote.organizationId, integration.organizationId)));
  }
}

async function handleStripeCreditNoteVoidedImpl(
  integration: Integration,
  stripeCN: Stripe.CreditNote,
  exec: StripeDb = db
) {
  const mapped = await exec.query.stripeEntityMap.findFirst({
    where: and(
      eq(stripeEntityMap.organizationId, integration.organizationId),
      eq(stripeEntityMap.stripeEntityType, "stripe_credit_note"),
      eq(stripeEntityMap.stripeEntityId, stripeCN.id)
    ),
  });

  if (!mapped) return;

  // Void linked journal entry
  const cn = await exec.query.creditNote.findFirst({
    where: and(eq(creditNote.id, mapped.dubblEntityId), eq(creditNote.organizationId, integration.organizationId)),
  });

  if (cn?.journalEntryId) {
    await exec
      .update(journalEntry)
      .set({
        status: "void",
        voidReason: "Stripe credit note voided",
        updatedAt: new Date(),
      })
      .where(and(eq(journalEntry.id, cn.journalEntryId), eq(journalEntry.organizationId, integration.organizationId)));
  }

  // Void local credit note
  await exec
    .update(creditNote)
    .set({
      status: "void",
      voidedAt: new Date(),
      amountRemaining: 0,
      updatedAt: new Date(),
    })
    .where(and(eq(creditNote.id, mapped.dubblEntityId), eq(creditNote.organizationId, integration.organizationId)));

  // Update entity map metadata
  await exec
    .update(stripeEntityMap)
    .set({
      metadata: {
        ...(mapped.metadata as Record<string, unknown> ?? {}),
        voided: true,
      },
    })
    .where(eq(stripeEntityMap.id, mapped.id));
}

// ──────────────────────────────────────────────────
// Unified event processor
// ──────────────────────────────────────────────────

async function processStripeEventImpl(
  event: Stripe.Event,
  integration: Integration,
  exec: StripeDb = db
): Promise<{ action: string }> {
  switch (event.type) {
    case "charge.succeeded": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeSucceededImpl(integration, charge, exec);
      return { action: "charge_succeeded" };
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefundedImpl(integration, charge, exec);
      return { action: "charge_refunded" };
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeCreatedImpl(integration, dispute, exec);
      return { action: "dispute_created" };
    }
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeClosedImpl(integration, dispute, exec);
      return { action: "dispute_closed" };
    }
    case "payout.paid": {
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutPaidImpl(integration, payout, exec);
      return { action: "payout_paid" };
    }
    case "payout.failed": {
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutFailedImpl(integration, payout, exec);
      return { action: "payout_failed" };
    }
    case "payout.canceled": {
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutCanceledImpl(integration, payout, exec);
      return { action: "payout_canceled" };
    }
    case "payout.updated": {
      const payout = event.data.object as Stripe.Payout;
      if (payout.status === "canceled") {
        await handlePayoutCanceledImpl(integration, payout, exec);
        return { action: "payout_canceled" };
      }
      if (payout.status === "reversed") {
        await handlePayoutReversedImpl(integration, payout, exec);
        return { action: "payout_reversed" };
      }
      return { action: "skipped" };
    }
    case "customer.created": {
      const customer = event.data.object as Stripe.Customer;
      await handleCustomerCreatedImpl(integration, customer, exec);
      return { action: "customer_created" };
    }
    case "customer.updated": {
      const customer = event.data.object as Stripe.Customer;
      await handleCustomerUpdatedImpl(integration, customer, exec);
      return { action: "customer_updated" };
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      await handleInvoicePaidImpl(integration, inv, exec);
      return { action: "invoice_paid" };
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailedImpl(integration, inv, exec);
      return { action: "invoice_payment_failed" };
    }
    case "invoice.voided": {
      const inv = event.data.object as Stripe.Invoice;
      await handleInvoiceVoidedImpl(integration, inv, exec);
      return { action: "invoice_voided" };
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentFailedImpl(integration, pi, exec);
      return { action: "payment_intent_failed" };
    }
    case "customer.deleted": {
      const customer = event.data.object as Stripe.Customer | Stripe.DeletedCustomer;
      await handleCustomerDeletedImpl(integration, customer, exec);
      return { action: "customer_deleted" };
    }
    case "charge.expired": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeExpiredImpl(integration, charge, exec);
      return { action: "charge_expired" };
    }
    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      await handleTransferCreatedImpl(integration, transfer, exec);
      return { action: "transfer_created" };
    }
    case "transfer.reversed": {
      const transfer = event.data.object as Stripe.Transfer;
      await handleTransferReversedImpl(integration, transfer, exec);
      return { action: "transfer_reversed" };
    }
    case "credit_note.created": {
      const cn = event.data.object as Stripe.CreditNote;
      await handleStripeCreditNoteCreatedImpl(integration, cn, exec);
      return { action: "credit_note_created" };
    }
    case "credit_note.updated": {
      const cn = event.data.object as Stripe.CreditNote;
      await handleStripeCreditNoteUpdatedImpl(integration, cn, exec);
      return { action: "credit_note_updated" };
    }
    case "credit_note.voided": {
      const cn = event.data.object as Stripe.CreditNote;
      await handleStripeCreditNoteVoidedImpl(integration, cn, exec);
      return { action: "credit_note_voided" };
    }
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreatedImpl(integration, sub, exec);
      return { action: "subscription_created" };
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdatedImpl(integration, sub, exec);
      return { action: "subscription_updated" };
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeletedImpl(integration, sub, exec);
      return { action: "subscription_deleted" };
    }
    default:
      return { action: "skipped" };
  }
}

export async function handleChargeSucceeded(integration: Integration, charge: Stripe.Charge) {
  return runStripeOperation(integration, charge, exec => handleChargeSucceededImpl(integration, charge, exec));
}

export async function handleChargeRefunded(integration: Integration, charge: Stripe.Charge) {
  return runStripeOperation(integration, charge, exec => handleChargeRefundedImpl(integration, charge, exec));
}

export async function handlePayoutPaid(integration: Integration, payout: Stripe.Payout) {
  return runStripeOperation(integration, payout, exec => handlePayoutPaidImpl(integration, payout, exec));
}

export async function handlePayoutFailed(integration: Integration, payout: Stripe.Payout) {
  return runStripeOperation(integration, payout, exec => handlePayoutFailedImpl(integration, payout, exec));
}

export async function handlePayoutCanceled(integration: Integration, payout: Stripe.Payout) {
  return runStripeOperation(integration, payout, exec => handlePayoutCanceledImpl(integration, payout, exec));
}

export async function handlePayoutReversed(integration: Integration, payout: Stripe.Payout) {
  return runStripeOperation(integration, payout, exec => handlePayoutReversedImpl(integration, payout, exec));
}

export async function handleDisputeCreated(integration: Integration, dispute: Stripe.Dispute) {
  return runStripeOperation(integration, dispute, exec => handleDisputeCreatedImpl(integration, dispute, exec));
}

export async function handleDisputeClosed(integration: Integration, dispute: Stripe.Dispute) {
  return runStripeOperation(integration, dispute, exec => handleDisputeClosedImpl(integration, dispute, exec));
}

export async function handleInvoicePaid(integration: Integration, stripeInvoice: Stripe.Invoice) {
  return runStripeOperation(integration, stripeInvoice, exec => handleInvoicePaidImpl(integration, stripeInvoice, exec));
}

export async function handleInvoiceVoided(integration: Integration, stripeInvoice: Stripe.Invoice) {
  return runStripeOperation(integration, stripeInvoice, exec => handleInvoiceVoidedImpl(integration, stripeInvoice, exec));
}

export async function handleCustomerCreated(integration: Integration, customer: Stripe.Customer) {
  return runStripeOperation(integration, customer, exec => handleCustomerCreatedImpl(integration, customer, exec));
}

export async function handleCustomerUpdated(integration: Integration, customer: Stripe.Customer) {
  return runStripeOperation(integration, customer, exec => handleCustomerUpdatedImpl(integration, customer, exec));
}

export async function handleSubscriptionCreated(integration: Integration, subscription: Stripe.Subscription) {
  return runStripeOperation(integration, subscription, exec => handleSubscriptionCreatedImpl(integration, subscription, exec));
}

export async function handleSubscriptionUpdated(integration: Integration, subscription: Stripe.Subscription) {
  return runStripeOperation(integration, subscription, exec => handleSubscriptionUpdatedImpl(integration, subscription, exec));
}

export async function handleSubscriptionDeleted(integration: Integration, subscription: Stripe.Subscription) {
  return runStripeOperation(integration, subscription, exec => handleSubscriptionDeletedImpl(integration, subscription, exec));
}

export async function handleInvoicePaymentFailed(integration: Integration, stripeInvoice: Stripe.Invoice) {
  return runStripeOperation(integration, stripeInvoice, exec => handleInvoicePaymentFailedImpl(integration, stripeInvoice, exec));
}

export async function handlePaymentIntentFailed(integration: Integration, paymentIntent: Stripe.PaymentIntent) {
  return runStripeOperation(integration, paymentIntent, exec => handlePaymentIntentFailedImpl(integration, paymentIntent, exec));
}

export async function handleCustomerDeleted(integration: Integration, customer: Stripe.Customer | Stripe.DeletedCustomer) {
  return runStripeOperation(integration, customer, exec => handleCustomerDeletedImpl(integration, customer, exec));
}

export async function handleChargeExpired(integration: Integration, charge: Stripe.Charge) {
  return runStripeOperation(integration, charge, exec => handleChargeExpiredImpl(integration, charge, exec));
}

export async function handleTransferCreated(integration: Integration, transfer: Stripe.Transfer) {
  return runStripeOperation(integration, transfer, exec => handleTransferCreatedImpl(integration, transfer, exec));
}

export async function handleTransferReversed(integration: Integration, transfer: Stripe.Transfer) {
  return runStripeOperation(integration, transfer, exec => handleTransferReversedImpl(integration, transfer, exec));
}

export async function handleStripeCreditNoteCreated(integration: Integration, stripeCN: Stripe.CreditNote) {
  return runStripeOperation(integration, stripeCN, exec => handleStripeCreditNoteCreatedImpl(integration, stripeCN, exec));
}

export async function handleStripeCreditNoteUpdated(integration: Integration, stripeCN: Stripe.CreditNote) {
  return runStripeOperation(integration, stripeCN, exec => handleStripeCreditNoteUpdatedImpl(integration, stripeCN, exec));
}

export async function handleStripeCreditNoteVoided(integration: Integration, stripeCN: Stripe.CreditNote) {
  return runStripeOperation(integration, stripeCN, exec => handleStripeCreditNoteVoidedImpl(integration, stripeCN, exec));
}

export async function processStripeEvent(event: Stripe.Event, integration: Integration) {
  if (event.account && event.account !== integration.stripeAccountId) throw new WireCompatibilityError("Stripe event belongs to a different connected account");
  const supported = new Set(["charge.succeeded", "charge.refunded", "charge.dispute.created", "charge.dispute.closed", "payout.paid", "payout.failed", "payout.canceled", "payout.updated", "customer.created", "customer.updated", "customer.deleted", "invoice.paid", "invoice.payment_failed", "invoice.voided", "payment_intent.payment_failed", "charge.expired", "transfer.created", "transfer.reversed", "credit_note.created", "credit_note.updated", "credit_note.voided", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
  if (!supported.has(event.type)) return { action: "skipped" };
  return runStripeOperation(integration, event.data.object, exec => processStripeEventImpl(event, integration, exec));
}
