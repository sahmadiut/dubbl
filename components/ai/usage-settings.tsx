"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import {
  UsageSettingsController,
  priceRate,
} from "@/lib/ai/usage-settings-client";
import { PriceVersionForm, BudgetForm } from "./usage-settings-forms";

export function AiUsageSettings() {
  const t = useTranslations("AiUsageSettings");
  const errors = useTranslations("AiManagementErrors");
  const { locale } = usePresentation();
  const [controller] = useState(() => new UsageSettingsController());
  const [state, setState] = useState(controller.state);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    const sync = () => controller.sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    controller.start();
    return () => {
      unsubscribe();
      controller.dispose();
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [controller]);

  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-8 pb-12"
      dir={locale === "fa-IR" ? "rtl" : "ltr"}
      aria-label={t("title")}
    >
      {/* Page Header */}
      <header className="space-y-3 rounded-2xl border bg-card p-6 shadow-2xs">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("help")}
        </p>
        <p className="rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {t("numberHelp")}
        </p>
      </header>

      <div key={state.organizationId} className="min-w-0 space-y-10">
        {/* Prices Section */}
        <section
          className="min-w-0 space-y-5"
          aria-label={t("prices")}
          aria-busy={state.prices.loading}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {t("prices")}
              </h3>
              {state.prices.data && (
                <p className="text-sm text-muted-foreground">
                  {t("priceListHelp")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={state.prices.loading}
              onClick={() => void controller.refresh("prices")}
              className="h-auto min-h-11 max-w-full whitespace-normal shadow-2xs"
            >
              {t("reloadPrices")}
            </Button>
          </div>

          {state.prices.loading && (
            <p
              role="status"
              className="rounded-xl border bg-card p-6 text-center text-sm font-medium text-muted-foreground animate-pulse"
            >
              {t("loading")}
            </p>
          )}

          {state.prices.error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {errors(state.prices.error)}
            </p>
          )}

          {state.prices.data && (
            <div className="space-y-6">
              {state.prices.data.prices.length === 0 && (
                <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {t("noPrices")}
                </p>
              )}

              <ul className="grid min-w-0 gap-4">
                {state.prices.data.prices.map((price) => (
                  <li
                    key={price.id}
                    className="min-w-0 space-y-4 break-words rounded-xl border bg-card p-5 text-sm shadow-2xs transition-colors hover:border-foreground/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        <bdi className="text-base">
                          {state.prices.data!.providers.find(
                            (p) => p.id === price.providerId
                          )?.name ?? t("unavailableProvider")}
                        </bdi>
                        <span className="text-muted-foreground">·</span>
                        <bdi
                          dir="ltr"
                          className="rounded-md border bg-muted/60 px-2 py-0.5 font-mono text-xs font-medium"
                        >
                          {price.model}
                        </bdi>
                        <span className="text-muted-foreground">·</span>
                        <bdi
                          dir="ltr"
                          className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary"
                        >
                          {price.currency}
                        </bdi>
                      </p>

                      <p className="break-all text-xs text-muted-foreground">
                        {t("priceVersion")}{" "}
                        <bdi
                          dir="ltr"
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground"
                        >
                          {price.id}
                        </bdi>
                      </p>
                    </div>

                    <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {(
                        ["input", "output", "cached", "reasoning"] as const
                      ).map((key) => (
                        <div
                          key={key}
                          className="min-w-0 space-y-1 rounded-lg border bg-muted/30 p-3"
                        >
                          <dt className="text-xs font-medium text-muted-foreground">
                            {t(`${key}PerMillion`)}
                          </dt>
                          <dd className="break-all font-mono text-sm font-semibold tabular-nums text-foreground">
                            <bdi dir="ltr">
                              {priceRate(price[`${key}Rate`])}
                            </bdi>
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <p className="break-all border-t pt-2.5 text-xs text-muted-foreground">
                      <span className="font-medium">{t("source")}:</span>{" "}
                      <bdi dir="ltr" className="text-foreground">
                        {price.source}
                      </bdi>{" "}
                      ·{" "}
                      <bdi dir="ltr" className="font-mono">
                        {price.evidenceDate}
                      </bdi>
                    </p>
                  </li>
                ))}
              </ul>

              {!state.prices.data.providers.length && (
                <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  {t("noProviders")}
                </p>
              )}

              <PriceVersionForm
                providers={state.prices.data.providers}
                blocked={state.prices.loading || !!state.prices.error}
                readVersion={state.prices.readVersion}
                save={(input) => controller.createPrice(input)}
              />
            </div>
          )}
        </section>

        {/* Budgets Section */}
        <section
          className="min-w-0 space-y-5"
          aria-label={t("budgets")}
          aria-busy={state.budgets.loading}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {t("budgets")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("bothBudgets")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={state.budgets.loading}
              onClick={() => void controller.refresh("budgets")}
              className="h-auto min-h-11 max-w-full whitespace-normal shadow-2xs"
            >
              {t("reloadBudgets")}
            </Button>
          </div>

          <p className="rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {t("zeroHelp")}
          </p>

          {state.budgets.loading && (
            <p
              role="status"
              className="rounded-xl border bg-card p-6 text-center text-sm font-medium text-muted-foreground animate-pulse"
            >
              {t("loading")}
            </p>
          )}

          {state.budgets.error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {errors(state.budgets.error)}
            </p>
          )}

          {state.budgets.data && (
            <div className="space-y-6">
              {!state.budgets.data.budgets.length && (
                <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {t("noBudgets")}
                </p>
              )}

              <div className="grid gap-6">
                {state.budgets.data.budgets.map((b) => (
                  <BudgetForm
                    key={b.id}
                    budget={b}
                    members={state.budgets.data!.members}
                    blocked={state.budgets.loading || !!state.budgets.error}
                    readVersion={state.budgets.readVersion}
                    save={(input) => controller.saveBudget(input)}
                  />
                ))}
              </div>

              <BudgetForm
                members={state.budgets.data.members}
                blocked={state.budgets.loading || !!state.budgets.error}
                readVersion={state.budgets.readVersion}
                save={(input) => controller.saveBudget(input)}
              />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}