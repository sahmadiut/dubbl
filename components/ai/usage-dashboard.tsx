"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { formatInstant } from "@/i18n/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DashboardController, defaultFilters, attemptStates, runStates, type DashboardState, type Filters, type Report, type DashboardError } from "@/lib/ai/dashboard-client";

const control = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm";
const button = "h-auto min-h-11 max-w-full whitespace-normal";
const Exact = ({ children }: { children: ReactNode }) => <bdi dir="ltr" className="break-all">{children}</bdi>;

export function DashboardFilters({ state, apply, reset }: { state: DashboardState; apply: (f: Filters) => void; reset: () => void }) {
  const t = useTranslations("AiDashboard"), prefix = useId();
  const [draft, setDraft] = useState(state.filters);
  const field = (key: keyof Filters, type = "text") => <label className="grid min-w-0 gap-1" htmlFor={`${prefix}-${key}`}><span>{t(key)}</span><input id={`${prefix}-${key}`} type={type} dir="ltr" value={draft[key]} maxLength={key === "model" ? 120 : 80} className={control} onChange={e => setDraft(v => ({ ...v, [key]: e.target.value }))} /></label>;
  const select = (key: "state" | "runState", values: readonly (typeof attemptStates[number] | typeof runStates[number])[]) => <label className="grid min-w-0 gap-1" htmlFor={`${prefix}-${key}`}><span>{t(key)}</span><select id={`${prefix}-${key}`} className={control} value={draft[key]} onChange={e => setDraft(v => ({ ...v, [key]: e.target.value }))}><option value="">{t("all")}</option>{values.map(value => <option key={value} value={value}>{t(`state_${value}`)}</option>)}</select></label>;
  return <form className="space-y-4 rounded-lg border p-4" aria-label={t("filters")} onSubmit={e => { e.preventDefault(); apply(draft); }}>
    <p className="text-sm text-muted-foreground">{t("filterHelp")}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {field("from", "date")}{field("to", "date")}{state.scope === "site" && field("organizationId")}{state.scope !== "own" && field("userId")}
      {field("providerId")}{field("model")}{field("currency")}{field("priceId")}{select("state", attemptStates)}
      {state.scope !== "site" && <>{select("runState", runStates)}{field("quotaCurrency")}</>}
    </div>
    <p className="text-sm text-muted-foreground">{t("separateFilters")}</p>
    <div className="flex flex-wrap gap-3"><Button type="submit" className={button} disabled={state.busy}>{t("apply")}</Button><Button type="button" className={button} variant="outline" disabled={state.busy} onClick={() => { setDraft(defaultFilters()); reset(); }}>{t("reset")}</Button></div>
  </form>;
}

export function DashboardConfirmation({ kind, target, version, busy, confirm }: { kind: "stop" | "disable"; target: string; version: number; busy: boolean; confirm: () => void }) {
  const t = useTranslations("AiDashboard"), cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" className={button} variant="destructive" disabled={busy}>{t(kind)}</Button></DialogTrigger><DialogContent onOpenAutoFocus={e => { e.preventDefault(); cancel.current?.focus(); }}>
    <DialogTitle>{t(`${kind}Title`)}</DialogTitle><DialogDescription>{t(`${kind}Help`)}</DialogDescription>
    <p className="min-w-0 break-all"><Exact>{target}</Exact> · {t("version")} <Exact>{version}</Exact></p>
    <div className="flex flex-wrap gap-3"><DialogClose asChild><Button ref={cancel} type="button" className={button} variant="outline">{t("cancel")}</Button></DialogClose><Button type="button" className={button} variant="destructive" disabled={busy} onClick={() => { setOpen(false); confirm(); }}>{t(`${kind}Confirm`)}</Button></div>
  </DialogContent></Dialog>;
}

