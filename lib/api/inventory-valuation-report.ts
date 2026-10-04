import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryCostLayer, inventoryLayerConsumption, inventoryMovement, organization, warehouse } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { itemDto } from "./inventory-master-wire";
import { valuationReportSchema, layerListSchema, layerDto, consumptionDto } from "./inventory-valuation-wire";
import { publicMoneyDto } from "./public-money-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

export async function inventoryValuationReport(ctx: AuthContext, input: unknown) {
  const p = valuationReportSchema.parse(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
    if (!org) throw new AuthError("Organization not found", 404);
    const rows = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.organizationId, ctx.organizationId), eq(inventoryItem.isActive, true), isNull(inventoryItem.deletedAt))).orderBy(asc(inventoryItem.id));
    const items = rows.map(row => {
      itemDto(row);
      // Preserve the existing price-projection fields. Carrying value is a separate saved measure.
      const totalCost = legacyMinor(BigInt(row.quantityOnHand) * BigInt(row.purchasePrice));
      const totalValue = legacyMinor(BigInt(row.quantityOnHand) * BigInt(row.salePrice));
      const margin = legacyMinor(BigInt(totalValue) - BigInt(totalCost));
      return publicMoneyDto({ id: row.id, code: row.code, name: row.name, category: row.category, quantityOnHand: row.quantityOnHand,
        unitCost: row.purchasePrice, totalCost, salePrice: row.salePrice, totalValue, margin,
        marginPercent: totalCost > 0 ? margin / totalCost * 100 : 0,
        carryingValue: row.totalValue, averageCost: row.averageCost, costMethod: row.costMethod, currencyCode: org.defaultCurrency ?? "USD" },
      ["unitCost", "totalCost", "salePrice", "totalValue", "margin", "carryingValue", "averageCost"]);
    });
    const key = p.sortBy === "quantity" ? "quantityOnHand" : p.sortBy;
    items.sort((a, b) => {
      const av = a[key], bv = b[key];
      const comparison = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : av < bv ? -1 : av > bv ? 1 : 0;
      return (p.sortOrder === "desc" ? -1 : 1) * comparison || a.id.localeCompare(b.id);
    });
    const sum = (key: "totalCost" | "totalValue" | "carryingValue") => legacyMinor(items.reduce((s, i) => s + BigInt(i[key]), 0n));
    const totalCost = sum("totalCost"), totalValue = sum("totalValue"), carryingValue = sum("carryingValue");
    const result = { items, summary: publicMoneyDto({ totalItems: items.length, totalCost, totalValue,
      totalMargin: totalCost > 0 ? legacyMinor(BigInt(totalValue) - BigInt(totalCost)) / totalCost * 100 : 0, carryingValue,
      currencyCode: org.defaultCurrency ?? "USD" }, ["totalCost", "totalValue", "carryingValue"]) };
    stringifyWire(result); return result;
  });
}
export async function listInventoryCostLayers(ctx: AuthContext, input: unknown) {
  const p = layerListSchema.parse(input);
  return db.transaction(async tx => {
    const item = await tx.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.id, p.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt)) });
    if (!item) throw new AuthError("Inventory item not found", 404);
    const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.inventoryItemId, item.id), eq(inventoryCostLayer.organizationId, ctx.organizationId))).orderBy(asc(inventoryCostLayer.receivedAt), asc(inventoryCostLayer.id));
    const data = [];
    for (const layer of layers) {
      if (layer.sourceMovementId && !await tx.query.inventoryMovement.findFirst({ where: and(eq(inventoryMovement.id, layer.sourceMovementId), eq(inventoryMovement.organizationId, ctx.organizationId), eq(inventoryMovement.inventoryItemId, item.id)) }))
        throw new AuthError("Cost layer source outside owned item", 404);
      if (layer.warehouseId) {
        const wh = await tx.query.warehouse.findFirst({ where: and(eq(warehouse.id, layer.warehouseId), eq(warehouse.organizationId, ctx.organizationId)) });
        if (!wh) throw new AuthError("Cost layer warehouse outside organization", 404);
      }
      const consumptions = await tx.select().from(inventoryLayerConsumption).where(eq(inventoryLayerConsumption.costLayerId, layer.id)).orderBy(asc(inventoryLayerConsumption.id));
      for (const c of consumptions) {
        const movement = await tx.query.inventoryMovement.findFirst({ where: and(eq(inventoryMovement.id, c.issueMovementId), eq(inventoryMovement.organizationId, ctx.organizationId), eq(inventoryMovement.inventoryItemId, item.id)) });
        if (!movement) throw new AuthError("Layer consumption outside owned item", 404);
      }
      data.push({ ...layerDto(layer), consumptions: consumptions.map(consumptionDto) });
    }
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
    const result = { inventoryItem: itemDto(item), currencyCode: org?.defaultCurrency ?? "USD", data }; stringifyWire(result); return result;
  });
}
