"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { X, BarChart3, Loader2, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { displayMoney, displayJson, contactStatementUi, type ContactStatementUi } from "@/lib/money/contact-dashboard-ui";
import { CurrencySelect } from "@/components/ui/currency-select";
import { DatePicker } from "@/components/ui/date-picker";
import { statementTypeKey } from "@/lib/i18n/contact-financial-presentation";
import { useContactContext, getOrgId } from "../layout";

export default function ContactStatementPage() {
  const t = useTranslations("ContactStatement");
  const { id } = useParams<{ id: string }>();
  const { contact } = useContactContext();

  const [statementData, setStatementData] = useState<ContactStatementUi | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementStartDate, setStatementStartDate] = useState("");
  const [statementEndDate, setStatementEndDate] = useState("");
  const [statementCurrency, setStatementCurrency] = useState("");
  const [sendingStatement, setSendingStatement] = useState(false);

  const formatMoney = (amount: bigint) => displayMoney(amount, statementData!.currencyCode);

  const fetchStatement = useCallback(async (signal: AbortSignal) => {
    const orgId = getOrgId();
    if (!orgId) return;

    setStatementLoading(true);
    setStatementData(null);
    try {
      const params = new URLSearchParams();
      if (statementStartDate) params.set("startDate", statementStartDate);
      if (statementEndDate) params.set("endDate", statementEndDate);
      if (statementCurrency) params.set("currencyCode", statementCurrency);

      const res = await fetch(`/api/v1/contacts/${id}/statement?${params}`, {
        headers: { "x-organization-id": orgId },
        signal,
      });
      const data = await displayJson(res, contactStatementUi);
      if (!signal.aborted) {
        setStatementData(data);
      }
    } catch {
      if (!signal.aborted) {
        setStatementData(null);
        toast.error(t("readFailed"));
      }
    } finally {
      if (!signal.aborted) setStatementLoading(false);
    }
  }, [id, statementStartDate, statementEndDate, statementCurrency, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatement(controller.signal);
    return () => controller.abort();
  }, [fetchStatement]);

  function applyStatementPreset(preset: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "this_quarter": {
        const q = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), q, 1);
        break;
      }
      case "last_quarter": {
        const q = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), q - 3, 1);
        end = new Date(now.getFullYear(), q, 0);
        break;
      }
      case "ytd":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "last_12":
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        return;
    }
    setStatementStartDate(start.toISOString().slice(0, 10));
    setStatementEndDate(end.toISOString().slice(0, 10));
  }

  function handleDownloadPdf() {
    const orgId = getOrgId();
    if (!orgId) return;
    const params = new URLSearchParams({ orgId });
    if (statementStartDate) params.set("startDate", statementStartDate);
    if (statementEndDate) params.set("endDate", statementEndDate);
    if (statementCurrency) params.set("currencyCode", statementCurrency);
    window.open(`/api/v1/contacts/${id}/statement/pdf?${params}`, "_blank");
  }

  async function handleEmailStatement() {
    const orgId = getOrgId();
    if (!orgId) return;

    setSendingStatement(true);
    try {
      const res = await fetch(`/api/v1/contacts/${id}/statement/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          startDate: statementStartDate || undefined,
          endDate: statementEndDate || undefined,
          currencyCode: statementCurrency || undefined,
        }),
      });

      if (!res.ok) throw new Error("Statement email failed");
      toast.success(t("emailed"));
    } catch {
      toast.error(t("emailFailed"));
    } finally {
      setSendingStatement(false);
    }
  }

  return (
    <ContentReveal key="statement">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select onValueChange={applyStatementPreset}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder={t("period")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
              <SelectItem value="last_month">{t("lastMonth")}</SelectItem>
              <SelectItem value="this_quarter">{t("thisQuarter")}</SelectItem>
              <SelectItem value="last_quarter">{t("lastQuarter")}</SelectItem>
              <SelectItem value="ytd">{t("ytd")}</SelectItem>
              <SelectItem value="last_12">{t("last12")}</SelectItem>
            </SelectContent>
          </Select>
          <DatePicker
            value={statementStartDate}
            onChange={setStatementStartDate}
            placeholder={t("from")}
            className="w-36 h-8 text-sm"
          />
          <DatePicker
            value={statementEndDate}
            onChange={setStatementEndDate}
            placeholder={t("to")}
            className="w-36 h-8 text-sm"
          />
          <CurrencySelect value={statementCurrency} onValueChange={setStatementCurrency} compact />
          {(statementStartDate || statementEndDate || statementCurrency) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setStatementStartDate("");
                setStatementEndDate("");
                setStatementCurrency("");
              }}
            >
              <X className="mr-1 size-3" />
              {t("clear")}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleDownloadPdf}
              disabled={statementLoading || !statementData}
            >
              <Download className="mr-1.5 size-3.5" />
              {t("pdf")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleEmailStatement}
              disabled={statementLoading || !statementData || sendingStatement || !contact.email}
              title={!contact.email ? t("noEmail") : undefined}
            >
              {sendingStatement ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 size-3.5" />
              )}
              {t("email")}
            </Button>
          </div>
        </div>

        {statementLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="brand-loader" aria-label={t("loading")}>
              <div className="brand-loader-circle brand-loader-circle-1" />
              <div className="brand-loader-circle brand-loader-circle-2" />
            </div>
          </div>
        )}

        {!statementLoading && statementData && (
          <ContentReveal key={`statement-${statementStartDate}-${statementEndDate}`}>
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground" title={t("openingHint")}>{t("opening")}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums font-mono">
                    {formatMoney(statementData.openingBalance)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground" title={t("chargedHint")}>{t("charged")}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums font-mono">
                    {formatMoney(statementData.totalDebit)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground" title={t("paidHint")}>{t("paid")}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums font-mono">
                    {formatMoney(statementData.totalCredit)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground" title={t("closingHint")}>{t("closing")}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums font-mono">
                    {formatMoney(statementData.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Transaction table */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t("date")}</th>
                      <th className="px-3 py-2 font-medium">{t("type")}</th>
                      <th className="px-3 py-2 font-medium">{t("reference")}</th>
                      <th className="px-3 py-2 font-medium">{t("description")}</th>
                      <th className="px-3 py-2 text-right font-medium" title={t("chargesHint")}>{t("charges")}</th>
                      <th className="px-3 py-2 text-right font-medium" title={t("paymentsHint")}>{t("payments")}</th>
                      <th className="px-3 py-2 text-right font-medium" title={t("balanceHint")}>{t("balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr className="border-b bg-muted/30">
                      <td colSpan={6} className="px-3 py-2 text-sm font-medium">
                        {t("opening")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm font-medium tabular-nums">
                        {formatMoney(statementData.openingBalance)}
                      </td>
                    </tr>

                    {statementData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          {t("emptyTransactions")}
                        </td>
                      </tr>
                    ) : (
                      statementData.transactions.map((tx, i) => (
                        <tr key={i} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(tx.date + "T00:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {t(statementTypeKey(tx.type))}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{tx.documentNumber}</td>
                          <td className="px-3 py-2 text-muted-foreground">{tx.description}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {tx.debit ? formatMoney(tx.debit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {tx.credit ? formatMoney(tx.credit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {formatMoney(tx.balance)}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Closing balance row */}
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="px-3 py-2 text-sm font-medium">
                        {t("closing")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm font-medium tabular-nums">
                        {formatMoney(statementData.closingBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </ContentReveal>
        )}

        {!statementLoading && !statementData && (
          <ContentReveal key="statement-empty">
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed">
              <BarChart3 className="mb-2 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t("emptyHint")}
              </p>
            </div>
          </ContentReveal>
        )}
      </div>
    </ContentReveal>
  );
}
