import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditLog, bulkImportJob, chartAccount, contact, inventoryItem, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { createInventoryItemInTransaction, orgLock } from "@/lib/api/inventory-master";
import { stringifyWire } from "@/lib/money/wire";
import { csvImportSchema, directEntity, importJobsSchema, importRowsSchema, mappedCsvRows, parseGenericRow } from "./generic-wire";

export const importPermission = { accounts: "manage:accounts", contacts: "manage:contacts", products: "manage:inventory" } as const;

/** Validate the entire wire batch before jobs; domain failures remain per-row. */
export async function importGenericRows(ctx: AuthContext, entity: z.infer<typeof directEntity>, input: unknown, request?: Request) {
  requireRole(ctx, importPermission[entity]);
  const parsed = importRowsSchema.parse(input);
  const rows = parsed.rows.map(row => parseGenericRow(entity, row, parsed.source));
  return db.transaction(async tx => {
    await orgLock(tx, ctx);
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (rows.some(row => row.entity === "products" && row.data.currencyCode && row.data.currencyCode !== org?.defaultCurrency)) {
      throw new AuthError("Product import currency must match organization base currency; stored fixed-decimal units are never rescaled", 422);
    }
    const [job] = await tx.insert(bulkImportJob).values({ organizationId: ctx.organizationId, type: entity,
      fileName: parsed.fileName, totalRows: rows.length, status: "processing", createdBy: ctx.userId }).returning();
    let processedRows = 0;
    const errorDetails: { row: number; error: string }[] = [];
    const [count] = await tx.select({ value: sql<number>`count(*)`.mapWith(Number) }).from(inventoryItem).where(eq(inventoryItem.organizationId, ctx.organizationId));
    let counter = count.value + 1;
    for (const [i, row] of rows.entries()) {
      try {
        // A failed DB row must roll back its row/ledger/audit writes without
        // aborting the surrounding job or the next row (PostgreSQL savepoint).
        await tx.transaction(async nested => {
          if (row.entity === "accounts") await nested.insert(chartAccount).values({ ...row.data, organizationId: ctx.organizationId });
          else if (row.entity === "contacts") {
            const { billingLine1: line1, billingCity: city, billingState: state, billingPostalCode: postalCode, billingCountry: country, ...values } = row.data;
            await nested.insert(contact).values({ ...values, organizationId: ctx.organizationId,
              addresses: line1 || city || state || postalCode || country ? { billing: { line1: line1 || undefined, city: city || undefined, state: state || undefined,
                postalCode: postalCode || undefined, country: country || undefined } } : undefined });
          } else {
            let code = row.data.sku || "";
            if (!code) {
              do { code = `PROD-${String(counter++).padStart(4, "0")}`; }
              while (await nested.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.organizationId, ctx.organizationId), eq(inventoryItem.code, code)), columns: { id: true } }));
            }
            await createInventoryItemInTransaction(nested, ctx, { code, name: row.data.name, sku: row.data.sku, description: row.data.description,
              salePrice: row.data.salePrice, purchasePrice: row.data.purchasePrice, quantityOnHand: row.data.quantityOnHand }, request);
          }
        });
        processedRows++;
      } catch {
        // Driver errors can include parameter values; expose a bounded job
        // failure, without leaking tenant data or infrastructure internals.
        errorDetails.push({ row: i + 1, error: "Row could not be imported; check duplicates, references and inventory posting constraints" });
      }
    }
    const errorRows = errorDetails.length, status = errorRows === rows.length ? "failed" : "completed";
    const [updated] = await tx.update(bulkImportJob).set({ processedRows, errorRows, errorDetails: errorRows ? errorDetails : null,
      status, completedAt: new Date() }).where(and(eq(bulkImportJob.id, job.id), eq(bulkImportJob.organizationId, ctx.organizationId))).returning();
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action: "import", entityType: entity, entityId: job.id,
      changes: { count: processedRows, errorRows, jobId: job.id }, userAgent: request?.headers.get("user-agent") || null });
    const result = { job: updated, summary: { jobId: job.id, totalRows: rows.length, processedRows, errorRows, status, errors: errorDetails.slice(0, 10) } };
    stringifyWire(result); return result;
  });
}
export async function importGenericCsv(ctx: AuthContext, input: unknown) {
  const parsed = csvImportSchema.parse(input);
  requireRole(ctx, importPermission[parsed.entityType]);
  return (await importGenericRows(ctx, parsed.entityType, { fileName: `mcp-import-${parsed.entityType}.csv`, source: parsed.source,
    rows: mappedCsvRows(parsed.entityType, parsed.source, parsed.csvContent) })).summary;
}
export async function listGenericImportJobs(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const parsed = importJobsSchema.parse(input);
  const jobs = await db.query.bulkImportJob.findMany({ where: eq(bulkImportJob.organizationId, ctx.organizationId),
    orderBy: [desc(bulkImportJob.createdAt), desc(bulkImportJob.id)], limit: parsed.limit, offset: parsed.offset });
  return { jobs, total: jobs.length };
}
