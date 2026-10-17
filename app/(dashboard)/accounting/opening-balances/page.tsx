"use client";
import { useTranslations } from "next-intl";
import { requireJournalResponse, journalFailureMessage } from "@/i18n/journal-presentation";

import { useState, useEffect } from "react";
import { Scale, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { OpeningBalanceMoneyDetails } from "@/components/dashboard/opening-balance-money-details";
import type { OpeningBalanceSavedLine } from "@/lib/money/opening-balance-ui";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";

interface OpeningBalanceEntry {
  id: string;
  date: string;
  description: string;
  lines: OpeningBalanceSavedLine[];
}

export default function OpeningBalancesPage() {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const { open: openDrawer } = useCreateDrawer();
  const [entry, setEntry] = useState<OpeningBalanceEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/v1/opening-balances", { headers: { "x-organization-id": orgId } });
        await requireJournalResponse(response, errors, t("loadOpeningFailed"));
        const data = await response.json();
        if (!cancelled) { setEntry(data.entry ?? null); setError(null); }
      } catch (error) {
        if (!cancelled) setError(journalFailureMessage(error, t("loadOpeningFailed")));
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    window.addEventListener("opening-balances-updated", load);
    return () => { cancelled = true; window.removeEventListener("opening-balances-updated", load); };
  }, [orgId, t, errors]);

  if (loading) return <div className="space-y-6"><PageHeader title={t("loading")} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("openingTitle")}
        description={t("openingDescription")}
      >
        <Button size="sm" onClick={() => openDrawer("openingBalance")}>
          <Plus className="mr-2 size-4" />
          {entry ? t("replaceOpening") : t("setOpening")}
        </Button>
      </PageHeader>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Scale className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">{t("openingHint")}</p>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !entry ? (
        <div className="rounded-lg border p-10 text-center">
          <Scale className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{t("noOpening")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("firstOpeningHint")}</p>
          <Button className="mt-4" size="sm" onClick={() => openDrawer("openingBalance")}>
            <Plus className="mr-2 size-4" />{t("setOpening")}</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {t("startingFrom", { date: entry.date })}
            </span>
          </div>

          <OpeningBalanceMoneyDetails lines={entry.lines} />
        </>
      )}
    </div>
  );
}