function Failure({ error }: { error?: DashboardError }) {
  const t = useTranslations("AiDashboard"), errors = useTranslations("AiManagementErrors");
  return error ? <p role="alert">{error === "tooLarge" ? t("tooLarge") : error === "invalid" || error === "conflict" || error === "network" || error === "failed" ? t(`error_${error}`) : errors(error)}</p> : null;
}
function Pager({ page, next, busy, change }: { page: number; next: boolean; busy: boolean; change: (page: number) => void }) {
  const t = useTranslations("AiDashboard");
  return <div className="flex flex-wrap items-center gap-3"><Button type="button" className={button} variant="outline" disabled={busy || page <= 1} onClick={() => change(page - 1)}>{t("previous")}</Button><span>{t("page")} <Exact>{page}</Exact></span><Button type="button" className={button} variant="outline" disabled={busy || !next} onClick={() => change(page + 1)}>{t("next")}</Button></div>;
}
function Metrics({ row }: { row: Report["totalsByCurrency"][number] }) {
  const t = useTranslations("AiDashboard");
  return <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{(["attempts", "chargedCost", "settledCost", "reservedCost", "unresolvedCost", "chargedTokens", "reservedAttempts", "inFlightAttempts", "unknownAttempts", "settledAttempts", "cancelledAttempts", "inputTokens", "outputTokens", "cachedTokens", "reasoningTokens", "unknownInputAttempts", "unknownOutputAttempts", "unknownCachedAttempts", "unknownReasoningAttempts"] as const).map(key => <div key={key} className="min-w-0"><dt className="text-sm text-muted-foreground">{t(key)}</dt><dd><Exact>{row[key] ?? t("unknown")}</Exact></dd></div>)}</dl>;
}

