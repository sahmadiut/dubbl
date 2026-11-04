"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiAdminError, type Provider } from "@/lib/ai/admin-client";
import { priceSchema, budgetSchema } from "@/lib/ai/usage-input";
import {
  usageNumber,
  type PriceInput,
  type BudgetInput,
  type PriceVersion,
  type UsageBudget,
  type UsageMember,
} from "@/lib/ai/usage-settings-client";

const selectClass =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const priceFields = [
  "inputPerMillion",
  "outputPerMillion",
  "cachedPerMillion",
  "reasoningPerMillion",
] as const;

export const budgetFields = [
  "monthlyTokens",
  "monthlyCost",
  "runTokens",
  "runCost",
  "requestsPerMinute",
  "concurrency",
] as const;

const blankPrice = () => ({
  providerId: "",
  model: "",
  currency: "",
  inputPerMillion: "",
  outputPerMillion: "",
  cachedPerMillion: "",
  reasoningPerMillion: "",
  evidenceDate: "",
  source: "",
});

const blankBudget = () => ({
  scope: "organization",
  userId: "",
  currency: "",
  monthlyTokens: "",
  monthlyCost: "",
  runTokens: "",
  runCost: "",
  requestsPerMinute: "",
  concurrency: "",
});

function budgetDraft(b?: UsageBudget) {
  return b
    ? {
        scope: b.userId ? "member" : "organization",
        userId: b.userId ?? "",
        currency: b.currency,
        monthlyTokens: b.monthlyTokens,
        monthlyCost: b.monthlyCost,
        runTokens: b.runTokens,
        runCost: b.runCost,
        requestsPerMinute: String(b.requestsPerMinute),
        concurrency: String(b.concurrency),
      }
    : blankBudget();
}

type FieldErrors = Record<string, boolean>;

function Field({
  id,
  label,
  help,
  invalid,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("AiUsageSettings");
  return (
    <div className="min-w-0 space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {invalid && (
        <p
          id={`${id}-error`}
          className="text-xs font-medium text-destructive"
        >
          {t("invalidField")}
        </p>
      )}
    </div>
  );
}

function focusField(form: HTMLFormElement, name: string) {
  (form.elements.namedItem(name) as HTMLElement | null)?.focus();
}

const failure = (err: unknown) =>
  err instanceof AiAdminError ? err.key : "failed";

