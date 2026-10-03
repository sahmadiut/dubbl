import { createRecurringInvoice, getRecurringInvoice, changeRecurringInvoice, previewRecurringInvoice } from "@/lib/api/recurring-invoice";
import { recurringInvoiceLineSchema } from "@/lib/api/recurring-invoice-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { logAudit } from "@/lib/api/audit";
import { processRecurringDocuments } from "@/lib/api/recurring-generate";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for recurring DOCUMENT templates: scheduled invoices, bills, and
 * expenses (NOT recurring journal templates — those live in
 * recurring-journals.ts and are a separate GL feature). A template stores its
 * line items and a schedule (frequency + start/end dates + optional occurrence
 * cap); the recurring generator materialises one real document (invoice / bill /
 * expense) per due occurrence and advances the schedule.
 *
 * Invoice prices support numeric/exact decimal major units and canonical minor
 * strings; saved prices follow the currency scale. Bills/expenses retain their
 * numeric major prices and legacy cents. Quantity is stored in hundredths and
 * discounts in basis points. Services use direct org-scoped Drizzle access.
 */
export function registerRecurringTemplateTools(server: McpServer, ctx: AuthContext) {
  const FREQUENCIES = [
    "weekly",
    "fortnightly",
    "monthly",
    "quarterly",
    "semi_annual",
    "annual",
  ] as const;

  // Document templates only — journal templates are handled by the separate
  // recurring-journal tools and must never be touched here.
  const DOCUMENT_TYPES = ["invoice", "bill", "expense"] as const;

  server.tool(
    "list_recurring_templates",
    "List recurring DOCUMENT templates (invoice / bill / expense) for the organization, with optional filters and pagination. Each row includes the linked contact. Journal templates are excluded (use the recurring-journal tools for those). Stored invoice unitPrice is in currency minor units with unitPriceMinor aliases (USD cents); other documents retain legacy cents and quantity is the decimal x 100.",
    {
      type: z
        .enum(DOCUMENT_TYPES)
        .optional()
        .describe("Filter by template type: invoice, bill, or expense"),
      status: z
        .enum(["active", "paused", "completed"])
        .optional()
        .describe("Filter by template status"),
      frequency: z
        .enum(FREQUENCIES)
        .optional()
        .describe("Filter by schedule frequency"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe("Number of templates to return (max 100)"),
      page: z.number().int().min(1).optional().default(1).describe("Page number (1-based)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const conditions = [
          eq(recurringTemplate.organizationId, ctx.organizationId),
          notDeleted(recurringTemplate.deletedAt),
          inArray(recurringTemplate.type, [...DOCUMENT_TYPES]),
        ];
        // Apply document/status/frequency filters before pagination.
        if (params.type) conditions.push(eq(recurringTemplate.type, params.type));

        if (params.status) conditions.push(eq(recurringTemplate.status, params.status));
        if (params.frequency) conditions.push(eq(recurringTemplate.frequency, params.frequency));
        const offset = (params.page - 1) * params.limit;
        const templates = await db.query.recurringTemplate.findMany({
          where: and(...conditions),
          orderBy: desc(recurringTemplate.createdAt),
          limit: params.limit,
          offset,
          with: { contact: true, lines: true },
        });

        const safe = await Promise.all(templates.map(row => row.type === "invoice" ? getRecurringInvoice(ctx, row.id) : row));
        return { templates: safe, page: params.page, limit: params.limit };
      })
  );

  server.tool(
    "get_recurring_template",
    "Get a single recurring DOCUMENT template (invoice / bill / expense) by ID, including its contact and line items. Stored invoice unitPrice is in currency minor units with unitPriceMinor aliases (USD cents); other documents retain legacy cents and quantity is the decimal x 100. Journal templates are not returned here.",
    {
      templateId: z.string().describe("The UUID of the recurring template"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const found = await db.query.recurringTemplate.findFirst({
          where: and(
            eq(recurringTemplate.id, params.templateId),
            eq(recurringTemplate.organizationId, ctx.organizationId),
            notDeleted(recurringTemplate.deletedAt)
          ),
          with: { contact: true, lines: true },
        });
        if (!found || !(DOCUMENT_TYPES as readonly string[]).includes(found.type)) {
          throw new Error("Recurring template not found");
        }
        return { template: found.type === "invoice" ? await getRecurringInvoice(ctx, params.templateId) : found };
      })
  );

  server.tool(
    "create_recurring_template",
    "Create a recurring DOCUMENT template (invoice, bill, or expense) with line items and a schedule. The generator materialises one real document per due occurrence starting on startDate. A contactId is required (the customer for invoices, the supplier for bills/expenses). For invoices, unitPrice is a decimal-major number, unitPriceExact an exact decimal-major string, and unitPriceMinor a canonical currency-minor integer string (safe integers only); aliases must agree. Bills/expenses retain numeric major prices; quantity is a decimal (e.g. 1.5); discountPercent is in basis points (1000 = 10%). For type='invoice' you may set autoSend (post the invoice GL and email the customer each occurrence) and/or createAsApproved (post the GL and mark sent WITHOUT emailing); both default false (generate as draft). Returns the created template.",
    {
      name: z.string().min(1).describe("Template name"),
      type: z
        .enum(DOCUMENT_TYPES)
        .describe("Document type to generate: invoice, bill, or expense"),
      contactId: z
        .string()
        .min(1)
        .describe("Contact UUID (customer for invoices, supplier for bills/expenses); required"),
      frequency: z.enum(FREQUENCIES).describe("How often a document is generated"),
      startDate: z
        .string()
        .describe("First run date (YYYY-MM-DD); also the date of the first generated document"),
      endDate: z
        .string()
        .nullable()
        .optional()
        .describe("Optional last date (YYYY-MM-DD); null = run indefinitely"),
      maxOccurrences: z
        .number()
        .int()
        .min(1)
        .nullable()
        .optional()
        .describe("Optional cap on the number of documents generated; null = unlimited"),
      reference: z
        .string()
        .nullable()
        .optional()
        .describe("Optional reference stamped on each generated document"),
      notes: z.string().nullable().optional().describe("Optional notes"),
      currencyCode: z
        .string()
        .optional()
        .default("USD")
        .describe("Currency code (defaults to USD)"),
      rateExact: z.string().optional().describe("Unsupported template FX input; supplied values are rejected for invoices"),
      exchangeRate: z.number().optional().describe("Unsupported template FX millionths; supplied values are rejected for invoices"),
      rateDirection: z.string().optional().describe("Unsupported template FX direction; supplied values are rejected for invoices"),
      autoSend: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Invoice only: post the invoice GL (status -> sent) AND email the customer each occurrence"
        ),
      createAsApproved: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Invoice only: post the invoice GL and mark it sent WITHOUT emailing each occurrence"
        ),
      lines: z.array(recurringInvoiceLineSchema).min(1).max(1000).describe("Template lines; invoices support decimal-major unitPrice/unitPriceExact and currency-minor unitPriceMinor; bills/expenses retain numeric major prices"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:recurring");

        if (params.type === "invoice") {
          const input = Object.fromEntries(Object.entries(params).filter(([key]) => key !== "type"));
          return createRecurringInvoice(ctx, input, undefined, "recurring_template");
        }
        if (params.lines.some(line => line.unitPriceExact !== undefined || line.unitPriceMinor !== undefined))
          throw new WireCompatibilityError("Exact recurring bill/expense prices are not supported by this contract yet");

        const [created] = await db
          .insert(recurringTemplate)
          .values({
            organizationId: ctx.organizationId,
            name: params.name,
            type: params.type,
            contactId: params.contactId,
            frequency: params.frequency,
            startDate: params.startDate,
            endDate: params.endDate || null,
            nextRunDate: params.startDate,
            maxOccurrences: params.maxOccurrences || null,
            reference: params.reference || null,
            notes: params.notes || null,
            currencyCode: params.currencyCode ?? "USD",
            autoSend: params.autoSend,
            createAsApproved: params.createAsApproved,
            createdBy: ctx.userId,
          })
          .returning();

        await db.insert(recurringTemplateLine).values(
          params.lines.map((l, i) => ({
            templateId: created.id,
            description: l.description,
            quantity: Math.round(l.quantity * 100),
            unitPrice: Math.round((l.unitPrice ?? 0) * 100),
            accountId: l.accountId || null,
            taxRateId: l.taxRateId || null,
            discountPercent: l.discountPercent ?? 0,
            sortOrder: i,
          }))
        );

        logAudit({
          ctx,
          action: "create",
          entityType: "recurring_template",
          entityId: created.id,
        });

        return { template: created };
      })
  );

  server.tool(
    "update_recurring_template",
    "Update a recurring DOCUMENT template's header fields (name, frequency, status, endDate, maxOccurrences, reference, notes, currencyCode, and the invoice-only autoSend / createAsApproved automation flags). Mirrors the PATCH route: line items are NOT edited here. Only provided fields change. Returns the updated template.",
    {
      templateId: z.string().describe("The UUID of the recurring template to update"),
      name: z.string().min(1).optional().describe("New template name"),
      frequency: z
        .enum(FREQUENCIES)
        .optional()
        .describe("New schedule frequency"),
      status: z
        .enum(["active", "paused", "completed"])
        .optional()
        .describe("New status: active (running), paused (skipped), or completed (stopped)"),
      endDate: z
        .string()
        .nullable()
        .optional()
        .describe("New last date (YYYY-MM-DD); null = run indefinitely"),
      maxOccurrences: z
        .number()
        .int()
        .min(1)
        .nullable()
        .optional()
        .describe("New cap on documents generated; null = unlimited"),
      reference: z.string().nullable().optional().describe("New reference"),
      notes: z.string().nullable().optional().describe("New notes"),
      currencyCode: z.string().optional().describe("New currency code"),
      rateExact: z.string().optional().describe("Unsupported template FX input; supplied values are rejected for invoices"),
      exchangeRate: z.number().optional().describe("Unsupported template FX millionths; supplied values are rejected for invoices"),
      rateDirection: z.string().optional().describe("Unsupported template FX direction; supplied values are rejected for invoices"),
      autoSend: z
        .boolean()
        .optional()
        .describe("Invoice only: post GL and email the customer each occurrence"),
      createAsApproved: z
        .boolean()
        .optional()
        .describe("Invoice only: post GL and mark sent WITHOUT emailing each occurrence"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:recurring");

        const existing = await db.query.recurringTemplate.findFirst({
          where: and(
            eq(recurringTemplate.id, params.templateId),
            eq(recurringTemplate.organizationId, ctx.organizationId),
            notDeleted(recurringTemplate.deletedAt)
          ),
        });
        if (!existing || !(DOCUMENT_TYPES as readonly string[]).includes(existing.type)) {
          throw new Error("Recurring template not found");
        }

        if (existing.type === "invoice") {
          const { templateId, ...input } = params;
          return changeRecurringInvoice(ctx, templateId, input, undefined, "update", "recurring_template");
        }

        // Only the header fields the PATCH route allows; undefined fields are
        // omitted so they aren't overwritten to null.
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (params.name !== undefined) updates.name = params.name;
        if (params.frequency !== undefined) updates.frequency = params.frequency;
        if (params.status !== undefined) updates.status = params.status;
        if (params.endDate !== undefined) updates.endDate = params.endDate;
        if (params.maxOccurrences !== undefined) updates.maxOccurrences = params.maxOccurrences;
        if (params.reference !== undefined) updates.reference = params.reference;
        if (params.notes !== undefined) updates.notes = params.notes;
        if (params.currencyCode !== undefined) updates.currencyCode = params.currencyCode;
        if (params.autoSend !== undefined) updates.autoSend = params.autoSend;
        if (params.createAsApproved !== undefined)
          updates.createAsApproved = params.createAsApproved;

        const [updated] = await db
          .update(recurringTemplate)
          .set(updates)
          .where(eq(recurringTemplate.id, params.templateId))
          .returning();

        logAudit({
          ctx,
          action: "update",
          entityType: "recurring_template",
          entityId: params.templateId,
          changes: updates,
        });

        return { template: updated };
      })
  );

  server.tool(
    "pause_recurring_template",
    "Toggle a recurring DOCUMENT template between active and paused (mirrors the /pause route). An active template becomes paused (the generator skips it); a paused template becomes active again (resuming catches up from the saved nextRunDate). Fails on a completed template. Returns the updated template.",
    {
      templateId: z.string().describe("The UUID of the recurring template to pause/resume"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:recurring");

        const existing = await db.query.recurringTemplate.findFirst({
          where: and(
            eq(recurringTemplate.id, params.templateId),
            eq(recurringTemplate.organizationId, ctx.organizationId),
            notDeleted(recurringTemplate.deletedAt)
          ),
        });
        if (!existing || !(DOCUMENT_TYPES as readonly string[]).includes(existing.type)) {
          throw new Error("Recurring template not found");
        }
        if (existing.type === "invoice") return changeRecurringInvoice(ctx, params.templateId, {}, undefined, "pause", "recurring_template");
        if (existing.status === "completed") {
          throw new Error("Cannot toggle a completed template");
        }

        const newStatus = existing.status === "active" ? "paused" : "active";

        const [updated] = await db
          .update(recurringTemplate)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(recurringTemplate.id, params.templateId))
          .returning();

        logAudit({
          ctx,
          action: "update",
          entityType: "recurring_template",
          entityId: params.templateId,
          changes: { status: newStatus },
        });

        return { template: updated };
      })
  );

  server.tool(
    "run_recurring_template",
    "Run the recurring-document generator for this organization now, generating real invoices/bills/expenses for every DUE occurrence of every active document template (catching up if a template is behind) and advancing each template's schedule. Use this to materialise a template whose nextRunDate has arrived. NOTE: the generator operates org-wide on due document templates (not journal templates) — it will not pull a future-dated template forward. Provide templateId to confirm the target document template exists and is active before running. Returns the number of documents generated.",
    {
      templateId: z
        .string()
        .describe(
          "The UUID of the recurring document template you intend to run (validated as an active document template before the generator runs)"
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:recurring");

        const found = await db.query.recurringTemplate.findFirst({
          where: and(
            eq(recurringTemplate.id, params.templateId),
            eq(recurringTemplate.organizationId, ctx.organizationId),
            notDeleted(recurringTemplate.deletedAt)
          ),
        });
        if (!found || !(DOCUMENT_TYPES as readonly string[]).includes(found.type)) {
          throw new Error("Recurring template not found");
        }
        if (found.type === "invoice") await getRecurringInvoice(ctx, params.templateId);
        if (found.status !== "active") {
          throw new Error("Only an active recurring template can be run");
        }

        // Reuse the exact route generator (handles GL posting, numbering, tax,
        // auto-send, and schedule advancement). It generates for every due
        // document template in the org, not just this one.
        const generated = await processRecurringDocuments(ctx.organizationId);

        logAudit({
          ctx,
          action: "run",
          entityType: "recurring_template",
          entityId: params.templateId,
          changes: { generated },
        });

        return { generated };
      })
  );
  server.tool("delete_recurring_invoice", "Soft-delete an organization-owned recurring invoice template; serialized with generation. Returns success.",
    { templateId: z.string().uuid().describe("Recurring invoice template UUID") },
    params => wrapTool(ctx, () => changeRecurringInvoice(ctx, params.templateId, {}, undefined, "delete")));
  server.tool("preview_recurring_invoice", "Preview upcoming recurring invoice dates and gross lineTotal in currency minor units with lineTotalMinor; before discounts and tax. Returns template and upcoming occurrences.",
    { templateId: z.string().uuid().describe("Recurring invoice template UUID"), count: z.number().int().min(1).max(12).default(5).describe("Upcoming occurrences to return, 1 through 12") },
    params => wrapTool(ctx, () => previewRecurringInvoice(ctx, params.templateId, params.count)));

}