export function DashboardView({ state, controller }: { state: DashboardState; controller: DashboardController }) {
  const t = useTranslations("AiDashboard"), presentation = usePresentation();
  const { locale, timeZone } = presentation;
  const instant = (value: string | null) => value ? formatInstant(new Date(value), presentation, { dateStyle: "medium", timeStyle: "short" }) : t("unknown");
  const download = (data: Report) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "ai-usage.json"; link.click(); URL.revokeObjectURL(url);
  };
  const notice = state.notice;
  return <section className="mx-auto min-w-0 max-w-6xl space-y-6" dir={locale === "fa-IR" ? "rtl" : "ltr"} aria-label={t("title")}>
    <header className="space-y-2"><h1 className="text-2xl font-semibold">{t("title")}</h1><p>{t("help")}</p>{state.organizationId && <p className="min-w-0 break-all">{t("organizationId")}: <Exact>{state.organizationId}</Exact></p>}</header>
    <nav className="flex flex-wrap gap-3" aria-label={t("scope")}>
      {(state.scope === "site" ? ["site"] as const : ["own", "organization"] as const).map(scope => <Button key={scope} type="button" aria-pressed={state.scope === scope} className={button} variant={state.scope === scope ? "default" : "outline"} disabled={state.busy} onClick={() => controller.select(scope)}>{t(scope)}</Button>)}
    </nav>
    <div key={`${state.organizationId}-${state.generation}`} className="min-w-0 space-y-6">
      <DashboardFilters state={state} apply={f => void controller.apply(f)} reset={() => void controller.apply(defaultFilters())} />
      {notice && (notice === "stopped" || notice === "disabled" || notice === "exported" ? <p role="status">{t(notice)}</p> : <Failure error={notice} />)}
      <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" className={button} disabled={state.busy || state.report.loading} onClick={() => void controller.load()}>{t("reload")}</Button><Button type="button" className={button} disabled={state.busy || state.report.loading || !state.report.data} onClick={() => void controller.export(download)}>{t("export")}</Button></div>
      <section className="space-y-4" aria-label={t("report")} aria-busy={state.report.loading}>
        <h2 className="text-xl font-semibold">{t("report")}</h2><p className="text-sm text-muted-foreground">{t("estimateHelp")}</p><p className="text-sm text-muted-foreground">{t("priceHelp")}</p><p><Exact>{state.filters.from}</Exact> ≤ UTC &lt; <Exact>{state.filters.to}</Exact></p>
        {state.report.loading && <p role="status">{t("loading")}</p>}<Failure error={state.report.error} />
        {state.report.data && <>
          <p>{t("totalGroups")}: <Exact>{state.report.data.totalGroups}</Exact></p>
          {state.report.data.totalsByCurrency.map(row => <article key={row.currency} className="min-w-0 space-y-3 rounded-lg border p-4"><h3>{t("fullTotals")} · <Exact>{row.currency}</Exact></h3><Metrics row={row} /></article>)}
          {!state.report.data.groups.length && <p>{t("empty")}</p>}
          <ul className="min-w-0 space-y-4">{state.report.data.groups.map((row, index) => <li key={index} className="min-w-0 space-y-3 rounded-lg border p-4">
            <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">{(["organizationId", "userId", "providerId", "model", "currency", "priceId"] as const).map(key => row[key] && <div key={key} className="min-w-0"><dt>{t(key)}</dt><dd><Exact>{row[key]}</Exact></dd></div>)}</dl><Metrics row={row} />
          </li>)}</ul>
          <Pager page={state.report.data.page!} next={!!state.report.data.hasNextPage} busy={state.busy || state.report.loading} change={p => void controller.page(p)} />
          <p className="text-sm text-muted-foreground">{t("exportHelp")}</p>
        </>}
      </section>
      {state.scope !== "site" && <>
        <section className="min-w-0 space-y-4" aria-label={t("quota")} aria-busy={state.quota.loading}><h2 className="text-xl font-semibold">{t("quota")}</h2><p className="text-sm text-muted-foreground">{t("quotaHelp")}</p>
          {state.quota.loading && <p role="status">{t("loading")}</p>}<Failure error={state.quota.error} />
          {state.quota.data && <><p>{t("asOf")}: <bdi>{instant(state.quota.data.asOf)}</bdi> · <Exact>{timeZone}</Exact></p><p>{t("period")}: <Exact>{state.quota.data.from}</Exact></p><p>{t("resetAt")}: <bdi>{instant(state.quota.data.resetAt)}</bdi> · <Exact>{timeZone}</Exact> · <Exact>{state.quota.data.resetAt}</Exact></p>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">{state.quota.data.constraints.map(c => <article key={c.subject} className="min-w-0 space-y-3 rounded-lg border p-4"><h3>{t(c.subject === "member" ? "memberBudget" : "organizationBudget")}</h3><p>{t(`constraint_${c.status}`)}</p><ul>{c.reasons?.map(reason => <li key={reason}>{t(`reason_${reason}`)}</li>)}</ul>
              {c.status !== "BUDGET_MISSING" && <dl className="grid gap-2">{(["monthlyTokensLimit", "remainingMonthlyTokens", "monthlyCostLimit", "remainingMonthlyCost", "runTokensLimit", "runCostLimit", "concurrencyLimit", "remainingConcurrency", "requestsPerMinuteLimit", "remainingRequestsPerMinute"] as const).map(key => <div key={key}><dt className="text-sm text-muted-foreground">{t(key)}{key.includes("Cost") && <> · <Exact>{state.quota.data!.currency}</Exact></>}</dt><dd><Exact>{c[key]}</Exact></dd></div>)}</dl>}
            </article>)}</div></>}
        </section>
        <section className="min-w-0 space-y-4" aria-label={t("runs")} aria-busy={state.runs.loading}><h2 className="text-xl font-semibold">{t("runs")}</h2><p className="text-sm text-muted-foreground">{t("durationHelp")}</p>
          {state.runs.loading && <p role="status">{t("loading")}</p>}<Failure error={state.runs.error} />
          {state.runs.data && <><p>{t("totalRuns")}: <Exact>{state.runs.data.totalRuns}</Exact></p>
            <div className="space-y-2"><h3>{t("outcomes")}</h3><ul>{state.runs.data.outcomes.requests.map(r => <li key={r.state}>{t(`state_${r.state}`)}: <Exact>{r.count}</Exact> · {t("durationTotal")}: <Exact>{r.totalDurationMs ?? t("unknown")}</Exact> · {t("samples")}: <Exact>{r.durationSamples}</Exact></li>)}</ul><h3>{t("steps")}</h3><ul>{state.runs.data.outcomes.tools.map(r => <li key={r.state}>{t(`state_${r.state}`)}: <Exact>{r.count}</Exact></li>)}</ul></div>
            {!state.runs.data.rows.length && <p>{t("empty")}</p>}
            <div role="region" tabIndex={0} aria-label={t("runs")} className="max-w-full overflow-x-auto rounded-lg border"><table className="w-full text-start text-sm"><thead><tr>{(["runId", "state", "createdAt", "duration", "actions"] as const).map(k => <th key={k} className="p-3 text-start">{t(k)}</th>)}</tr></thead><tbody>{state.runs.data.rows.map(r => <tr key={r.id} className="border-t"><td className="min-w-40 break-all p-3"><Exact>{r.id}</Exact></td><td className="p-3">{r.cancelRequestedAt && !r.finishedAt ? t("stopping") : t(`state_${r.state}`)}</td><td className="p-3"><bdi>{instant(r.createdAt)}</bdi></td><td className="p-3"><Exact>{r.durationMs ?? t("unknown")}</Exact></td><td className="p-3"><Button type="button" variant="outline" className={button} disabled={state.busy || state.detail.loading} onClick={() => void controller.inspect(r.id)}>{t("inspect")}</Button></td></tr>)}</tbody></table></div>
            <Pager page={state.runs.data.page} next={state.runs.data.hasNextPage} busy={state.busy || state.runs.loading} change={p => void controller.runPage(p)} />
          </>}
          {state.detail.loading && <p role="status">{t("loading")}</p>}<Failure error={state.detail.error} />
          {state.detail.data && <article className="min-w-0 space-y-3 rounded-lg border p-4" aria-label={t("detail")}><h3>{t("detail")}</h3><p><Exact>{state.detail.data.run.id}</Exact> · {t("version")} <Exact>{state.detail.data.run.version}</Exact></p><p>{state.detail.data.reasonCode === "STOP_REQUESTED" && !state.detail.data.run.finishedAt ? t("stopping") : t(`state_${state.detail.data.run.state}`)}</p><p>{t("createdAt")}: <bdi>{instant(state.detail.data.run.createdAt)}</bdi></p><p>{t("startedAt")}: <bdi>{instant(state.detail.data.run.startedAt)}</bdi></p><p>{t("finishedAt")}: <bdi>{instant(state.detail.data.run.finishedAt)}</bdi></p><p>{t("duration")}: <Exact>{state.detail.data.run.durationMs ?? t("unknown")}</Exact></p><ul>{state.detail.data.outcomes.tools.map(r => <li key={r.state}>{t(`state_${r.state}`)}: <Exact>{r.count}</Exact></li>)}</ul>{state.detail.data.canStop && <DashboardConfirmation kind="stop" target={state.detail.data.run.id} version={state.detail.data.run.version} busy={state.busy} confirm={() => void controller.stop(state.detail.data!.run.id, state.detail.data!.run.version)} />}</article>}
        </section>
        {state.configs.data && <section className="space-y-4" aria-label={t("configurations")}><h2 className="text-xl font-semibold">{t("configurations")}</h2><p>{t("disableHelp")}</p>{!state.configs.data.length && <p>{t("empty")}</p>}{state.configs.data.map(c => <article key={c.id} className="min-w-0 space-y-3 rounded-lg border p-4"><p><Exact>{c.model}</Exact> · <Exact>{c.id}</Exact> · {t("version")} <Exact>{c.version}</Exact></p><p>{c.enabled ? t("enabled") : t("disabledConfig")}</p>{c.enabled && <DashboardConfirmation kind="disable" target={c.id} version={c.version} busy={state.busy} confirm={() => void controller.disable(c.id, c.version)} />}</article>)}</section>}
        {state.configs.error && state.configs.error !== "denied" && <Failure error={state.configs.error} />}
      </>}
    </div>
  </section>;
}

export function AiUsageDashboard({ site = false }: { site?: boolean }) {
  const [controller] = useState(() => new DashboardController(site));
  const [state, setState] = useState(controller.state);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState), sync = () => controller.sync();
    window.addEventListener("storage", sync); window.addEventListener("focus", sync); controller.start();
    return () => { unsubscribe(); controller.dispose(); window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, [controller]);
  return <DashboardView state={state} controller={controller} />;
}
