"use client";

import { usePresentation } from "@/i18n/provider";
import { portalStatusKey } from "@/i18n/public-portal-presentation";
import { useTranslations } from "next-intl";

import { portalInvoicesSchema } from "@/lib/money/public-ui";
import { clientJson, clientPdf, downloadBlob } from "@/lib/api/client-response";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FileText, Download, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IdentifierText } from "@/components/ui/bidi-text";
import { documentMoneyText as formatMoney } from "@/lib/documents/render-wire";
import Link from "next/link";

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountDue: number;
  currencyCode: string;
  // Per-invoice token for the public online-payment flow (/pay/{token}).
  // Present only when an online payment link has been generated for this
  // invoice (i.e. when online payment is available). When absent, the
  // "Pay now" button is hidden and we degrade to PDF-only.
  paymentLinkToken?: string | null;
}

// Statuses for which the invoice can still be paid online. Mirrors the
// payable check in /api/pay/[token]/checkout (rejects paid/void/draft).
const PAYABLE_STATUSES = new Set(["sent", "partial", "overdue"]);

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-500",
};

export default function PortalInvoicesPage() {
  const presentation = usePresentation();
  const t = useTranslations("PublicPortal");
  const { token } = useParams<{ token: string }>();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(null); setInvoices([]); } });
    fetch(`/api/portal/${token}/invoices`)
      .then(r => clientJson(r, "Unable to load invoices"))
      .then(value => { const data = portalInvoicesSchema.parse(value); if (active) setInvoices(data.data); })
      .catch(() => { if (active) setError(t("invoiceLoadFailed")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, t]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Link href={`/portal/${token}`} aria-label={t("overview")} className="shrink-0 text-gray-400 hover:text-gray-600">
            <ArrowLeft className="size-4 [&:dir(rtl)]:rotate-180" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{t("invoices")}</h1>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-3xl px-6 py-8 [overflow-wrap:anywhere]">
        {loading ? (
          <p className="text-sm text-gray-500">{t("loadingInvoices")}</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="size-8 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">{t("noInvoices")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900"><IdentifierText>{inv.invoiceNumber}</IdentifierText></p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.rich("issuedDue", { issueDate: inv.issueDate, dueDate: inv.dueDate, code: chunks => <IdentifierText>{chunks}</IdentifierText> })}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <Badge variant="outline" className={`max-w-full whitespace-normal [overflow-wrap:anywhere] ${statusColors[inv.status] || ""}`}>
                    {t(portalStatusKey(inv.status))}
                  </Badge>
                  <span className="text-sm font-mono tabular-nums font-medium text-gray-900">
                    <IdentifierText>{formatMoney(inv.total, inv.currencyCode, presentation)}</IdentifierText>
                  </span>
                  <Button variant="outline" size="sm" className="h-auto min-h-7 min-w-0 whitespace-normal [overflow-wrap:anywhere] py-1 text-xs gap-1" onClick={async () => {
                    try {
                      const blob = await clientPdf(await fetch(`/api/portal/${token}/invoices/${inv.id}/pdf`));
                      downloadBlob(blob, `${inv.invoiceNumber}.pdf`);
                    } catch { setError(t("invoiceDownloadFailed")); }
                  }}>
                    <Download className="size-3" />{t("pdf")}
                  </Button>
                  {PAYABLE_STATUSES.has(inv.status) && inv.paymentLinkToken && (
                    <a href={`/pay/${inv.paymentLinkToken}`}>
                      <Button size="sm" className="h-auto min-h-7 min-w-0 whitespace-normal [overflow-wrap:anywhere] py-1 text-xs gap-1">
                        <CreditCard className="size-3" />
                        {t("payNow")}
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
