"use client";

import { usePresentation } from "@/i18n/provider";
import { portalStatusKey } from "@/i18n/public-portal-presentation";
import { useTranslations } from "next-intl";

import { portalPaymentsSchema } from "@/lib/money/public-ui";
import { clientJson } from "@/lib/api/client-response";

import { documentMoneyText as formatMoney } from "@/lib/documents/render-wire";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Payment {
  invoiceNumber: string;
  invoiceId: string;
  amountPaid: number;
  total: number;
  paidAt: string | null;
  status: string;
  currencyCode: string;
}


export default function PortalPaymentsPage() {
  const presentation = usePresentation();
  const t = useTranslations("PublicPortal");
  const { token } = useParams<{ token: string }>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(null); setPayments([]); } });
    fetch(`/api/v1/portal/${token}/payments`)
      .then(r => clientJson(r, "Unable to load payments"))
      .then(value => { const data = portalPaymentsSchema.parse(value); if (active) setPayments(data.data); })
      .catch(() => { if (active) setError(t("paymentLoadFailed")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, t]);

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><p className="text-sm text-gray-500">{t("loading")}</p></div>;
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("paymentHistory")}</h2>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoice")}</TableHead>
              <TableHead className="text-right">{t("invoiceTotal")}</TableHead>
              <TableHead className="text-right">{t("amountPaid")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("statusLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-8">
                  {t("noPayments")}
                </TableCell>
              </TableRow>
            ) : (
              payments.map(p => (
                <TableRow key={p.invoiceId}>
                  <TableCell className="text-sm font-medium">{p.invoiceNumber}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(p.total, p.currencyCode, presentation)}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatMoney(p.amountPaid, p.currencyCode, presentation)}</TableCell>
                  <TableCell className="text-sm">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"} className="text-xs">
                      {t(portalStatusKey(p.status))}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
