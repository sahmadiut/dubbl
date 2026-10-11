"use client";

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
        if (!response.ok) throw new Error("Could not load opening balances");
        const data = await response.json();
        if (!cancelled) { setEntry(data.entry ?? null); setError(null); }
      } catch {
        if (!cancelled) setError("Could not load opening balances");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    window.addEventListener("opening-balances-updated", load);
    return () => { cancelled = true; window.removeEventListener("opening-balances-updated", load); };
  }, [orgId]);

  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opening balances"
        description="Your account starting balances from when you began using the app."
      >
        <Button size="sm" onClick={() => openDrawer("openingBalance")}>
          <Plus className="mr-2 size-4" />
          {entry ? "Replace opening balances" : "Set opening balances"}
        </Button>
      </PageHeader>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Scale className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Opening balances are how much was in each account on the day you started
            using the app — for example money in the bank, unpaid customer invoices,
            or amounts you still owed. Set them once so your reports start from the
            right numbers.
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !entry ? (
        <div className="rounded-lg border p-10 text-center">
          <Scale className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No opening balances yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your account starting balances so your books begin from the right place.
          </p>
          <Button className="mt-4" size="sm" onClick={() => openDrawer("openingBalance")}>
            <Plus className="mr-2 size-4" />
            Set opening balances
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Starting from: {entry.date}
            </span>
          </div>

          <OpeningBalanceMoneyDetails lines={entry.lines} />
        </>
      )}
    </div>
  );
}
