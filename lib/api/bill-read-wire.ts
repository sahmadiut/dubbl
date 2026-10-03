import { z } from "zod";
import { billStatusEnum } from "@/lib/db/schema/bills";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { contactDto } from "./contact-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";

export const billListFields = {
  status: z.enum(billStatusEnum.enumValues).optional().describe("Optional bill status, including pending_approval"),
  limit: z.number().int().min(1).max(100).default(50).describe("Bills per page, 1 through 100; defaults to 50"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number from 1; bounded to a safe SQL offset"),
};
export const billListSchema = z.object(billListFields);

type Header = { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number };
type Contact = { organizationId: string; creditLimit: number | null };
type Line = { unitPrice: number; amount: number; taxAmount: number;
  account?: { organizationId: string } | null; taxRate?: { organizationId: string } | null };

/** Historical inactive/deleted references remain readable only within this tenant. */
export function billReadDto<T extends Header & { contact: Contact | null; lines?: Line[] }>(value: T, orgId: string) {
  if ((value.contact && value.contact.organizationId !== orgId) || value.lines?.some(line =>
    (line.account && line.account.organizationId !== orgId) || (line.taxRate && line.taxRate.organizationId !== orgId))) {
    throw new WireCompatibilityError("Bill contains a reference outside this organization");
  }
  return { ...publicMoneyDto(value, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]),
    contact: value.contact ? contactDto(value.contact) : null,
    ...(value.lines ? { lines: value.lines.map(publicLineDto) } : {}) };
}

function safeMinor(value: string) {
  const amount = BigInt(value), limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (amount < -limit || amount > limit) throw new WireCompatibilityError();
  return legacyMinor(amount);
}

type CountRow = { status: string; count: number; amount: string; minAmount: string; maxAmount: string;
  currencyCount: number; currencyCode: string };

/** SQL aggregates arrive as text, including min/max to detect unsafe offsetting history. */
export function billCountsDto(rows: CountRow[]) {
  const counts: Record<string, { count: number; amount: number; amountMinor: string; currencyCode: string }> = {};
  let total = 0;
  for (const row of rows) {
    if (row.currencyCount !== 1) throw new WireCompatibilityError("Bill status totals cannot combine different currencies");
    safeMinor(row.minAmount); safeMinor(row.maxAmount);
    const amount = safeMinor(row.amount);
    counts[row.status] = { count: row.count, amount, amountMinor: BigInt(row.amount).toString(), currencyCode: row.currencyCode };
    total += row.count;
  }
  return { counts, total };
}
