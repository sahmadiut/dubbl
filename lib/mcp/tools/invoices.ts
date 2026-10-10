import { requestInvoiceSignature, getInvoiceSignatures, resendInvoiceSignature } from "@/lib/api/invoice-signatures";
import { signatureInvoiceId, signatureRequestFields } from "@/lib/api/invoice-signature-wire";
import { getInvoiceSnapshot, updateInvoiceSnapshot } from "@/lib/api/invoice-snapshots";
import { invoiceSnapshotId, invoiceSnapshotMcpSchema } from "@/lib/api/invoice-snapshot-wire";
import { payDocument } from "@/lib/api/payment-settlements";
import { paymentMcpPayFields } from "@/lib/api/payment-settlement-wire";
import { createInvoice, updateInvoice, deleteInvoice } from "@/lib/api/invoice-writes";
import { invoiceCreateFields, invoiceUpdateFields } from "@/lib/api/invoice-write-wire";
import { listInvoices, getInvoice, getInvoiceSummary } from "@/lib/api/invoice-reads";
import { invoiceListFields } from "@/lib/api/invoice-read-wire";
import { AuthError } from "@/lib/api/auth-context";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoice, organization } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { checkInvoiceCompliance } from "@/lib/documents/compliance";

export function registerInvoiceTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_invoices", {
    description: "List organization-scoped invoices. Numeric amounts retain integer minor units (USD cents); additive subtotalMinor/taxTotalMinor/totalMinor/amountPaidMinor/amountDueMinor strings and contact creditLimitMinor preserve stored units. Safe integer range only; mixed-currency pages keep per-invoice currencies.",
    inputSchema: z.strictObject(invoiceListFields),
  }, params => wrapTool(ctx, () => listInvoices(ctx, params)));

  server.registerTool("get_invoice", {
    description: "Get an organization-scoped invoice with contact and line items. Numeric money stays in stored minor units (USD cents), with *Minor strings on headers, unitPrice/amount/taxAmount and contact creditLimit. Quantities stay hundredths, discounts stay basis points. Returns {invoice}; payment history/base display remain REST-only. Unsafe history fails with 422.",
    inputSchema: z.strictObject({ invoiceId: z.string().uuid().describe("Organization-owned invoice UUID") }),
  }, params => wrapTool(ctx, async () => {
      const result = await getInvoice(ctx, params.invoiceId);
      if (!result) throw new AuthError("Invoice not found", 404);
      return result;
    }));

  server.registerTool("get_invoice_summary", {
    description: "Get invoice counts, outstanding/overdue totals and four aging buckets for this organization. Returns safe numeric minor units (USD cents) plus outstandingMinor/overdueMinor and aging amountMinor strings; currencyCode is null for no outstanding invoices. Rejects mixed-currency outstanding invoices and unsafe totals with 422. No FX conversion or writes.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => getInvoiceSummary(ctx)));

  server.registerTool("create_invoice", {
    description: "Create an organization-scoped invoice atomically. unitPrice is decimal major units (USD 12.50); unitPriceExact is an ASCII decimal string; unitPriceMinor is an integer currency minor-unit string. Aliases must agree; safe integer monetary range only. Quantity is decimal, discounts are basis points. Currency defaults USD; omitted prices default zero unless a price list is specified. Returns {invoice, creditLimitWarning} with numeric minor units and *Minor strings; checks roles, references, locks, plan limits, credit limits and optional approval.",
    inputSchema: z.strictObject(invoiceCreateFields),
  }, params => wrapTool(ctx, () => createInvoice(ctx, params, "mcp")));

  server.registerTool("update_invoice", {
    description: "Edit an organization-owned draft invoice atomically. Optional lines replace all lines; omitted prices become zero. unitPrice is decimal major units; unitPriceExact is decimal major text and unitPriceMinor integer currency minor text. Checks alias agreement, safe monetary range, references and old/new issue-date locks. Returns {invoice} with numeric minor-unit totals and *Minor strings; quantity is decimal and discounts basis points.",
    inputSchema: z.strictObject({ invoiceId: z.string().uuid().describe("Organization-owned draft invoice UUID"), ...invoiceUpdateFields }),
  }, params => wrapTool(ctx, () => updateInvoice(ctx, params.invoiceId, params)));

  server.registerTool("delete_invoice", {
    description: "Soft-delete an organization-owned draft invoice and remove its lines atomically. Checks manage:invoices, issue-date locks, safe history and reference ownership. Returns {success:true}; sent, paid and approval-pending invoices cannot be deleted.",
    inputSchema: z.strictObject({ invoiceId: z.string().uuid().describe("Organization-owned draft invoice UUID") }),
  }, params => wrapTool(ctx, () => deleteInvoice(ctx, params.invoiceId)));

  server.registerTool("pay_invoice", {
    description: "Settle an organization-owned recognized outstanding invoice with new cash. amount is a positive safe integer in document minor units (USD cents); amountMinor is a matching canonical string. Requires manage:payments, open payment date, valid bank and saved recognition FX. Atomically creates payment/allocation/GL cash/control/realised-FX/audit and updates paid/due/status. Date defaults today in UTC. Optional idempotencyKey safely retries. Returns {invoice,payment} with numeric money and *Minor aliases. Unsupported history or overpayment fails without mutation.",
    inputSchema: z.object({ invoiceId: z.string().uuid().describe("Organization-owned recognized outstanding invoice UUID"), ...paymentMcpPayFields }).strict(),
  }, params => wrapTool(ctx, () => {
      const { invoiceId, ...input } = params;
      return payDocument(ctx, "invoice", invoiceId, { ...input, date: input.date ?? new Date().toISOString().slice(0, 10) });
    })
  );

  server.registerTool("request_invoice_signature", {
    description: "Request a signature for an owned live invoice with manage:invoices. Text signer name/email and optional future ISO expiry only; no money input. Validates saved safe integer currency minor units and opaque snapshots before writing. Returns {signature,emailSent}; emailSent is false when SMTP is absent. Existing signatures remain immutable; unsupported history returns 422.",
    inputSchema: z.strictObject({ invoiceId: signatureInvoiceId, ...signatureRequestFields }),
  }, params => {
    const { invoiceId, ...input } = params;
    return wrapTool(ctx, () => requestInvoiceSignature(ctx, invoiceId, input));
  });

  server.registerTool("get_invoice_signature", {
    description: "List all signatures of an owned live invoice with view:data, newest requestedAt first. Returns {signatures}, including status, token and UTC timestamps. No monetary inputs/outputs. Saved invoice summary must be in supported safe minor-unit range; foreign/deleted invoices return 404.",
    inputSchema: z.strictObject({ invoiceId: signatureInvoiceId }),
  }, params => wrapTool(ctx, () => getInvoiceSignatures(ctx, params.invoiceId)));

  server.registerTool("resend_signature_request", {
    description: "Resend email for the newest active pending signature of an owned live invoice with manage:invoices. Expired/signed/declined requests are excluded. Returns {success,resentTo}; no pending request returns 404, missing SMTP returns 400, unsupported history returns 422 before delivery. No monetary input.",
    inputSchema: z.strictObject({ invoiceId: signatureInvoiceId }),
  }, params => wrapTool(ctx, () => resendInvoiceSignature(ctx, params.invoiceId)));

  server.tool(
    "check_invoice_compliance",
    "Check an invoice for compliance warnings based on the organization's country. Validates jurisdiction-specific requirements for EU (27 countries), UK, DE, FR, IN, SG, SA, JP, BR, AU, NZ, CA, and US. Returns an array of warnings with field, message, and severity (error/warning). Does not block invoice creation.",
    {
      invoiceId: z.string().describe("The UUID of the invoice to check"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const inv = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, params.invoiceId),
            eq(invoice.organizationId, ctx.organizationId),
            notDeleted(invoice.deletedAt)
          ),
          with: { lines: true, contact: true },
        });

        if (!inv) throw new Error("Invoice not found");

        const org = await db.query.organization.findFirst({
          where: eq(organization.id, ctx.organizationId),
        });

        const orgAddress = [org?.addressStreet, org?.addressCity, org?.addressState, org?.addressPostalCode, org?.addressCountry]
          .filter(Boolean)
          .join(", ");

        const contactAddresses = inv.contact?.addresses as Record<string, { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string }> | null;
        let contactAddress: string | null = null;
        let contactCountryCode: string | null = null;
        if (contactAddresses) {
          const billing = contactAddresses.billing || Object.values(contactAddresses)[0];
          if (billing) {
            contactAddress = [billing.line1, billing.line2, billing.city, billing.state, billing.postalCode, billing.country]
              .filter(Boolean)
              .join(", ");
            contactCountryCode = billing.country || null;
          }
        }

        const typedLines = (inv.lines || []).map((l) => ({
          description: l.description || null,
          quantity: l.quantity ?? null,
          unitPrice: l.unitPrice ?? null,
          taxAmount: l.taxAmount ?? null,
        }));

        const warnings = checkInvoiceCompliance(
          {
            name: org?.name || null,
            address: orgAddress || null,
            taxId: org?.taxId || null,
            countryCode: org?.countryCode || null,
            addressStreet: org?.addressStreet || null,
            addressCity: org?.addressCity || null,
            addressPostalCode: org?.addressPostalCode || null,
            addressCountry: org?.addressCountry || null,
            businessRegistrationNumber: org?.businessRegistrationNumber || null,
          },
          {
            name: inv.contact?.name || null,
            address: contactAddress,
            taxNumber: inv.contact?.taxNumber || null,
            countryCode: contactCountryCode,
          },
          {
            invoiceNumber: inv.invoiceNumber,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            currencyCode: inv.currencyCode,
            notes: inv.notes,
            lines: typedLines,
          }
        );

        return { warnings };
      })
  );

  server.tool(
    "get_invoice_pdf",
    "Get the download URL for an invoice PDF. Returns the URL path to download the generated PDF file.",
    {
      invoiceId: z.string().describe("The UUID of the invoice"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const inv = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, params.invoiceId),
            eq(invoice.organizationId, ctx.organizationId),
            notDeleted(invoice.deletedAt)
          ),
        });

        if (!inv) throw new Error("Invoice not found");

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return {
          downloadUrl: `${baseUrl}/api/v1/invoices/${params.invoiceId}/pdf?format=pdf`,
          invoiceNumber: inv.invoiceNumber,
        };
      })
  );

  server.registerTool("get_invoice_snapshot", {
    description: "Read the owned live invoice's frozen sender/recipient JSON with view:data. Returns {sender,recipient}, null when absent. Historical exact strings and safe numeric values retain their original units; no monetary alias is inferred. Unsafe historical numbers fail with 422 LEGACY_NUMERIC_RANGE.",
    inputSchema: z.strictObject({ invoiceId: invoiceSnapshotId }),
  }, params => wrapTool(ctx, () => getInvoiceSnapshot(ctx, params.invoiceId)));

  server.registerTool("update_invoice_snapshot", {
    description: "Correct text fields in an owned finalized invoice's sender/recipient snapshot with manage:invoices. Each supplied object must contain at least one allowed field. Signed invoices cannot change (409), drafts must be edited directly (400). Historical JSON, exact strings and units are preserved. Locked merges and audit commit atomically. Returns {sender,recipient}; unsafe saved numbers fail 422 before mutation. No monetary input.",
    inputSchema: invoiceSnapshotMcpSchema,
  }, params => {
    const { invoiceId, ...input } = params;
    return wrapTool(ctx, () => updateInvoiceSnapshot(ctx, invoiceId, input));
  });

}
