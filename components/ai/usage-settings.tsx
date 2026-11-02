"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { UsageSettingsController, priceRate } from "@/lib/ai/usage-settings-client";
import { PriceVersionForm, BudgetForm } from "./usage-settings-forms";

export function AiUsageSettings() {
  const t = useTranslations("AiUsageSettings"), errors = useTranslations("AiManagementErrors");
  const { locale } = usePresentation();
  const [controller] = useState(() => new UsageSettingsController());
  const [state, setState] = useState(controller.state);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    const sync = () => controller.sync();
    window.addEventListener("storage", sync); window.addEventListener("focus", sync);
    controller.start();
    return () => { unsubscribe(); controller.dispose(); window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, [controller]);
  return <section className="mx-auto min-w-0 max-w-5xl space-y-6" dir={locale === "fa-IR" ? "rtl" : "ltr"} aria-label={t("title")}>
    <header className="space-y-2 border-b pb-4"><h2 className="text-xl font-semibold">{t("title")}</h2><p className="text-sm text-muted-foreground">{t("help")}</p><p className="text-sm text-muted-foreground">{t("numberHelp")}</p></header>
    <div key={state.organizationId} className="min-w-0 space-y-8">
      <section className="min-w-0 space-y-4" aria-label={t("prices")} aria-busy={state.prices.loading}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{t("prices")}</h3><Button type="button" variant="outline" disabled={state.prices.loading} onClick={() => void controller.refresh("prices")} className="h-auto min-h-11 max-w-full whitespace-normal">{t("reloadPrices")}</Button></div>
        {state.prices.loading && <p role="status">{t("loading")}</p>}{state.prices.error && <p role="alert">{errors(state.prices.error)}</p>}
        {state.prices.data && <>
          <p className="text-sm text-muted-foreground">{t("priceListHelp")}</p>
          {state.prices.data.prices.length === 0 && <p>{t("noPrices")}</p>}
          <ul className="grid min-w-0 gap-3">{state.prices.data.prices.map(price => <li key={price.id} className="min-w-0 space-y-2 break-words rounded-lg border p-3 text-sm">
            <p><bdi>{state.prices.data!.providers.find(p => p.id === price.providerId)?.name ?? t("unavailableProvider")}</bdi> · <bdi dir="ltr">{price.model}</bdi> · <bdi dir="ltr">{price.currency}</bdi></p>
            <p className="break-all">{t("priceVersion")} <bdi dir="ltr">{price.id}</bdi></p>
            <dl className="grid min-w-0 gap-2 sm:grid-cols-2">{(["input", "output", "cached", "reasoning"] as const).map(key => <div key={key} className="min-w-0"><dt>{t(`${key}PerMillion`)}</dt><dd className="break-all"><bdi dir="ltr">{priceRate(price[`${key}Rate`])}</bdi></dd></div>)}</dl>
            <p className="break-all">{t("source")}: <bdi dir="ltr">{price.source}</bdi> · <bdi dir="ltr">{price.evidenceDate}</bdi></p>
          </li>)}</ul>
          {!state.prices.data.providers.length && <p>{t("noProviders")}</p>}
          <PriceVersionForm providers={state.prices.data.providers} blocked={state.prices.loading || !!state.prices.error} readVersion={state.prices.readVersion} save={input => controller.createPrice(input)} />
        </>}
      </section>
      <section className="min-w-0 space-y-4" aria-label={t("budgets")} aria-busy={state.budgets.loading}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{t("budgets")}</h3><Button type="button" variant="outline" disabled={state.budgets.loading} onClick={() => void controller.refresh("budgets")} className="h-auto min-h-11 max-w-full whitespace-normal">{t("reloadBudgets")}</Button></div>
        <p className="text-sm text-muted-foreground">{t("bothBudgets")}</p><p className="text-sm text-muted-foreground">{t("zeroHelp")}</p>
        {state.budgets.loading && <p role="status">{t("loading")}</p>}{state.budgets.error && <p role="alert">{errors(state.budgets.error)}</p>}
        {state.budgets.data && <>
          {!state.budgets.data.budgets.length && <p>{t("noBudgets")}</p>}
          {state.budgets.data.budgets.map(b => <BudgetForm key={b.id} budget={b} members={state.budgets.data!.members} blocked={state.budgets.loading || !!state.budgets.error} readVersion={state.budgets.readVersion} save={input => controller.saveBudget(input)} />)}
          <BudgetForm members={state.budgets.data.members} blocked={state.budgets.loading || !!state.budgets.error} readVersion={state.budgets.readVersion} save={input => controller.saveBudget(input)} />
        </>}
      </section>
    </div>
  </section>;
}
