import { statementMoneyText } from "@/lib/reports/statement-money";
import { getContactStatement } from "./contact-statements";
import { db } from "@/lib/db";
import { emailConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { sendEmail } from "@/lib/email/smtp-client";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }
const typeLabels: Record<string, string> = {
  invoice: "Invoice",
  credit_note: "Credit Note",
  payment: "Payment",
  bill: "Bill",
  debit_note: "Debit Note",
};


export function renderContactStatement(result: Awaited<ReturnType<typeof getContactStatement>>, email = false) {
  const { startDate, endDate, openingBalance, closingBalance, totalDebit, totalCredit, currencyCode } = result.data;
  const c = { ...result.data.contact, name: escapeHtml(result.data.contact.name), email: result.data.contact.email ? escapeHtml(result.data.contact.email) : null };
  const orgName = escapeHtml(result.organizationName);
  const transactions = result.data.transactions.map(t => ({ ...t, documentNumber: escapeHtml(t.documentNumber), description: escapeHtml(t.description) }));
  const now = new Date();
  const formatDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const fmtMoney = (minor: number) => statementMoneyText(minor, currencyCode);
  if (!email) {
    const transactionRows = transactions
      .map(
        (tx) => `
        <tr>
          <td>${formatDate(tx.date)}</td>
          <td>${typeLabels[tx.type] || tx.type}</td>
          <td>${tx.documentNumber}</td>
          <td>${tx.description}</td>
          <td class="amount">${tx.debit ? fmtMoney(tx.debit) : "-"}</td>
          <td class="amount">${tx.credit ? fmtMoney(tx.credit) : "-"}</td>
          <td class="amount">${fmtMoney(tx.balance)}</td>
        </tr>`
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Statement - ${c.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #111; padding: 40px; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #111; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header .org-name { font-size: 14px; color: #555; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .meta-block { }
    .meta-block dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 2px; }
    .meta-block dd { font-size: 13px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 8px 6px; border-bottom: 1px solid #ddd; font-weight: 500; }
    thead th.amount { text-align: right; }
    tbody td { padding: 7px 6px; border-bottom: 1px solid #eee; font-size: 11px; }
    tbody td.amount { text-align: right; font-variant-numeric: tabular-nums; font-family: "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; }
    .opening-row td, .closing-row td { font-weight: 600; background: #f9f9f9; }
    .summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; padding: 16px; background: #f5f5f5; border-radius: 6px; }
    .summary-item { }
    .summary-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
    .summary-item .value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 15mm; }
    }
    .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 16px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <div>
      <h1>Statement</h1>
      <div class="org-name">${orgName}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 600;">${c.name}</div>
      ${c.email ? `<div style="font-size: 11px; color: #888;">${c.email}</div>` : ""}
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <dl>
        <dt>Period</dt>
        <dd>${formatDate(startDate)} to ${formatDate(endDate)}</dd>
      </dl>
    </div>
    <div class="meta-block" style="text-align: right;">
      <dl>
        <dt>Generated</dt>
        <dd>${formatDate(now.toISOString().slice(0, 10))}</dd>
      </dl>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Reference</th>
        <th>Description</th>
        <th class="amount">Debit</th>
        <th class="amount">Credit</th>
        <th class="amount">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr class="opening-row">
        <td colspan="6">Opening Balance</td>
        <td class="amount">${fmtMoney(openingBalance)}</td>
      </tr>
      ${transactionRows}
      <tr class="closing-row">
        <td colspan="6">Closing Balance</td>
        <td class="amount">${fmtMoney(closingBalance)}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-item">
      <div class="label">Opening Balance</div>
      <div class="value">${fmtMoney(openingBalance)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Total Debited</div>
      <div class="value">${fmtMoney(totalDebit)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Total Credited</div>
      <div class="value">${fmtMoney(totalCredit)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Closing Balance</div>
      <div class="value">${fmtMoney(closingBalance)}</div>
    </div>
  </div>
</body>
</html>`;

    return html;
  }
  {
    const transactionRows = transactions
      .map(
        (tx) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${formatDate(tx.date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${typeLabels[tx.type] || tx.type}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${tx.documentNumber}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${tx.description}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:monospace;">${tx.debit ? fmtMoney(tx.debit) : "-"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:monospace;">${tx.credit ? fmtMoney(tx.credit) : "-"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:monospace;">${fmtMoney(tx.balance)}</td>
        </tr>`
      )
      .join("\n");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;padding:0;margin:0;">
  <div style="max-width:700px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 4px;">Statement</h1>
    <p style="font-size:13px;color:#666;margin:0 0 24px;">${orgName}</p>

    <table style="width:100%;margin-bottom:16px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;"><strong>${c.name}</strong></td>
        <td style="font-size:12px;text-align:right;color:#666;">
          ${formatDate(startDate)} to ${formatDate(endDate)}
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Date</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Type</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Ref</th>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Description</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Debit</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Credit</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;font-weight:500;border-bottom:1px solid #ddd;">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f9f9f9;">
          <td colspan="6" style="padding:8px;font-size:12px;font-weight:600;border-bottom:1px solid #eee;">Opening Balance</td>
          <td style="padding:8px;font-size:12px;font-weight:600;text-align:right;font-family:monospace;border-bottom:1px solid #eee;">${fmtMoney(openingBalance)}</td>
        </tr>
        ${transactionRows}
        <tr style="background:#f9f9f9;">
          <td colspan="6" style="padding:8px;font-size:12px;font-weight:600;border-bottom:1px solid #ddd;">Closing Balance</td>
          <td style="padding:8px;font-size:12px;font-weight:600;text-align:right;font-family:monospace;border-bottom:1px solid #ddd;">${fmtMoney(closingBalance)}</td>
        </tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;background:#f5f5f5;border-radius:6px;" cellpadding="12" cellspacing="0">
      <tr>
        <td style="text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;color:#888;">Opening</div>
          <div style="font-size:14px;font-weight:600;font-family:monospace;">${fmtMoney(openingBalance)}</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;color:#888;">Debited</div>
          <div style="font-size:14px;font-weight:600;font-family:monospace;">${fmtMoney(totalDebit)}</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;color:#888;">Credited</div>
          <div style="font-size:14px;font-weight:600;font-family:monospace;">${fmtMoney(totalCredit)}</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;color:#888;">Closing</div>
          <div style="font-size:14px;font-weight:600;font-family:monospace;">${fmtMoney(closingBalance)}</div>
        </td>
      </tr>
    </table>

    <p style="font-size:11px;color:#999;margin-top:24px;">
      This statement was generated on ${formatDate(now.toISOString().slice(0, 10))} by ${orgName}.
    </p>
  </div>
</body>
</html>`;

    return html;
  }
}

export async function sendContactStatement(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "manage:contacts");
  const result = await getContactStatement(ctx, id, input);
  const to = result.data.contact.email;
  if (!to) throw new AuthError("Contact does not have an email address", 400);
  const html = renderContactStatement(result, true);
  const config = await db.query.emailConfig.findFirst({ where: eq(emailConfig.organizationId, ctx.organizationId) });
  if (!config) throw new AuthError("Email not configured. Please set up SMTP settings first.", 400);
  await sendEmail(config, { to, subject: `Statement from ${result.organizationName} - ${result.data.startDate} to ${result.data.endDate}`, html });
  return { success: true };
}
