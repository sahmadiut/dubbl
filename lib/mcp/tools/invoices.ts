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
import { invoice, invoiceSignature, emailConfig, organization } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import { sendEmail } from "@/lib/email/smtp-client";
import { randomBytes } from "crypto";
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

  server.tool(
    "request_invoice_signature",
    "Request an e-signature on an invoice. Sends a signing email to the signer with a unique link. Returns the created signature record.",
    {
      invoiceId: z.string().describe("The UUID of the invoice to request a signature for"),
      signerName: z.string().describe("Full name of the person who should sign"),
      signerEmail: z.string().email().describe("Email address of the signer"),
      expiresAt: z
        .string()
        .optional()
        .describe("Optional expiry date for the signing link (ISO 8601 datetime)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:invoices");

        const inv = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, params.invoiceId),
            eq(invoice.organizationId, ctx.organizationId),
            notDeleted(invoice.deletedAt)
          ),
        });

        if (!inv) throw new Error("Invoice not found");

        const token = randomBytes(32).toString("base64url");

        const [sig] = await db
          .insert(invoiceSignature)
          .values({
            invoiceId: params.invoiceId,
            token,
            signerName: params.signerName,
            signerEmail: params.signerEmail,
            expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
          })
          .returning();

        // Send signing email if email is configured
        const emailCfg = await db.query.emailConfig.findFirst({
          where: eq(emailConfig.organizationId, ctx.organizationId),
        });

        let emailSent = false;
        if (emailCfg) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const signUrl = `${baseUrl}/sign/${token}`;

          await sendEmail(emailCfg, {
            to: params.signerEmail,
            subject: `Signature requested - Invoice ${inv.invoiceNumber}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Signature Request</h2>
                <p>Hello ${params.signerName},</p>
                <p>You have been asked to sign invoice <strong>${inv.invoiceNumber}</strong>.</p>
                <p>
                  <a href="${signUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                    Review & Sign
                  </a>
                </p>
                ${params.expiresAt ? `<p style="color: #6b7280; font-size: 14px;">This link expires on ${new Date(params.expiresAt).toLocaleDateString()}.</p>` : ""}
                <p style="color: #6b7280; font-size: 14px;">If you did not expect this request, you can safely ignore this email.</p>
              </div>
            `,
          });
          emailSent = true;
        }

        return { signature: sig, emailSent };
      })
  );

  server.tool(
    "get_invoice_signature",
    "Get the e-signature status for an invoice. Returns all signature records associated with the invoice.",
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

        const signatures = await db.query.invoiceSignature.findMany({
          where: eq(invoiceSignature.invoiceId, params.invoiceId),
        });

        return { signatures };
      })
  );

  server.tool(
    "resend_signature_request",
    "Resend the signing email for a pending signature request on an invoice. Only resends if there is an active pending request.",
    {
      invoiceId: z.string().describe("The UUID of the invoice"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:invoices");

        const inv = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, params.invoiceId),
            eq(invoice.organizationId, ctx.organizationId),
            notDeleted(invoice.deletedAt)
          ),
        });

        if (!inv) throw new Error("Invoice not found");

        const sig = await db.query.invoiceSignature.findFirst({
          where: and(
            eq(invoiceSignature.invoiceId, params.invoiceId),
            eq(invoiceSignature.status, "pending")
          ),
        });

        if (!sig) throw new Error("No pending signature request found for this invoice");

        const emailCfg = await db.query.emailConfig.findFirst({
          where: eq(emailConfig.organizationId, ctx.organizationId),
        });

        if (!emailCfg) throw new Error("Email is not configured for this organization");

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const signUrl = `${baseUrl}/sign/${sig.token}`;

        await sendEmail(emailCfg, {
          to: sig.signerEmail,
          subject: `Reminder: Signature requested - Invoice ${inv.invoiceNumber}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Signature Reminder</h2>
              <p>Hello ${sig.signerName},</p>
              <p>This is a reminder that you have been asked to sign invoice <strong>${inv.invoiceNumber}</strong>.</p>
              <p>
                <a href="${signUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                  Review & Sign
                </a>
              </p>
              ${sig.expiresAt ? `<p style="color: #6b7280; font-size: 14px;">This link expires on ${new Date(sig.expiresAt).toLocaleDateString()}.</p>` : ""}
              <p style="color: #6b7280; font-size: 14px;">If you did not expect this request, you can safely ignore this email.</p>
            </div>
          `,
        });

        return { success: true, resentTo: sig.signerEmail };
      })
  );

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

  server.tool(
    "get_invoice_snapshot",
    "Get the frozen sender/recipient details for a finalized invoice. These are the org and contact details captured at send time. Returns null for draft invoices.",
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

        return {
          sender: inv.senderSnapshot || null,
          recipient: inv.recipientSnapshot || null,
        };
      })
  );

  server.tool(
    "update_invoice_snapshot",
    "Correct the sender or recipient details on a finalized invoice. Use this to fix typos or wrong addresses on sent/paid invoices. Only pass the fields you want to change. Cannot be used on draft invoices.",
    {
      invoiceId: z.string().describe("The UUID of the invoice"),
      sender: z.object({
        name: z.string().optional().describe("Organization name"),
        address: z.string().nullable().optional().describe("Organization address"),
        taxId: z.string().nullable().optional().describe("Tax ID / VAT number"),
        registrationNumber: z.string().nullable().optional().describe("Business registration number"),
        phone: z.string().nullable().optional().describe("Phone number"),
        email: z.string().nullable().optional().describe("Email address"),
        countryCode: z.string().nullable().optional().describe("Two-letter country code"),
      }).optional().describe("Sender (organization) fields to update"),
      recipient: z.object({
        name: z.string().optional().describe("Contact name"),
        email: z.string().nullable().optional().describe("Contact email"),
        address: z.string().nullable().optional().describe("Contact address"),
        taxNumber: z.string().nullable().optional().describe("Contact tax / VAT number"),
      }).optional().describe("Recipient (contact) fields to update"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:invoices");

        const inv = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, params.invoiceId),
            eq(invoice.organizationId, ctx.organizationId),
            notDeleted(invoice.deletedAt)
          ),
        });

        if (!inv) throw new Error("Invoice not found");
        if (inv.status === "draft") throw new Error("Draft invoices don't have snapshots, edit the invoice directly");

        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (params.sender) {
          const existing = (inv.senderSnapshot || {}) as Record<string, unknown>;
          updates.senderSnapshot = { ...existing, ...params.sender };
        }

        if (params.recipient) {
          const existing = (inv.recipientSnapshot || {}) as Record<string, unknown>;
          updates.recipientSnapshot = { ...existing, ...params.recipient };
        }

        const [updated] = await db
          .update(invoice)
          .set(updates)
          .where(eq(invoice.id, params.invoiceId))
          .returning();

        return {
          sender: updated.senderSnapshot,
          recipient: updated.recipientSnapshot,
        };
      })
  );

}
