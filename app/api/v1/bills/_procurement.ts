// Legacy GRN-to-bill linkage, retained for MON-052. Lifecycle posting now lives
// in lib/api/bill-lifecycle.ts and uses one transaction across all effects.
import { db } from "@/lib/db";
import { billPurchaseOrder } from "@/lib/db/schema";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

/** Link a bill to one or more purchase orders via the join table (idempotent). */
export async function linkBillToPurchaseOrders(
  billId: string,
  purchaseOrderIds: string[],
  tx: DbOrTx = db
): Promise<void> {
  const unique = Array.from(new Set(purchaseOrderIds.filter(Boolean)));
  if (unique.length === 0) return;
  await tx
    .insert(billPurchaseOrder)
    .values(unique.map((purchaseOrderId) => ({ billId, purchaseOrderId })))
    .onConflictDoNothing();
}
