import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditLog, purchaseOrder, purchaseOrderLine, billPurchaseOrder } from "@/lib/db/schema";
import { WireCompatibilityError } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const reservationsSchema = z.array(z.object({
  lineId: z.string().uuid(), quantity: z.number().int().positive().max(2147483647),
})).min(1).max(1000);

/** Conversion reserves procurement quantities before recognition. Older ambiguous history is unchanged. */
export async function purchaseOrderReservations(tx: Tx, org: string, billId: string) {
  const events = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, org), eq(auditLog.entityType, "purchase_order"),
    eq(auditLog.action, "convert"), sql`${auditLog.changes}->>'billId' = ${billId}`));
  const reservations: { line: typeof purchaseOrderLine.$inferSelect; quantity: number; purchaseOrderId: string }[] = [];
  for (const event of events) {
    const changes = event.changes as { reservations?: unknown } | null;
    if (changes?.reservations === undefined) continue;
    const parsed = reservationsSchema.safeParse(changes.reservations);
    if (!parsed.success || !event.entityId || events.length !== 1) throw new WireCompatibilityError("Invalid purchase order conversion reservation history");
    const [link] = await tx.select({ id: billPurchaseOrder.id }).from(billPurchaseOrder)
      .where(and(eq(billPurchaseOrder.billId, billId), eq(billPurchaseOrder.purchaseOrderId, event.entityId)));
    if (!link) throw new WireCompatibilityError("Purchase order conversion reservation link is missing");
    const ids = new Set<string>();
    for (const reserved of parsed.data) {
      if (ids.has(reserved.lineId)) throw new WireCompatibilityError("Duplicate purchase order conversion reservation");
      ids.add(reserved.lineId);
      const [row] = await tx.select({ line: purchaseOrderLine }).from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrderLine.purchaseOrderId, purchaseOrder.id))
        .where(and(eq(purchaseOrderLine.id, reserved.lineId), eq(purchaseOrder.id, event.entityId), eq(purchaseOrder.organizationId, org))).for("update");
      if (!row || row.line.quantityBilled < reserved.quantity) throw new WireCompatibilityError("Purchase order conversion reservation is inconsistent");
      reservations.push({ line: row.line, quantity: reserved.quantity, purchaseOrderId: event.entityId });
    }
  }
  return reservations;
}
