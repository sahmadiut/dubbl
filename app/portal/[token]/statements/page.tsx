"use client";

import { portalStatusKey } from "@/i18n/public-portal-presentation";
import { useTranslations } from "next-intl";

import { portalStatementSchema } from "@/lib/money/public-ui";
import { clientJson, clientPdf, downloadBlob } from "@/lib/api/client-response";

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
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface StatementLine {
  date: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  runningBalance: number;
  status: string;
}


export default function PortalStatementsPage() {
  const t = useTranslations("PublicPortal");
  const { token } = useParams<{ token: string }>();
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(null); setLines([]); } });
    fetch(`/api/v1/portal/${token}/statements`)
      .then(r => clientJson(r, "Unable to load statement"))
      .then(value => {
        const data = portalStatementSchema.parse(value);
        if (active) { setLines(data.lines); setTotalOutstanding(data.totalOutstanding); setCurrencyCode(data.currencyCode); }
      })
      .catch(() => { if (active) setError(t("statementLoadFailed")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, t]);

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><p className="text-sm text-gray-500">{t("loading")}</p></div>;
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("statement")}</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
            try {
              const blob = await clientPdf(await fetch(`/api/portal/${token}/statements/pdf?format=pdf`));
              downloadBlob(blob, "statement.pdf");
            } catch { setError(t("statementDownloadFailed")); }
          }}>
            <Download className="size-4" />{t("downloadStatement")}
          </Button>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t("outstanding")}</p>
            <p className="text-xl font-bold">{formatMoney(totalOutstanding, currencyCode)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead className="text-right">{t("paid")}</TableHead>
              <TableHead className="text-right">{t("balance")}</TableHead>
              <TableHead>{t("statusLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-8">
                  {t("noTransactions")}
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{line.date}</TableCell>
                  <TableCell className="text-sm">{line.description}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(line.amount, currencyCode)}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(line.paid, currencyCode)}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatMoney(line.balance, currencyCode)}</TableCell>
                  <TableCell>
                    <Badge variant={line.status === "paid" ? "default" : "secondary"} className="text-xs">
                      {t(portalStatusKey(line.status))}
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
