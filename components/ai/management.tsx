"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CatalogForm, ConfigForm, PolicyForm } from "./management-forms";
import { adminRequest, AiAdminError, providerDto, configDto, policyDto, type Provider, type ProviderConfig, type ToolPolicy, type AdminErrorKey } from "@/lib/ai/admin-client";

type Section<T> = { data?: T; error?: AdminErrorKey };
type ManagementState = { providers: Section<Provider[]>; configs: Section<ProviderConfig[]>; policies: Section<ToolPolicy[]> };
const empty = (): ManagementState => ({ providers: {}, configs: {}, policies: {} });
export function AiManagement({ platform = false }: { platform?: boolean }) {
  const t = useTranslations("AiManagement");
  const errors = useTranslations("AiManagementErrors");
  const [state, setState] = useState<ManagementState>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: AdminErrorKey; success?: "saved" | "connected" }>({});
  const [generation, setGeneration] = useState(0);
  const organization = useRef("");
  const pending = useRef(false);
  const errorKey = (err: unknown): AdminErrorKey => err instanceof AiAdminError ? err.key : "failed";
  const load = useCallback(async () => {
    const org = localStorage.getItem("activeOrgId") ?? "";
    organization.current = org;
    setLoading(true); setState(empty());
    async function read<T>(path: string, schema: z.ZodType<T>): Promise<Section<T>> {
      try { return { data: await adminRequest(org, path, schema) }; } catch (err) { return { error: errorKey(err) }; }
    }
    const [providers, configs, policies] = await Promise.all([
      read(platform ? "provider-catalog/platform" : "provider-catalog", z.object({ providers: z.array(providerDto) }).transform(v => v.providers)),
      platform ? Promise.resolve({}) : read("provider-configs", z.object({ configurations: z.array(configDto) }).transform(v => v.configurations)),
      platform ? Promise.resolve({}) : read("tool-policies", z.array(policyDto)),
    ]);
    setState({ providers, configs, policies }); setGeneration(n => n + 1); setLoading(false);
  }, [platform]);
  useEffect(() => { void load(); }, [load]);
  async function save(path: string, method: string, body?: unknown) {
    if (pending.current) return;
    // A form loaded for one organization must never be submitted under another.
    if (organization.current !== localStorage.getItem("activeOrgId")) { setNotice({ error: "conflict" }); await load(); return; }
    pending.current = true; setBusy(true); setNotice({});
    try {
      const responseSchema: z.ZodType = path.endsWith("/test") ? z.object({ connected: z.literal(true) }) : path === "tool-policies" ? policyDto : path.startsWith("provider-catalog") ? providerDto : configDto;
      await adminRequest(organization.current, path, responseSchema, method, body);
      setNotice({ success: path.endsWith("/test") ? "connected" : "saved" });
      await load();
    } catch (err) {
      const key = errorKey(err); setNotice({ error: key });
      // Remove stale management forms immediately after server-side revocation.
      if (key === "denied") await load();
    } finally { pending.current = false; setBusy(false); }
  }
  function sectionError(error?: AdminErrorKey) { return error ? <p role="alert">{errors(error)}</p> : null; }
  return <div className="space-y-6" aria-busy={loading || busy}>
    <h1 className="text-2xl font-semibold">{t(platform ? "platformTitle" : "title")}</h1>
    <p className="text-sm text-muted-foreground">{t(platform ? "platformHelp" : "help")}</p>
    <Button type="button" variant="outline" disabled={busy || loading} onClick={() => { setNotice({}); void load(); }}>{t("reload")}</Button>
    {notice.error && <p role="alert">{errors(notice.error)}</p>}
    {notice.success && <p role="status">{t(notice.success)}</p>}
    {loading ? <p role="status">{t("loading")}</p> : <div key={generation} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t(platform ? "providerCatalog" : "providerConfigurations")}</h2>
        {sectionError(state.providers.error)}
        {platform ? state.providers.data && <>
          {state.providers.data.map(provider => <CatalogForm key={provider.id} provider={provider} busy={busy} save={save} />)}
          <CatalogForm busy={busy} save={save} />
        </> : <>
          {sectionError(state.configs.error)}
          {state.configs.data && state.providers.data && <>
            {state.providers.data.length === 0 && <p>{t("noProviders")}</p>}
            {state.providers.data.map(provider => <ConfigForm key={provider.id} provider={provider} config={state.configs.data?.find(c => c.providerId === provider.id)} busy={busy} save={save} />)}
          </>}
          {state.configs.data?.filter(config => !state.providers.data?.some(p => p.id === config.providerId)).map(config => <ConfigForm key={config.id} config={config} busy={busy} save={save} />)}
        </>}
      </section>
      {!platform && <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("toolPolicies")}</h2>
        <p className="text-sm text-muted-foreground">{t("policyHelp")}</p>
        {sectionError(state.policies.error)}
        {state.policies.data && <>
          <PolicyForm organization policy={state.policies.data.find(p => p.subject === "organization")} busy={busy} save={save} />
          {state.policies.data.filter(p => p.subject.startsWith("agent:")).map(policy => <PolicyForm key={policy.subject} policy={policy} busy={busy} save={save} />)}
          <PolicyForm busy={busy} save={save} />
        </>}
      </section>}
    </div>}
  </div>;
}
