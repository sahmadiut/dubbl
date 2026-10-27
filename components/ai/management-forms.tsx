"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Provider, ProviderConfig, ToolPolicy, Model } from "@/lib/ai/admin-client";
import { REVIEWED_AI_TOOL_NAMES } from "@/lib/ai/tool-names";

type Save = (path: string, method: string, body?: unknown) => Promise<void>;
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span>{children}</label>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
const blankModel = (): Model => ({ id: "", contextTokens: 8192, outputTokens: 1024, functionCalls: false, strictSchemas: false, streaming: false, usage: false, evidenceDate: "" });

export function CatalogForm({ provider, busy, save }: { provider?: Provider; busy: boolean; save: Save }) {
  const t = useTranslations("AiManagement");
  const [models, setModels] = useState<Model[]>(provider?.models ?? [blankModel()]);
  const [enabled, setEnabled] = useState(provider?.enabled ?? false);
  function change(index: number, value: Partial<Model>) { setModels(models.map((m, i) => i === index ? { ...m, ...value } : m)); }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const values = new FormData(e.currentTarget);
    const configuration = { name: String(values.get("name")), adapter: "responses", endpoint: String(values.get("endpoint")), enabled, models, defaultModel: String(values.get("defaultModel")), timeoutMs: Number(values.get("timeoutMs")), delegatedOrganizations: String(values.get("organizations")).split(/[\s,]+/).filter(Boolean) };
    await save(provider ? `provider-catalog/${provider.id}` : "provider-catalog", provider ? "PATCH" : "POST", provider ? { expectedVersion: provider.version, configuration } : configuration);
  }
  return <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
    <fieldset disabled={busy} className="space-y-4">
      <legend className="mb-3 text-lg font-medium">{provider?.name ?? t("newProvider")}</legend>
      <Field label={t("name")}><Input name="name" required maxLength={80} pattern="[A-Za-z0-9 ._\-]+" defaultValue={provider?.name ?? ""} /></Field>
      <Field label={t("endpoint")}><Input dir="ltr" name="endpoint" type="url" required maxLength={300} defaultValue={provider?.endpoint ?? ""} /></Field>
      <p className="text-sm text-muted-foreground">{t("endpointHelp")}</p>
      <Field label={t("timeout")}><Input dir="ltr" name="timeoutMs" type="number" required min={100} max={120000} defaultValue={provider?.timeoutMs ?? 30000} /></Field>
      <Field label={t("organizations")}><Input dir="ltr" name="organizations" defaultValue={provider?.delegatedOrganizations?.join(", ") ?? ""} /></Field>
      <p className="text-sm text-muted-foreground">{t("delegationHelp")}</p>
      <Check label={t("enabled")} checked={enabled} onChange={setEnabled} />
      {models.map((model, index) => <fieldset key={index} className="space-y-3 rounded border p-3">
        <legend>{t("modelNumber", { number: index + 1 })}</legend>
        <Field label={t("modelId")}><Input dir="ltr" required maxLength={120} value={model.id} onChange={e => change(index, { id: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("contextTokens")}><Input type="number" required min={1} max={2000000} value={model.contextTokens} onChange={e => change(index, { contextTokens: Number(e.target.value) })} /></Field>
          <Field label={t("outputTokens")}><Input type="number" required min={16} max={100000} value={model.outputTokens} onChange={e => change(index, { outputTokens: Number(e.target.value) })} /></Field>
        </div>
        <Field label={t("evidenceDate")}><Input dir="ltr" type="date" required value={model.evidenceDate} onChange={e => change(index, { evidenceDate: e.target.value })} /></Field>
        {(["functionCalls", "strictSchemas", "streaming", "usage"] as const).map(key => <Check key={key} label={t(key)} checked={model[key]} onChange={value => change(index, { [key]: value })} />)}
        {models.length > 1 && <Button type="button" variant="outline" onClick={() => setModels(models.filter((_, i) => i !== index))}>{t("removeModel")}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={models.length >= 30} onClick={() => setModels([...models, blankModel()])}>{t("addModel")}</Button>
      <Field label={t("defaultModel")}><select name="defaultModel" required defaultValue={provider?.defaultModel ?? ""} className="rounded border bg-background p-2" dir="ltr"><option value="" disabled>{t("selectModel")}</option>{models.map((model, i) => <option key={i} value={model.id}>{model.id}</option>)}</select></Field>
      <Button type="submit">{t("saveProvider")}</Button>
    </fieldset>
  </form>;
}

export function ConfigForm({ provider, config, busy, save }: { provider?: Provider; config?: ProviderConfig; busy: boolean; save: Save }) {
  const t = useTranslations("AiManagement");
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [isDefault, setDefault] = useState(config?.isDefault ?? false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!provider) return;
    const values = new FormData(e.currentTarget);
    await save("provider-configs", "POST", { providerId: provider.id, ...(config ? { expectedVersion: config.version } : {}), configuration: { enabled, isDefault, model: String(values.get("model")), timeoutMs: Number(values.get("timeoutMs")) } });
  }
  async function rotate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, secret = String(new FormData(form).get("secret"));
    // Uncontrolled input: clear before dispatch, including network/validation errors.
    form.reset();
    if (config) await save(`provider-configs/${config.id}/credential`, "PUT", { expectedVersion: config.version, secret });
  }
  return <section className="space-y-4 rounded-lg border p-4">
    <h3 className="font-medium"><bdi>{provider?.name ?? t("withdrawnProvider")}</bdi></h3>
    {provider ? <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
      {!provider.enabled && <p>{t("providerDisabled")}</p>}
      <Field label={t("modelId")}><select dir="ltr" name="model" defaultValue={config?.model ?? provider.defaultModel} className="rounded border bg-background p-2">{!provider.models.some(m => m.id === config?.model) && config && <option value={config.model} disabled>{config.model}</option>}{provider.models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}</select></Field>
      <Field label={t("timeout")}><Input name="timeoutMs" type="number" min={100} max={provider.timeoutMs} required defaultValue={config?.timeoutMs ?? provider.timeoutMs} /></Field>
      <Check label={t("enabled")} checked={enabled} onChange={setEnabled} />
      <Check label={t("isDefault")} checked={isDefault} onChange={setDefault} />
      <Button type="submit">{t("saveConfiguration")}</Button>
    </fieldset></form> : <p>{t("delegationWithdrawn")}</p>}
    {config && <>
      <p>{t("credentialStatus", { status: config.credentialConfigured ? t("configured") : t("notConfigured") })}</p>
      {provider && <form onSubmit={rotate}><fieldset disabled={busy} className="space-y-3">
        <Field label={t("newCredential")}><Input name="secret" dir="ltr" type="password" required minLength={8} maxLength={4096} autoComplete="new-password" /></Field>
        <p className="text-sm text-muted-foreground">{t("credentialHelp")}</p>
        <Button type="submit">{t("rotateCredential")}</Button>
      </fieldset></form>}
      <div className="flex flex-wrap gap-3">
        {config.credentialConfigured && <Button disabled={busy} variant="destructive" type="button" onClick={() => save(`provider-configs/${config.id}/credential`, "DELETE", { expectedVersion: config.version })}>{t("revokeCredential")}</Button>}
        {provider && <Button disabled={busy || !config.enabled || !config.credentialConfigured || !provider.enabled} variant="outline" type="button" onClick={() => save(`provider-configs/${config.id}/test`, "POST")}>{t("testConnection")}</Button>}
      </div>
      <p className="text-sm text-muted-foreground">{t("testHelp")}</p>
    </>}
  </section>;
}

export function PolicyForm({ policy, busy, save, organization = false }: { policy?: ToolPolicy; busy: boolean; save: Save; organization?: boolean }) {
  const t = useTranslations("AiManagement");
  const toolsT = useTranslations("AiManagementTools");
  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  const [tools, setTools] = useState(policy?.allowedTools ?? []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await save("tool-policies", "PUT", { agentId: organization ? null : policy ? policy.subject.slice(6) : String(new FormData(e.currentTarget).get("agentId")), enabled, allowedTools: tools, ...(policy ? { expectedVersion: policy.version } : {}) });
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4"><fieldset disabled={busy} className="space-y-3">
    <legend className="font-medium">{organization ? t("organizationPolicy") : policy ? t("agentPolicy", { agent: policy.subject.slice(6) }) : t("newAgentPolicy")}</legend>
    {!organization && !policy && <Field label={t("agentId")}><Input name="agentId" dir="ltr" required pattern="[A-Za-z0-9_-]{1,64}" defaultValue="default" /></Field>}
    <Check label={t("enabled")} checked={enabled} onChange={setEnabled} />
    {REVIEWED_AI_TOOL_NAMES.map(name => <Check key={name} label={toolsT(name)} checked={tools.includes(name)} onChange={checked => setTools(checked ? [...tools, name] : tools.filter(n => n !== name))} />)}
    <Button type="submit">{t("savePolicy")}</Button>
  </fieldset></form>;
}