export function PriceVersionForm({
  providers,
  blocked,
  readVersion,
  save,
}: {
  providers: Provider[];
  blocked: boolean;
  readVersion: number;
  save: (input: PriceInput) => Promise<PriceVersion>;
}) {
  const t = useTranslations("AiUsageSettings");
  const errors = useTranslations("AiManagementErrors");
  const id = useId();
  const pending = useRef(false);

  const [draft, setDraft] = useState(blankPrice);
  const [invalid, setInvalid] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [reviewAfter, setReviewAfter] = useState(-1);

  const provider = providers.find((p) => p.id === draft.providerId);

  function change(key: keyof typeof draft, value: string) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key === "providerId" ? { model: "" } : {}),
    }));
    setInvalid((v) => ({ ...v, [key]: false }));
    setSaved(false);
  }

  const attrs = (name: keyof typeof draft, help = false) => ({
    id: `${id}-${name}`,
    name,
    value: draft[name],
    "aria-invalid": invalid[name] || undefined,
    "aria-describedby":
      [
        help ? `${id}-${name}-help` : "",
        invalid[name] ? `${id}-${name}-error` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    onChange: (e: { target: { value: string } }) =>
      change(
        name,
        name === "currency" ? e.target.value.toUpperCase() : e.target.value
      ),
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || blocked || saved || reviewAfter >= readVersion)
      return;
    const value: Record<string, unknown> = { ...draft };
    for (const key of priceFields) {
      try {
        value[key] = usageNumber(draft[key]);
      } catch {
        value[key] = "";
      }
    }
    const parsed = priceSchema.safeParse(value);
    const fields: FieldErrors = {};
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        fields[String(issue.path[0])] = true;
    if (!provider?.models.some((m) => m.id === draft.model))
      fields.model = true;
    setInvalid(fields);
    if (!parsed.success || Object.keys(fields).length) {
      setNotice(t("checkFields"));
      focusField(e.currentTarget, Object.keys(fields)[0]);
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      await save(parsed.data);
      setSaved(true);
      setNotice(t("priceSaved"));
    } catch (err) {
      const key = failure(err);
      setNotice(errors(key));
      if (key === "network" || key === "failed") setReviewAfter(readVersion);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
      aria-busy={busy}
    >
      <div className="space-y-1 border-b bg-muted/30 px-5 py-4 sm:px-6">
        <h3 className="text-base font-semibold tracking-tight">
          {t("newPrice")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("immutableHelp")}</p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">{t("newPrice")}</legend>

          <Field
            id={`${id}-providerId`}
            label={t("provider")}
            invalid={invalid.providerId}
          >
            <select {...attrs("providerId")} required className={selectClass}>
              <option value="">{t("selectProvider")}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id={`${id}-model`} label={t("model")} invalid={invalid.model}>
            <select
              {...attrs("model")}
              dir="ltr"
              required
              className={selectClass}
            >
              <option value="">{t("selectModel")}</option>
              {provider?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={`${id}-currency`}
            label={t("currency")}
            invalid={invalid.currency}
          >
            <Input
              {...attrs("currency")}
              dir="ltr"
              required
              maxLength={3}
              className="min-h-11 font-mono uppercase"
            />
          </Field>

          <Field
            id={`${id}-evidenceDate`}
            label={t("evidenceDate")}
            invalid={invalid.evidenceDate}
          >
            <Input
              {...attrs("evidenceDate")}
              dir="ltr"
              type="date"
              required
              className="min-h-11"
            />
          </Field>

          {priceFields.map((key) => (
            <Field
              key={key}
              id={`${id}-${key}`}
              label={t(key)}
              help={t("rateHelp")}
              invalid={invalid[key]}
            >
              <Input
                {...attrs(key, true)}
                dir="ltr"
                inputMode="decimal"
                required
                maxLength={40}
                className="min-h-11 font-mono"
              />
            </Field>
          ))}

          <div className="min-w-0 sm:col-span-2">
            <Field
              id={`${id}-source`}
              label={t("source")}
              help={t("sourceHelp")}
              invalid={invalid.source}
            >
              <Input
                {...attrs("source", true)}
                dir="ltr"
                required
                maxLength={240}
                className="min-h-11"
              />
            </Field>
          </div>
        </fieldset>

        {notice && (
          <p
            role={saved ? "status" : "alert"}
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              saved
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {notice}
          </p>
        )}

        {reviewAfter >= readVersion && (
          <p
            role="alert"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300"
          >
            {t("uncertainHelp")}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t bg-muted/20 px-5 py-3.5 sm:px-6">
        <Button
          type="submit"
          disabled={
            busy ||
            blocked ||
            !providers.length ||
            saved ||
            reviewAfter >= readVersion
          }
          className="h-auto min-h-11 max-w-full whitespace-normal"
        >
          {t(busy ? "saving" : "createPrice")}
        </Button>
      </div>
    </form>
  );
}

export function BudgetForm({
  budget,
  members,
  blocked,
  readVersion,
  save,
}: {
  budget?: UsageBudget;
  members: UsageMember[];
  blocked: boolean;
  readVersion: number;
  save: (input: BudgetInput) => Promise<UsageBudget>;
}) {
  const t = useTranslations("AiUsageSettings");
  const errors = useTranslations("AiManagementErrors");
  const id = useId();
  const pending = useRef(false);

  const [draft, setDraft] = useState(() => budgetDraft(budget));
  const [base, setBase] = useState(budget);
  const [invalid, setInvalid] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [reviewAfter, setReviewAfter] = useState(-1);

  const changed = !!budget && budget.version !== base?.version;
  const memberMissing =
    draft.scope === "member" &&
    !!draft.userId &&
    !members.some((m) => m.userId === draft.userId);
  const name = members.find((m) => m.userId === draft.userId);

  function change(key: keyof typeof draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setInvalid((v) => ({ ...v, [key]: false }));
    setSuccess(false);
  }

  const attrs = (key: keyof typeof draft) => ({
    id: `${id}-${key}`,
    name: key,
    value: draft[key],
    "aria-invalid": invalid[key] || undefined,
    "aria-describedby": invalid[key] ? `${id}-${key}-error` : undefined,
    onChange: (e: { target: { value: string } }) =>
      change(
        key,
        key === "currency" ? e.target.value.toUpperCase() : e.target.value
      ),
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      pending.current ||
      blocked ||
      changed ||
      memberMissing ||
      reviewAfter >= readVersion
    )
      return;
    const value: Record<string, unknown> = {
      userId: draft.scope === "member" ? draft.userId : null,
      currency: draft.currency,
      ...(base ? { expectedVersion: base.version } : {}),
    };
    for (const key of budgetFields) {
      try {
        const normalized = usageNumber(draft[key]);
        value[key] =
          key === "requestsPerMinute" || key === "concurrency"
            ? /^[0-9]{1,5}$/.test(normalized)
              ? Number(normalized)
              : NaN
            : normalized;
      } catch {
        value[key] = "";
      }
    }
    const parsed = budgetSchema.safeParse(value);
    const fields: FieldErrors = {};
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        fields[String(issue.path[0])] = true;
    setInvalid(fields);
    if (!parsed.success) {
      setNotice(t("checkFields"));
      focusField(e.currentTarget, Object.keys(fields)[0]);
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice(undefined);
    setSuccess(false);
    try {
      const saved = await save(parsed.data);
      if (budget) {
        setBase(saved);
        setDraft(budgetDraft(saved));
      } else {
        setDraft(blankBudget());
      }
      setSuccess(true);
      setNotice(t("budgetSaved"));
    } catch (err) {
      const key = failure(err);
      setNotice(errors(key));
      if (key === "network" || key === "failed") setReviewAfter(readVersion);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function adopt(keepEdits: boolean) {
    if (!budget) return;
    setBase(budget);
    if (!keepEdits) setDraft(budgetDraft(budget));
    setNotice(undefined);
    setInvalid({});
    setSuccess(false);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-4 sm:px-6">
        <h3 className="flex flex-wrap items-center gap-2 break-words text-base font-semibold tracking-tight">
          {budget ? (
            <>
              <span>
                {t(budget.userId ? "memberBudget" : "organizationBudget")}
              </span>
              {budget.userId && (
                <bdi className="rounded-md border bg-background px-2 py-0.5 text-sm font-medium">
                  {name?.userName || name?.userEmail || t("formerMember")}
                </bdi>
              )}
              <bdi
                dir="ltr"
                className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary"
              >
                {budget.currency}
              </bdi>
            </>
          ) : (
            t("newBudget")
          )}
        </h3>
        {base && (
          <p className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {t("editingVersion", { version: String(base.version) })}
          </p>
        )}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">{t("budgetLimits")}</legend>

          {!budget && (
            <Field id={`${id}-scope`} label={t("scope")}>
              <select {...attrs("scope")} className={selectClass}>
                <option value="organization">{t("organizationBudget")}</option>
                <option value="member">{t("memberBudget")}</option>
              </select>
            </Field>
          )}

          {draft.scope === "member" && (
            <Field
              id={`${id}-userId`}
              label={t("member")}
              invalid={invalid.userId}
            >
              <select
                {...attrs("userId")}
                disabled={!!budget}
                required
                className={selectClass}
              >
                <option value="">{t("selectMember")}</option>
                {memberMissing && (
                  <option value={draft.userId}>{t("formerMember")}</option>
                )}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userName || m.userEmail}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            id={`${id}-currency`}
            label={t("currency")}
            invalid={invalid.currency}
          >
            <Input
              {...attrs("currency")}
              dir="ltr"
              readOnly={!!budget}
              required
              maxLength={3}
              className="min-h-11 font-mono uppercase read-only:bg-muted/50"
            />
          </Field>

          {budgetFields.map((key) => (
            <Field
              key={key}
              id={`${id}-${key}`}
              label={t(key)}
              invalid={invalid[key]}
            >
              <Input
                {...attrs(key)}
                dir="ltr"
                inputMode={key.endsWith("Cost") ? "decimal" : "numeric"}
                required
                maxLength={40}
                className="min-h-11 font-mono"
              />
            </Field>
          ))}
        </fieldset>

        <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>{t("budgetUnits")}</p>
          <p>{t("loweringHelp")}</p>
        </div>

        {memberMissing && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {t("memberMissing")}
          </p>
        )}

        {changed && budget && (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p
              role="alert"
              className="text-sm font-semibold text-amber-800 dark:text-amber-300"
            >
              {t("newerVersion", { version: String(budget.version) })}
            </p>
            <details className="rounded-lg border bg-background/80 p-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                {t("reviewCurrent")}
              </summary>
              <dl className="mt-3 grid min-w-0 gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                {budgetFields.map((key) => (
                  <div
                    key={key}
                    className="flex min-w-0 flex-wrap justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5"
                  >
                    <dt className="text-muted-foreground">{t(key)}</dt>
                    <dd className="break-all font-mono font-semibold">
                      <bdi dir="ltr">{String(budget[key])}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="outline"
                disabled={busy || blocked}
                onClick={() => adopt(false)}
                className="h-auto min-h-11 max-w-full whitespace-normal bg-background"
              >
                {t("loadCurrent")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || blocked}
                onClick={() => adopt(true)}
                className="h-auto min-h-11 max-w-full whitespace-normal bg-background"
              >
                {t("reapplyEdits")}
              </Button>
            </div>
          </div>
        )}

        {notice && (
          <p
            role={success ? "status" : "alert"}
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              success
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {notice}
          </p>
        )}

        {reviewAfter >= readVersion && (
          <p
            role="alert"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300"
          >
            {t("uncertainHelp")}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t bg-muted/20 px-5 py-3.5 sm:px-6">
        <Button
          type="submit"
          disabled={
            busy ||
            blocked ||
            changed ||
            memberMissing ||
            reviewAfter >= readVersion
          }
          className="h-auto min-h-11 max-w-full whitespace-normal"
        >
          {t(busy ? "saving" : "saveBudget")}
        </Button>
      </div>
    </form>
  );
}