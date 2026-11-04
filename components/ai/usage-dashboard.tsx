"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { formatInstant } from "@/i18n/dates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DashboardController,
  defaultFilters,
  attemptStates,
  runStates,
  type DashboardState,
  type Filters,
  type Report,
  type DashboardError,
} from "@/lib/ai/dashboard-client";

const control =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const button = "h-auto min-h-11 max-w-full whitespace-normal";

const Exact = ({ children }: { children: ReactNode }) => (
  <bdi dir="ltr" className="break-all font-mono">
    {children}
  </bdi>
);

export function DashboardFilters({
  state,
  apply,
  reset,
}: {
  state: DashboardState;
  apply: (f: Filters) => void;
  reset: () => void;
}) {
  const t = useTranslations("AiDashboard");
  const prefix = useId();
  const [draft, setDraft] = useState(state.filters);

  const field = (key: keyof Filters, type = "text") => (
    <label
      className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground"
      htmlFor={`${prefix}-${key}`}
    >
      <span>{t(key)}</span>
      <input
        id={`${prefix}-${key}`}
        type={type}
        dir="ltr"
        value={draft[key]}
        maxLength={key === "model" ? 120 : 80}
        className={control}
        onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
      />
    </label>
  );

  const select = (
    key: "state" | "runState",
    values: readonly (
      | (typeof attemptStates)[number]
      | (typeof runStates)[number]
    )[]
  ) => (
    <label
      className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground"
      htmlFor={`${prefix}-${key}`}
    >
      <span>{t(key)}</span>
      <select
        id={`${prefix}-${key}`}
        className={control}
        value={draft[key]}
        onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
      >
        <option value="">{t("all")}</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {t(`state_${value}`)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
      aria-label={t("filters")}
      onSubmit={(e) => {
        e.preventDefault();
        apply(draft);
      }}
    >
      <div className="border-b bg-muted/30 px-5 py-3.5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("filterHelp")}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("from", "date")}
          {field("to", "date")}
          {state.scope === "site" && field("organizationId")}
          {state.scope !== "own" && field("userId")}
          {field("providerId")}
          {field("model")}
          {field("currency")}
          {field("priceId")}
          {select("state", attemptStates)}
          {state.scope !== "site" && (
            <>
              {select("runState", runStates)}
              {field("quotaCurrency")}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("separateFilters")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-5 py-3.5">
        <Button type="submit" className={button} disabled={state.busy}>
          {t("apply")}
        </Button>
        <Button
          type="button"
          className={button}
          variant="outline"
          disabled={state.busy}
          onClick={() => {
            setDraft(defaultFilters());
            reset();
          }}
        >
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}

export function DashboardConfirmation({
  kind,
  target,
  version,
  busy,
  confirm,
}: {
  kind: "stop" | "disable";
  target: string;
  version: number;
  busy: boolean;
  confirm: () => void;
}) {
  const t = useTranslations("AiDashboard");
  const cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className={button}
          variant="destructive"
          disabled={busy}
        >
          {t(kind)}
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancel.current?.focus();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <DialogTitle>{t(`${kind}Title`)}</DialogTitle>
          <DialogDescription>{t(`${kind}Help`)}</DialogDescription>
        </div>
        <p className="min-w-0 break-all rounded-lg border bg-muted/40 px-3.5 py-2.5 text-sm">
          <Exact>{target}</Exact> · {t("version")} <Exact>{version}</Exact>
        </p>
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <DialogClose asChild>
            <Button
              ref={cancel}
              type="button"
              className={button}
              variant="outline"
            >
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            className={button}
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              confirm();
            }}
          >
            {t(`${kind}Confirm`)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Failure({ error }: { error?: DashboardError }) {
  const t = useTranslations("AiDashboard");
  const errors = useTranslations("AiManagementErrors");
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {error === "tooLarge"
        ? t("tooLarge")
        : error === "invalid" ||
            error === "conflict" ||
            error === "network" ||
            error === "failed"
          ? t(`error_${error}`)
          : errors(error)}
    </p>
  ) : null;
}

function Pager({
  page,
  next,
  busy,
  change,
}: {
  page: number;
  next: boolean;
  busy: boolean;
  change: (page: number) => void;
}) {
  const t = useTranslations("AiDashboard");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-2.5">
      <Button
        type="button"
        className={button}
        variant="outline"
        disabled={busy || page <= 1}
        onClick={() => change(page - 1)}
      >
        {t("previous")}
      </Button>
      <span className="text-sm font-medium text-muted-foreground">
        {t("page")} <Exact>{page}</Exact>
      </span>
      <Button
        type="button"
        className={button}
        variant="outline"
        disabled={busy || !next}
        onClick={() => change(page + 1)}
      >
        {t("next")}
      </Button>
    </div>
  );
}

function Metrics({ row }: { row: Report["totalsByCurrency"][number] }) {
  const t = useTranslations("AiDashboard");
  return (
    <dl className="grid min-w-0 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {(
        [
          "attempts",
          "chargedCost",
          "settledCost",
          "reservedCost",
          "unresolvedCost",
          "chargedTokens",
          "reservedAttempts",
          "inFlightAttempts",
          "unknownAttempts",
          "settledAttempts",
          "cancelledAttempts",
          "inputTokens",
          "outputTokens",
          "cachedTokens",
          "reasoningTokens",
          "unknownInputAttempts",
          "unknownOutputAttempts",
          "unknownCachedAttempts",
          "unknownReasoningAttempts",
        ] as const
      ).map((key) => (
        <div
          key={key}
          className="min-w-0 space-y-1 rounded-lg border bg-muted/25 p-3"
        >
          <dt className="text-xs font-medium text-muted-foreground">
            {t(key)}
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            <Exact>{row[key] ?? t("unknown")}</Exact>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DashboardView({
  state,
  controller,
}: {
  state: DashboardState;
  controller: DashboardController;
}) {
  const t = useTranslations("AiDashboard");
  const presentation = usePresentation();
  const { locale, timeZone } = presentation;

  const instant = (value: string | null) =>
    value
      ? formatInstant(new Date(value), presentation, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("unknown");

  const download = (data: Report) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-usage.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const notice = state.notice;

  return (
    <section
      className="mx-auto min-w-0 max-w-6xl space-y-8 pb-12"
      dir={locale === "fa-IR" ? "rtl" : "ltr"}
      aria-label={t("title")}
    >
      {/* Dashboard Header */}
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
          {state.organizationId && (
            <p className="min-w-0 break-all pt-1 text-xs text-muted-foreground">
              {t("organizationId")}:{" "}
              <span className="rounded border bg-muted px-1.5 py-0.5 text-foreground">
                <Exact>{state.organizationId}</Exact>
              </span>
            </p>
          )}
        </div>

        <nav
          className="inline-flex flex-wrap gap-1.5 self-start rounded-xl border bg-muted/40 p-1.5 sm:self-auto"
          aria-label={t("scope")}
        >
          {(state.scope === "site"
            ? (["site"] as const)
            : (["own", "organization"] as const)
          ).map((scope) => (
            <Button
              key={scope}
              type="button"
              aria-pressed={state.scope === scope}
              className={button}
              variant={state.scope === scope ? "default" : "ghost"}
              disabled={state.busy}
              onClick={() => controller.select(scope)}
            >
              {t(scope)}
            </Button>
          ))}
        </nav>
      </header>

      <div
        key={`${state.organizationId}-${state.generation}`}
        className="min-w-0 space-y-8"
      >
        <DashboardFilters
          state={state}
          apply={(f) => void controller.apply(f)}
          reset={() => void controller.apply(defaultFilters())}
        />

        {notice &&
          (notice === "stopped" ||
          notice === "disabled" ||
          notice === "exported" ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            >
              {t(notice)}
            </p>
          ) : (
            <Failure error={notice} />
          ))}

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className={button}
            disabled={state.busy || state.report.loading}
            onClick={() => void controller.load()}
          >
            {t("reload")}
          </Button>
          <Button
            type="button"
            className={button}
            disabled={state.busy || state.report.loading || !state.report.data}
            onClick={() => void controller.export(download)}
          >
            {t("export")}
          </Button>
        </div>

        {/* Report Section */}
        <section
          className="space-y-5 rounded-2xl border bg-card p-6 shadow-2xs"
          aria-label={t("report")}
          aria-busy={state.report.loading}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">
                {t("report")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("estimateHelp")}
              </p>
              <p className="text-xs text-muted-foreground">{t("priceHelp")}</p>
            </div>
            <p className="rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium">
              <Exact>{state.filters.from}</Exact> ≤ UTC &lt;{" "}
              <Exact>{state.filters.to}</Exact>
            </p>
          </div>

          {state.report.loading && (
            <p
              role="status"
              className="py-8 text-center text-sm font-medium text-muted-foreground animate-pulse"
            >
              {t("loading")}
            </p>
          )}

          <Failure error={state.report.error} />

          {state.report.data && (
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm font-medium">
                {t("totalGroups")}: <Exact>{state.report.data.totalGroups}</Exact>
              </p>

              {state.report.data.totalsByCurrency.map((row) => (
                <article
                  key={row.currency}
                  className="min-w-0 space-y-4 rounded-xl border bg-muted/10 p-5"
                >
                  <h3 className="flex items-center gap-2 border-b pb-2.5 text-base font-semibold">
                    <span>{t("fullTotals")}</span>
                    <span>·</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                      <Exact>{row.currency}</Exact>
                    </span>
                  </h3>
                  <Metrics row={row} />
                </article>
              ))}

              {!state.report.data.groups.length && (
                <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              )}

              <ul className="min-w-0 space-y-4">
                {state.report.data.groups.map((row, index) => (
                  <li
                    key={index}
                    className="min-w-0 space-y-4 rounded-xl border bg-background p-5 shadow-2xs"
                  >
                    <dl className="grid min-w-0 gap-3 border-b pb-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          "organizationId",
                          "userId",
                          "providerId",
                          "model",
                          "currency",
                          "priceId",
                        ] as const
                      ).map(
                        (key) =>
                          row[key] && (
                            <div
                              key={key}
                              className="min-w-0 rounded-md bg-muted/40 px-3 py-2"
                            >
                              <dt className="text-xs text-muted-foreground">
                                {t(key)}
                              </dt>
                              <dd className="font-semibold text-foreground">
                                <Exact>{row[key]}</Exact>
                              </dd>
                            </div>
                          )
                      )}
                    </dl>
                    <Metrics row={row} />
                  </li>
                ))}
              </ul>

              <Pager
                page={state.report.data.page!}
                next={!!state.report.data.hasNextPage}
                busy={state.busy || state.report.loading}
                change={(p) => void controller.page(p)}
              />
              <p className="text-xs text-muted-foreground">{t("exportHelp")}</p>
            </div>
          )}
        </section>

        {state.scope !== "site" && (
          <>
            {/* Quota Section */}
            <section
              className="min-w-0 space-y-5 rounded-2xl border bg-card p-6 shadow-2xs"
              aria-label={t("quota")}
              aria-busy={state.quota.loading}
            >
              <div className="space-y-1 border-b pb-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t("quota")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("quotaHelp")}
                </p>
              </div>

              {state.quota.loading && (
                <p
                  role="status"
                  className="py-6 text-center text-sm font-medium text-muted-foreground animate-pulse"
                >
                  {t("loading")}
                </p>
              )}

              <Failure error={state.quota.error} />

              {state.quota.data && (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <p className="rounded-lg border bg-muted/30 px-3 py-2">
                      <span className="font-medium text-foreground">
                        {t("asOf")}:
                      </span>{" "}
                      <bdi>{instant(state.quota.data.asOf)}</bdi> ·{" "}
                      <Exact>{timeZone}</Exact>
                    </p>
                    <p className="rounded-lg border bg-muted/30 px-3 py-2">
                      <span className="font-medium text-foreground">
                        {t("period")}:
                      </span>{" "}
                      <Exact>{state.quota.data.from}</Exact>
                    </p>
                    <p className="rounded-lg border bg-muted/30 px-3 py-2">
                      <span className="font-medium text-foreground">
                        {t("resetAt")}:
                      </span>{" "}
                      <bdi>{instant(state.quota.data.resetAt)}</bdi> ·{" "}
                      <Exact>{timeZone}</Exact> ·{" "}
                      <Exact>{state.quota.data.resetAt}</Exact>
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                    {state.quota.data.constraints.map((c) => (
                      <article
                        key={c.subject}
                        className="min-w-0 space-y-4 rounded-xl border bg-background p-5 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                          <h3 className="font-semibold">
                            {t(
                              c.subject === "member"
                                ? "memberBudget"
                                : "organizationBudget"
                            )}
                          </h3>
                          <p className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {t(`constraint_${c.status}`)}
                          </p>
                        </div>

                        {c.reasons && c.reasons.length > 0 && (
                          <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-300">
                            {c.reasons.map((reason) => (
                              <li key={reason}>{t(`reason_${reason}`)}</li>
                            ))}
                          </ul>
                        )}

                        {c.status !== "BUDGET_MISSING" && (
                          <dl className="grid gap-2 sm:grid-cols-2">
                            {(
                              [
                                "monthlyTokensLimit",
                                "remainingMonthlyTokens",
                                "monthlyCostLimit",
                                "remainingMonthlyCost",
                                "runTokensLimit",
                                "runCostLimit",
                                "concurrencyLimit",
                                "remainingConcurrency",
                                "requestsPerMinuteLimit",
                                "remainingRequestsPerMinute",
                              ] as const
                            ).map((key) => (
                              <div
                                key={key}
                                className="rounded-lg border bg-muted/25 p-2.5"
                              >
                                <dt className="text-xs text-muted-foreground">
                                  {t(key)}
                                  {key.includes("Cost") && (
                                    <>
                                      {" "}
                                      · <Exact>{state.quota.data!.currency}</Exact>
                                    </>
                                  )}
                                </dt>
                                <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                  <Exact>{c[key]}</Exact>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Runs Section */}
            <section
              className="min-w-0 space-y-5 rounded-2xl border bg-card p-6 shadow-2xs"
              aria-label={t("runs")}
              aria-busy={state.runs.loading}
            >
              <div className="space-y-1 border-b pb-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t("runs")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("durationHelp")}
                </p>
              </div>

              {state.runs.loading && (
                <p
                  role="status"
                  className="py-6 text-center text-sm font-medium text-muted-foreground animate-pulse"
                >
                  {t("loading")}
                </p>
              )}

              <Failure error={state.runs.error} />

              {state.runs.data && (
                <div className="space-y-6">
                  <p className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm font-medium">
                    {t("totalRuns")}: <Exact>{state.runs.data.totalRuns}</Exact>
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
                      <h3 className="text-sm font-semibold">{t("outcomes")}</h3>
                      <ul className="space-y-1.5 text-xs">
                        {state.runs.data.outcomes.requests.map((r) => (
                          <li
                            key={r.state}
                            className="rounded-md border bg-background px-3 py-2"
                          >
                            <span className="font-medium">
                              {t(`state_${r.state}`)}:
                            </span>{" "}
                            <Exact>{r.count}</Exact> · {t("durationTotal")}:{" "}
                            <Exact>{r.totalDurationMs ?? t("unknown")}</Exact> ·{" "}
                            {t("samples")}: <Exact>{r.durationSamples}</Exact>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
                      <h3 className="text-sm font-semibold">{t("steps")}</h3>
                      <ul className="flex flex-wrap gap-2 text-xs">
                        {state.runs.data.outcomes.tools.map((r) => (
                          <li
                            key={r.state}
                            className="rounded-md border bg-background px-3 py-2"
                          >
                            <span className="font-medium">
                              {t(`state_${r.state}`)}:
                            </span>{" "}
                            <Exact>{r.count}</Exact>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {!state.runs.data.rows.length && (
                    <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                      {t("empty")}
                    </p>
                  )}

                  <div
                    role="region"
                    tabIndex={0}
                    aria-label={t("runs")}
                    className="max-w-full overflow-x-auto rounded-xl border shadow-2xs"
                  >
                    <table className="w-full text-start text-sm">
                      <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <tr>
                          {(
                            [
                              "runId",
                              "state",
                              "createdAt",
                              "duration",
                              "actions",
                            ] as const
                          ).map((k) => (
                            <th key={k} className="p-3.5 text-start">
                              {t(k)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {state.runs.data.rows.map((r) => (
                          <tr
                            key={r.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <td className="min-w-40 break-all p-3.5">
                              <Exact>{r.id}</Exact>
                            </td>
                            <td className="p-3.5">
                              <span className="inline-flex rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                                {r.cancelRequestedAt && !r.finishedAt
                                  ? t("stopping")
                                  : t(`state_${r.state}`)}
                              </span>
                            </td>
                            <td className="p-3.5 text-muted-foreground">
                              <bdi>{instant(r.createdAt)}</bdi>
                            </td>
                            <td className="p-3.5">
                              <Exact>{r.durationMs ?? t("unknown")}</Exact>
                            </td>
                            <td className="p-3.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={button}
                                disabled={state.busy || state.detail.loading}
                                onClick={() => void controller.inspect(r.id)}
                              >
                                {t("inspect")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pager
                    page={state.runs.data.page}
                    next={state.runs.data.hasNextPage}
                    busy={state.busy || state.runs.loading}
                    change={(p) => void controller.runPage(p)}
                  />
                </div>
              )}

              {state.detail.loading && (
                <p
                  role="status"
                  className="py-4 text-center text-sm font-medium text-muted-foreground animate-pulse"
                >
                  {t("loading")}
                </p>
              )}

              <Failure error={state.detail.error} />

              {state.detail.data && (
                <article
                  className="min-w-0 space-y-4 rounded-xl border bg-muted/20 p-5"
                  aria-label={t("detail")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <h3 className="text-base font-semibold">{t("detail")}</h3>
                    <p className="text-xs text-muted-foreground">
                      <Exact>{state.detail.data.run.id}</Exact> · {t("version")}{" "}
                      <Exact>{state.detail.data.run.version}</Exact>
                    </p>
                  </div>

                  <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-semibold">
                    {state.detail.data.reasonCode === "STOP_REQUESTED" &&
                    !state.detail.data.run.finishedAt
                      ? t("stopping")
                      : t(`state_${state.detail.data.run.state}`)}
                  </p>

                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <p className="rounded-lg border bg-background p-3">
                      <span className="block text-xs text-muted-foreground">
                        {t("createdAt")}:
                      </span>{" "}
                      <bdi className="font-medium">
                        {instant(state.detail.data.run.createdAt)}
                      </bdi>
                    </p>
                    <p className="rounded-lg border bg-background p-3">
                      <span className="block text-xs text-muted-foreground">
                        {t("startedAt")}:
                      </span>{" "}
                      <bdi className="font-medium">
                        {instant(state.detail.data.run.startedAt)}
                      </bdi>
                    </p>
                    <p className="rounded-lg border bg-background p-3">
                      <span className="block text-xs text-muted-foreground">
                        {t("finishedAt")}:
                      </span>{" "}
                      <bdi className="font-medium">
                        {instant(state.detail.data.run.finishedAt)}
                      </bdi>
                    </p>
                    <p className="rounded-lg border bg-background p-3">
                      <span className="block text-xs text-muted-foreground">
                        {t("duration")}:
                      </span>{" "}
                      <Exact>
                        {state.detail.data.run.durationMs ?? t("unknown")}
                      </Exact>
                    </p>
                  </div>

                  {state.detail.data.outcomes.tools.length > 0 && (
                    <ul className="flex flex-wrap gap-2 text-xs">
                      {state.detail.data.outcomes.tools.map((r) => (
                        <li
                          key={r.state}
                          className="rounded-md border bg-background px-2.5 py-1"
                        >
                          {t(`state_${r.state}`)}: <Exact>{r.count}</Exact>
                        </li>
                      ))}
                    </ul>
                  )}

                  {state.detail.data.canStop && (
                    <div className="border-t pt-3">
                      <DashboardConfirmation
                        kind="stop"
                        target={state.detail.data.run.id}
                        version={state.detail.data.run.version}
                        busy={state.busy}
                        confirm={() =>
                          void controller.stop(
                            state.detail.data!.run.id,
                            state.detail.data!.run.version
                          )
                        }
                      />
                    </div>
                  )}
                </article>
              )}
            </section>

            {/* Configurations Section */}
            {state.configs.data && (
              <section
                className="space-y-4 rounded-2xl border bg-card p-6 shadow-2xs"
                aria-label={t("configurations")}
              >
                <div className="space-y-1 border-b pb-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {t("configurations")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("disableHelp")}
                  </p>
                </div>

                {!state.configs.data.length && (
                  <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {state.configs.data.map((c) => (
                    <article
                      key={c.id}
                      className="min-w-0 flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 shadow-2xs"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          <Exact>{c.model}</Exact> · <Exact>{c.id}</Exact> ·{" "}
                          {t("version")} <Exact>{c.version}</Exact>
                        </p>
                        <p
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            c.enabled
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {c.enabled ? t("enabled") : t("disabledConfig")}
                        </p>
                      </div>

                      {c.enabled && (
                        <div className="border-t pt-3">
                          <DashboardConfirmation
                            kind="disable"
                            target={c.id}
                            version={c.version}
                            busy={state.busy}
                            confirm={() =>
                              void controller.disable(c.id, c.version)
                            }
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {state.configs.error && state.configs.error !== "denied" && (
              <Failure error={state.configs.error} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function AiUsageDashboard({ site = false }: { site?: boolean }) {
  const [controller] = useState(() => new DashboardController(site));
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

  return <DashboardView state={state} controller={controller} />;
}