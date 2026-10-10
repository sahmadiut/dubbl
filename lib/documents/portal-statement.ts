import { getPortalAccess } from "@/lib/api/public-portal";
import { getContactStatement } from "@/lib/api/contact-statements";
import { renderContactStatement } from "@/lib/api/contact-statement-delivery";
import type { AuthContext } from "@/lib/api/auth-context";
import { toPdf } from "@/lib/reports/statement-export";
import { statementSchema } from "@/lib/api/contact-statement-wire";
import { requireRole } from "@/lib/api/require-role";
import { renderFormat } from "./render-wire";

export async function renderPortalStatement(token: string, input: unknown, format: "html" | "pdf", ctx?: AuthContext) {
  if (ctx) requireRole(ctx, "view:data");
  renderFormat.parse(format);
  const params = statementSchema.parse(input);
  const access = await getPortalAccess(token, ctx?.organizationId, 404);
  // Capability grants only its owned contact; no caller-controlled org/contact ID.
  const result = await getContactStatement({ organizationId: access.organizationId, userId: "", role: "member", permissions: ["view:data"] }, access.contactId, params);
  const filename = `statement-${access.contactId}.${format}`;
  if (format === "html") return { format, filename, contentType: "text/html; charset=utf-8", data: result.data, content: renderContactStatement(result) };
  const d = result.data;
  const pdf = await toPdf({ title: `Statement - ${d.contact.name}`, periodLabel: `${result.organizationName} - ${d.startDate} to ${d.endDate}`,
    currency: d.currencyCode, columns: ["Debit", "Credit", "Balance"], sections: [{ label: "Transactions", rows: [
      { name: "Opening Balance", amounts: [0, 0, d.openingBalance], depth: 0, bold: true },
      ...d.transactions.map(t => ({ name: `${t.date} - ${t.type} ${t.documentNumber} - ${t.description}`, amounts: [t.debit, t.credit, t.balance], depth: 0 })),
    ], subtotals: [d.totalDebit, d.totalCredit, d.closingBalance] }] });
  return { format, filename, contentType: "application/pdf", data: d, content: Buffer.from(pdf).toString("base64") };
}
