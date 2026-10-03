import { z } from "zod";
import { WireCompatibilityError } from "@/lib/money/wire";
import { contactDto } from "./contact-wire";
import { publicMoneyDto } from "./public-money-wire";

export const paymentListFields = {
  type: z.enum(["received", "made"]).optional().describe("Optional payment direction: received from customers or made to suppliers"),
  contactId: z.string().uuid().optional().describe("Optional customer or supplier UUID in the authenticated organization"),
  limit: z.number().int().min(1).max(100).default(50).describe("Payments per page, 1 through 100; defaults to 50"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number from 1; bounded to a safe SQL offset"),
};
export const paymentListSchema = z.object(paymentListFields);

type PaymentRead = {
  organizationId: string;
  amount: number;
  contact: { organizationId: string; creditLimit: number | null } | null;
  bankAccount?: { organizationId: string; balance: number; lowBalanceThreshold: number | null } | null;
  allocations: { amount: number }[];
};

/** Signed historical minor units remain unchanged, including noncash paired allocations. */
export function paymentReadDto<T extends PaymentRead>(value: T, orgId: string) {
  if (value.organizationId !== orgId || (value.contact && value.contact.organizationId !== orgId)
    || (value.bankAccount && value.bankAccount.organizationId !== orgId)) {
    throw new WireCompatibilityError("Payment contains a reference outside this organization");
  }
  const bank = value.bankAccount;
  return {
    ...publicMoneyDto(value, ["amount"]),
    contact: value.contact ? contactDto(value.contact) : null,
    allocations: value.allocations.map(row => publicMoneyDto(row, ["amount"])),
    ...(bank === undefined ? {} : { bankAccount: bank ? {
      ...publicMoneyDto(bank, ["balance"]),
      lowBalanceThresholdMinor: bank.lowBalanceThreshold === null ? null
        : publicMoneyDto({ amount: bank.lowBalanceThreshold }, ["amount"]).amountMinor,
    } : null }),
  };
}
