"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CatalogForm, ConfigForm, PolicyForm } from "./management-forms";
import {
  adminRequest,
  AiAdminError,
  providerDto,
  configDto,
  policyDto,
  type Provider,
  type ProviderConfig,
  type ToolPolicy,
  type AdminErrorKey,
} from "@/lib/ai/admin-client";

type Section<T> = { data?: T; error?: AdminErrorKey };
type ManagementState = {
  providers: Section<Provider[]>;
  configs: Section<ProviderConfig[]>;
  policies: Section<ToolPolicy[]>;
};

const empty = (): ManagementState => ({
  providers: {},
  configs: {},
  policies: {},
});

function resolveResponseSchema(path: string): z.ZodType {
  if (path.endsWith("/test")) {
    return z.object({ connected: z.literal(true) });
  }
  if (path === "tool-policies") {
    return policyDto;
  }
  if (path.startsWith("provider-catalog")) {
    return providerDto;
  }
  return configDto;
}

export function AiManagement({ platform = false }: { platform?: boolean }) {
  const t = useTranslations("AiManagement");
  const errors = useTranslations("AiManagementErrors");

  const [state, setState] = useState<ManagementState>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    error?: AdminErrorKey;
    success?: "saved" | "connected";
  }>({});
  const [generation, setGeneration] = useState(0);

  const organization = useRef("");
  const pending = useRef(false);

  const errorKey = (err: unknown): AdminErrorKey =>
    err instanceof AiAdminError ? err.key : "failed";

  const load = useCallback(async () => {
    const org = localStorage.getItem("activeOrgId") ?? "";
    organization.current = org;
    setLoading(true);
    setState(empty());

    async function read<T>(
      path: string,
      schema: z.ZodType<T>
    ): Promise<Section<T>> {
      try {
        return { data: await adminRequest(org, path, schema) };
      } catch (err) {
        return { error: errorKey(err) };
      }
    }

    const [providers, configs, policies] = await Promise.all([
      read(
        platform ? "provider-catalog/platform" : "provider-catalog",
        z.object({ providers: z.array(providerDto) }).transform((v) => v.providers)
      ),
      platform
        ? Promise.resolve({})
        : read(
            "provider-configs",
            z
              .object({ configurations: z.array(configDto) })
              .transform((v) => v.configurations)
          ),
      platform
        ? Promise.resolve({})
        : read("tool-policies", z.array(policyDto)),
    ]);

    setState({ providers, configs, policies });
    setGeneration((n) => n + 1);
    setLoading(false);
  }, [platform]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(path: string, method: string, body?: unknown) {
    if (pending.current) return;

    // A form loaded for one organization must never be submitted under another.
    if (organization.current !== localStorage.getItem("activeOrgId")) {
      setNotice({ error: "conflict" });
      await load();
      return;
    }

    pending.current = true;
    setBusy(true);
    setNotice({});

    try {
      const responseSchema = resolveResponseSchema(path);
      await adminRequest(organization.current, path, responseSchema, method, body);
      setNotice({ success: path.endsWith("/test") ? "connected" : "saved" });
      await load();
    } catch (err) {
      const key = errorKey(err);
      setNotice({ error: key });
      // Remove stale management forms immediately after server-side revocation.
      if (key === "denied") await load();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function sectionError(error?: AdminErrorKey) {
    if (!error) return null;
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
      >
        {errors(error)}
      </p>
    );
  }

  const orphanConfigs =
    state.configs.data?.filter(
      (config) => !state.providers.data?.some((p) => p.id === config.providerId)
    ) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8" aria-busy={loading || busy}>
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t(platform ? "platformTitle" : "title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(platform ? "platformHelp" : "help")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            setNotice({});
            void load();
          }}
          className="shrink-0 self-start sm:self-auto"
        >
          {t("reload")}
        </Button>
      </header>

      {/* Global Alerts */}
      {notice.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive shadow-xs"
        >
          {errors(notice.error)}
        </p>
      )}

      {notice.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 shadow-xs"
        >
          {t(notice.success)}
        </p>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-xs">
          <p role="status" className="text-sm font-medium text-muted-foreground animate-pulse">
            {t("loading")}
          </p>
        </div>
      ) : (
        <div key={generation} className="space-y-10">
          {/* Providers / Configurations Section */}
          <section className="space-y-5">
            <div className="border-b pb-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {t(platform ? "providerCatalog" : "providerConfigurations")}
              </h2>
            </div>

            {sectionError(state.providers.error)}

            {platform ? (
              state.providers.data && (
                <div className="space-y-6">
                  {state.providers.data.map((provider) => (
                    <CatalogForm
                      key={provider.id}
                      provider={provider}
                      busy={busy}
                      save={save}
                    />
                  ))}
                  <CatalogForm busy={busy} save={save} />
                </div>
              )
            ) : (
              <div className="space-y-6">
                {sectionError(state.configs.error)}

                {state.configs.data && state.providers.data && (
                  <>
                    {state.providers.data.length === 0 && (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {t("noProviders")}
                      </p>
                    )}
                    <div className="grid gap-6">
                      {state.providers.data.map((provider) => (
                        <ConfigForm
                          key={provider.id}
                          provider={provider}
                          config={state.configs.data?.find(
                            (c) => c.providerId === provider.id
                          )}
                          busy={busy}
                          save={save}
                        />
                      ))}
                    </div>
                  </>
                )}

                {orphanConfigs.length > 0 && (
                  <div className="grid gap-6">
                    {orphanConfigs.map((config) => (
                      <ConfigForm
                        key={config.id}
                        config={config}
                        busy={busy}
                        save={save}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Tool Policies Section */}
          {!platform && (
            <section className="space-y-5">
              <div className="space-y-1 border-b pb-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  {t("toolPolicies")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("policyHelp")}
                </p>
              </div>

              {sectionError(state.policies.error)}

              {state.policies.data && (
                <div className="grid gap-6">
                  <PolicyForm
                    organization
                    policy={state.policies.data.find(
                      (p) => p.subject === "organization"
                    )}
                    busy={busy}
                    save={save}
                  />
                  {state.policies.data
                    .filter((p) => p.subject.startsWith("agent:"))
                    .map((policy) => (
                      <PolicyForm
                        key={policy.subject}
                        policy={policy}
                        busy={busy}
                        save={save}
                      />
                    ))}
                  <PolicyForm busy={busy} save={save} />
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}