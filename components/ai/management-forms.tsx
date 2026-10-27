"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Provider,
  ProviderConfig,
  ToolPolicy,
  Model,
} from "@/lib/ai/admin-client";
import { REVIEWED_AI_TOOL_NAMES } from "@/lib/ai/tool-names";

type Save = (path: string, method: string, body?: unknown) => Promise<void>;

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        <span>{label}</span>
        {children}
      </label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground select-none">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-primary focus:ring-2 focus:ring-ring"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

const blankModel = (): Model => ({
  id: "",
  contextTokens: 8192,
  outputTokens: 1024,
  functionCalls: false,
  strictSchemas: false,
  streaming: false,
  usage: false,
  evidenceDate: "",
});

const MODEL_CAPABILITIES = [
  "functionCalls",
  "strictSchemas",
  "streaming",
  "usage",
] as const;

export function CatalogForm({
  provider,
  busy,
  save,
}: {
  provider?: Provider;
  busy: boolean;
  save: Save;
}) {
  const t = useTranslations("AiManagement");
  const [models, setModels] = useState<Model[]>(
    provider?.models ?? [blankModel()]
  );
  const [enabled, setEnabled] = useState(provider?.enabled ?? false);

  function change(index: number, value: Partial<Model>) {
    setModels(models.map((m, i) => (i === index ? { ...m, ...value } : m)));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const configuration = {
      name: String(values.get("name")),
      adapter: "responses",
      endpoint: String(values.get("endpoint")),
      enabled,
      models,
      defaultModel: String(values.get("defaultModel")),
      timeoutMs: Number(values.get("timeoutMs")),
      delegatedOrganizations: String(values.get("organizations"))
        .split(/[\s,]+/)
        .filter(Boolean),
    };

    await save(
      provider ? `provider-catalog/${provider.id}` : "provider-catalog",
      provider ? "PATCH" : "POST",
      provider
        ? { expectedVersion: provider.version, configuration }
        : configuration
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-card p-6 text-card-foreground shadow-xs"
    >
      <fieldset disabled={busy} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <legend className="text-lg font-semibold tracking-tight">
            {provider?.name ?? t("newProvider")}
          </legend>
          <Check label={t("enabled")} checked={enabled} onChange={setEnabled} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")}>
            <Input
              name="name"
              required
              maxLength={80}
              pattern="[A-Za-z0-9 ._\-]+"
              defaultValue={provider?.name ?? ""}
            />
          </Field>

          <Field label={t("timeout")}>
            <Input
              dir="ltr"
              name="timeoutMs"
              type="number"
              required
              min={100}
              max={120000}
              defaultValue={provider?.timeoutMs ?? 30000}
            />
          </Field>
        </div>

        <Field label={t("endpoint")} help={t("endpointHelp")}>
          <Input
            dir="ltr"
            name="endpoint"
            type="url"
            required
            maxLength={300}
            defaultValue={provider?.endpoint ?? ""}
          />
        </Field>

        <Field label={t("organizations")} help={t("delegationHelp")}>
          <Input
            dir="ltr"
            name="organizations"
            defaultValue={provider?.delegatedOrganizations?.join(", ") ?? ""}
          />
        </Field>

        {/* Models List */}
        <div className="space-y-4">
          {models.map((model, index) => (
            <fieldset
              key={index}
              className="space-y-4 rounded-lg border bg-muted/30 p-4"
            >
              <div className="flex items-center justify-between border-b pb-2.5">
                <legend className="text-sm font-semibold">
                  {t("modelNumber", { number: index + 1 })}
                </legend>
                {models.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setModels(models.filter((_, i) => i !== index))
                    }
                  >
                    {t("removeModel")}
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("modelId")}>
                  <Input
                    dir="ltr"
                    required
                    maxLength={120}
                    value={model.id}
                    onChange={(e) => change(index, { id: e.target.value })}
                  />
                </Field>

                <Field label={t("evidenceDate")}>
                  <Input
                    dir="ltr"
                    type="date"
                    required
                    value={model.evidenceDate}
                    onChange={(e) =>
                      change(index, { evidenceDate: e.target.value })
                    }
                  />
                </Field>

                <Field label={t("contextTokens")}>
                  <Input
                    type="number"
                    required
                    min={1}
                    max={2000000}
                    value={model.contextTokens}
                    onChange={(e) =>
                      change(index, { contextTokens: Number(e.target.value) })
                    }
                  />
                </Field>

                <Field label={t("outputTokens")}>
                  <Input
                    type="number"
                    required
                    min={16}
                    max={100000}
                    value={model.outputTokens}
                    onChange={(e) =>
                      change(index, { outputTokens: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                {MODEL_CAPABILITIES.map((key) => (
                  <Check
                    key={key}
                    label={t(key)}
                    checked={model[key]}
                    onChange={(value) => change(index, { [key]: value })}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          <Button
            type="button"
            variant="outline"
            disabled={models.length >= 30}
            onClick={() => setModels([...models, blankModel()])}
          >
            {t("addModel")}
          </Button>
        </div>

        {/* Footer & Submit */}
        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <Field label={t("defaultModel")}>
              <select
                name="defaultModel"
                required
                defaultValue={provider?.defaultModel ?? ""}
                className={selectClassName}
                dir="ltr"
              >
                <option value="" disabled>
                  {t("selectModel")}
                </option>
                {models.map((model, i) => (
                  <option key={i} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit">{t("saveProvider")}</Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ConfigForm({
  provider,
  config,
  busy,
  save,
}: {
  provider?: Provider;
  config?: ProviderConfig;
  busy: boolean;
  save: Save;
}) {
  const t = useTranslations("AiManagement");
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [isDefault, setDefault] = useState(config?.isDefault ?? false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!provider) return;
    const values = new FormData(e.currentTarget);
    await save("provider-configs", "POST", {
      providerId: provider.id,
      ...(config ? { expectedVersion: config.version } : {}),
      configuration: {
        enabled,
        isDefault,
        model: String(values.get("model")),
        timeoutMs: Number(values.get("timeoutMs")),
      },
    });
  }

  async function rotate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const secret = String(new FormData(form).get("secret"));
    // Uncontrolled input: clear before dispatch, including network/validation errors.
    form.reset();
    if (config) {
      await save(`provider-configs/${config.id}/credential`, "PUT", {
        expectedVersion: config.version,
        secret,
      });
    }
  }

  return (
    <section className="space-y-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <h3 className="text-lg font-semibold tracking-tight">
          <bdi>{provider?.name ?? t("withdrawnProvider")}</bdi>
        </h3>
        {config && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              config.credentialConfigured
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t("credentialStatus", {
              status: config.credentialConfigured
                ? t("configured")
                : t("notConfigured"),
            })}
          </span>
        )}
      </div>

      {provider ? (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            {!provider.enabled && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {t("providerDisabled")}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("modelId")}>
                <select
                  dir="ltr"
                  name="model"
                  defaultValue={config?.model ?? provider.defaultModel}
                  className={selectClassName}
                >
                  {!provider.models.some((m) => m.id === config?.model) &&
                    config && (
                      <option value={config.model} disabled>
                        {config.model}
                      </option>
                    )}
                  {provider.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("timeout")}>
                <Input
                  name="timeoutMs"
                  type="number"
                  min={100}
                  max={provider.timeoutMs}
                  required
                  defaultValue={config?.timeoutMs ?? provider.timeoutMs}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-6">
                <Check
                  label={t("enabled")}
                  checked={enabled}
                  onChange={setEnabled}
                />
                <Check
                  label={t("isDefault")}
                  checked={isDefault}
                  onChange={setDefault}
                />
              </div>
              <Button type="submit">{t("saveConfiguration")}</Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("delegationWithdrawn")}
        </p>
      )}

      {config && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          {provider && (
            <form onSubmit={rotate}>
              <fieldset disabled={busy} className="space-y-3">
                <Field label={t("newCredential")} help={t("credentialHelp")}>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      name="secret"
                      dir="ltr"
                      type="password"
                      required
                      minLength={8}
                      maxLength={4096}
                      autoComplete="new-password"
                      className="bg-background"
                    />
                    <Button type="submit" className="shrink-0">
                      {t("rotateCredential")}
                    </Button>
                  </div>
                </Field>
              </fieldset>
            </form>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">{t("testHelp")}</p>
            <div className="flex flex-wrap gap-2.5">
              {config.credentialConfigured && (
                <Button
                  disabled={busy}
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={() =>
                    save(`provider-configs/${config.id}/credential`, "DELETE", {
                      expectedVersion: config.version,
                    })
                  }
                >
                  {t("revokeCredential")}
                </Button>
              )}
              {provider && (
                <Button
                  disabled={
                    busy ||
                    !config.enabled ||
                    !config.credentialConfigured ||
                    !provider.enabled
                  }
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    save(`provider-configs/${config.id}/test`, "POST")
                  }
                >
                  {t("testConnection")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function PolicyForm({
  policy,
  busy,
  save,
  organization = false,
}: {
  policy?: ToolPolicy;
  busy: boolean;
  save: Save;
  organization?: boolean;
}) {
  const t = useTranslations("AiManagement");
  const toolsT = useTranslations("AiManagementTools");
  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  const [tools, setTools] = useState(policy?.allowedTools ?? []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await save("tool-policies", "PUT", {
      agentId: organization
        ? null
        : policy
          ? policy.subject.slice(6)
          : String(new FormData(e.currentTarget).get("agentId")),
      enabled,
      allowedTools: tools,
      ...(policy ? { expectedVersion: policy.version } : {}),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-card p-6 text-card-foreground shadow-xs"
    >
      <fieldset disabled={busy} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <legend className="text-base font-semibold tracking-tight">
            {organization
              ? t("organizationPolicy")
              : policy
                ? t("agentPolicy", { agent: policy.subject.slice(6) })
                : t("newAgentPolicy")}
          </legend>
          <Check label={t("enabled")} checked={enabled} onChange={setEnabled} />
        </div>

        {!organization && !policy && (
          <div className="max-w-sm">
            <Field label={t("agentId")}>
              <Input
                name="agentId"
                dir="ltr"
                required
                pattern="[A-Za-z0-9_-]{1,64}"
                defaultValue="default"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 md:grid-cols-3">
          {REVIEWED_AI_TOOL_NAMES.map((name) => (
            <Check
              key={name}
              label={toolsT(name)}
              checked={tools.includes(name)}
              onChange={(checked) =>
                setTools(
                  checked ? [...tools, name] : tools.filter((n) => n !== name)
                )
              }
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit">{t("savePolicy")}</Button>
        </div>
      </fieldset>
    </form>
  );
}