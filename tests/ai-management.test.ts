import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import { z } from "zod";
import { renderWithPresentation } from "./helpers/presentation";
import { adminRequest, AiAdminError, adminErrorKey, configDto, type Provider, type ProviderConfig, type ToolPolicy } from "../lib/ai/admin-client";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const provider: Provider = { id: "11111111-1111-4111-8111-111111111111", name: "Fixture <script>", adapter: "responses", endpoint: "https://fixture.invalid/responses", enabled: true, models: [{ id: "fixture-model", contextTokens: 1000, outputTokens: 100, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-27" }], defaultModel: "fixture-model", timeoutMs: 1000, version: 3, delegatedOrganizations: ["22222222-2222-4222-8222-222222222222"] };
const config: ProviderConfig = { id: "33333333-3333-4333-8333-333333333333", providerId: provider.id, model: "fixture-model", enabled: true, isDefault: true, timeoutMs: 500, version: 7, credentialConfigured: true };
const policy: ToolPolicy = { subject: "agent:default", enabled: true, allowedTools: ["get_contact"], version: 4 };
type Props = Record<string, unknown> & { children?: React.ReactNode; onSubmit?: (event: unknown) => Promise<void>; onClick?: () => Promise<void> };

function loadComponent(file: string, intercept: (id: string) => unknown) {
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, React.ComponentType<Record<string, unknown>>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => intercept(id) ?? require(id.startsWith("@/") ? resolve(id.slice(2)) : id), compiled, compiled.exports);
  return compiled.exports;
}
function formHarness(component: string, props: Record<string, unknown>, locale: "en-US" | "fa-IR") {
  const forms: Props[] = [], buttons: Props[] = [];
  const loaded = loadComponent("components/ai/management-forms.tsx", id => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [initial, () => {}] };
    if (id === "next-intl") return intl;
    if (id === "react/jsx-runtime") return { ...jsx, jsx: (type: React.ElementType, props: Props, key?: string) => { if (type === "form") forms.push(props); return jsx.jsx(type, props, key); }, jsxs: (type: React.ElementType, props: Props, key?: string) => { if (type === "form") forms.push(props); return jsx.jsxs(type, props, key); } };
    if (id.endsWith("/ui/button")) return { Button: (p: Props) => { buttons.push(p); return React.createElement("button", { disabled: p.disabled as boolean }, p.children); } };
    return undefined;
  });
  const html = renderWithPresentation(React.createElement(loaded[component], props), locale);
  return { html, forms, buttons };
}
async function submit(form: Props, values: Record<string, string>, onReset = () => {}) {
  const original = globalThis.FormData;
  globalThis.FormData = class { get(key: string) { return values[key] ?? null; } } as unknown as typeof FormData;
  try { await form.onSubmit!({ preventDefault() {}, currentTarget: { reset: onReset } }); } finally { globalThis.FormData = original; }
}

test("management renders real bilingual forms with labels, masks, permission-safe withdrawn state and escaping", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en.AiManagement : fa.AiManagement;
    const save = async () => {};
    const catalog = formHarness("CatalogForm", { provider, busy: false, save }, locale);
    for (const key of ["endpoint", "timeout", "organizations", "defaultModel", "evidenceDate", "saveProvider"] as const) assert.ok(catalog.html.includes(m[key]), key);
    assert.ok(catalog.html.includes("Fixture &lt;script&gt;"));
    const connection = formHarness("ConfigForm", { provider, config, busy: false, save }, locale);
    assert.ok(connection.html.includes(m.configured)); assert.ok(connection.html.includes('type="password"')); assert.ok(!connection.html.includes('value="fixture-secret"'));
    assert.ok(connection.html.includes(m.revokeCredential)); assert.ok(connection.html.includes(m.testConnection));
    const withdrawn = formHarness("ConfigForm", { config, busy: false, save }, locale);
    assert.ok(withdrawn.html.includes(m.delegationWithdrawn)); assert.ok(withdrawn.html.includes(m.revokeCredential)); assert.equal(withdrawn.forms.length, 0); assert.ok(!withdrawn.html.includes('type="password"'));
    const tools = formHarness("PolicyForm", { policy, busy: false, save }, locale);
    const labels = locale === "en-US" ? en.AiManagementTools : fa.AiManagementTools;
    assert.ok(tools.html.includes(labels.get_contact)); assert.ok(tools.html.includes(labels.create_expense_claim));
    assert.ok(formHarness("ConfigForm", { provider, config, busy: true, save }, locale).html.includes("disabled"));
  }
  function audit(value: unknown) { if (typeof value === "string") { assert.match(value, /[\u0600-\u06ff]/); assert.ok(!value.includes("???")); } else for (const child of Object.values(value as object)) audit(child); }
  audit(fa.AiManagement);
  audit(fa.AiManagementErrors); audit(fa.AiManagementTools);
});

test("form callbacks preserve versions/defaults, clear credentials before dispatch and keep org/agent policies separate", async () => {
  const calls: { path: string; method: string; body?: unknown }[] = []; let cleared = false;
  const save = async (path: string, method: string, body?: unknown) => { if (method === "PUT" && path.includes("credential")) assert.ok(cleared); calls.push({ path, method, body }); };
  let h = formHarness("ConfigForm", { provider, config, busy: false, save }, "fa-IR");
  await submit(h.forms[0], { model: "fixture-model", timeoutMs: "500" });
  assert.deepEqual(calls.pop(), { path: "provider-configs", method: "POST", body: { providerId: provider.id, expectedVersion: 7, configuration: { enabled: true, isDefault: true, model: "fixture-model", timeoutMs: 500 } } });
  await submit(h.forms[1], { secret: "fixture-secret" }, () => { cleared = true; });
  assert.deepEqual(calls.pop(), { path: `provider-configs/${config.id}/credential`, method: "PUT", body: { expectedVersion: 7, secret: "fixture-secret" } });
  await h.buttons.find(b => b.variant === "destructive")!.onClick!();
  assert.deepEqual(calls.pop(), { path: `provider-configs/${config.id}/credential`, method: "DELETE", body: { expectedVersion: 7 } });
  h = formHarness("PolicyForm", { policy, busy: false, save }, "fa-IR"); await submit(h.forms[0], {});
  assert.deepEqual(calls.pop()?.body, { agentId: "default", enabled: true, allowedTools: ["get_contact"], expectedVersion: 4 });
  h = formHarness("PolicyForm", { organization: true, busy: false, save }, "en-US"); await submit(h.forms[0], {});
  assert.deepEqual(calls.pop()?.body, { agentId: null, enabled: false, allowedTools: [] });
  h = formHarness("CatalogForm", { provider, busy: false, save }, "en-US");
  await submit(h.forms[0], { name: "Fixture", endpoint: provider.endpoint, defaultModel: provider.defaultModel, timeoutMs: "1000", organizations: provider.delegatedOrganizations!.join(", ") });
  assert.deepEqual(calls.pop(), { path: `provider-catalog/${provider.id}`, method: "PATCH", body: { expectedVersion: 3, configuration: { name: "Fixture", adapter: "responses", endpoint: provider.endpoint, enabled: true, models: provider.models, defaultModel: "fixture-model", timeoutMs: 1000, delegatedOrganizations: provider.delegatedOrganizations } } });
});

test("browser requests validate envelopes and localize sensitive failures without exposing diagnostics", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => { assert.equal(String(url), "/api/v1/ai/provider-configs"); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-id"); return Response.json({ ...config, credential: "********", keyVersion: "never-use-in-browser" }); };
    assert.deepEqual(await adminRequest("org-id", "provider-configs", configDto), config);
    const cases = [[403, "private fixture-secret", "denied"], [409, "Provider configuration version conflict", "conflict"], [422, "Provider endpoint is not approved", "endpointRejected"], [503, "private fixture-secret", "unavailable"], [403, "Live provider requests are not qualified or enabled", "notQualified"]] as const;
    for (const [status, message, key] of cases) {
      globalThis.fetch = async () => Response.json({ error: message }, { status });
      await assert.rejects(adminRequest("org", "test", z.unknown()), (err: unknown) => err instanceof AiAdminError && err.key === key && !err.message.includes("fixture-secret"));
      for (const catalog of [en, fa]) assert.ok(catalog.AiManagementErrors[key]);
    }
    globalThis.fetch = async () => Response.json({ invalid: true });
    await assert.rejects(adminRequest("org", "test", configDto), { key: "failed" });
    globalThis.fetch = async () => { throw new Error("private fixture-secret"); };
    await assert.rejects(adminRequest("org", "test", configDto), { key: "network" });
    await assert.rejects(adminRequest("", "test", configDto), { key: "missingOrganization" });
    assert.equal(adminErrorKey(409, "Provider credential required"), "credentialRequired");
  } finally { globalThis.fetch = original; }
});

function workspaceHarness(platform: boolean, request: (org: string, path: string, schema: z.ZodType, method?: string, body?: unknown) => Promise<unknown>) {
  const slots: unknown[] = []; let cursor = 0, mounted = false;
  const effects: (() => void)[] = [], forms: { kind: string; props: Record<string, unknown> }[] = [], buttons: Props[] = [];
  const loaded = loadComponent("components/ai/management.tsx", id => {
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (value: unknown) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => { if (!mounted) effects.push(fn); },
    };
    if (id === "next-intl") return intl;
    if (id.endsWith("/admin-client")) return { AiAdminError, providerDto: z.unknown(), configDto, policyDto: z.unknown(), adminRequest: request };
    if (id === "./management-forms") return Object.fromEntries(["CatalogForm", "ConfigForm", "PolicyForm"].map(kind => [kind, (props: Record<string, unknown>) => { forms.push({ kind, props }); return React.createElement("section", { "data-form": kind }, kind); }]));
    if (id.endsWith("/ui/button")) return { Button: (props: Props) => { buttons.push(props); return React.createElement("button", null, props.children); } };
    return undefined;
  });
  function render() { cursor = 0; forms.length = 0; buttons.length = 0; const html = renderWithPresentation(React.createElement(loaded.AiManagement, { platform }), "fa-IR"); mounted = true; return html; }
  return { render, forms, buttons, async mount() { render(); for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); return render(); } };
}

test("management isolates role-specific sections and platform operations; conflicts and revocation are recoverable", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage"); let org = "org-a";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => org } });
  try {
    for (const role of ["provider", "policy", "chat", "site"] as const) {
      let revoked = false, failure: "conflict" | "denied" | null = null;
      const requests: { path: string; method: string; org: string }[] = [];
      const h = workspaceHarness(role === "site", async (scope, path, _schema, method = "GET") => {
        requests.push({ path, method, org: scope });
        if (method !== "GET") { if (failure) { if (failure === "denied") revoked = true; throw new AiAdminError(failure); } return config; }
        if (revoked || role === "chat" || (role === "policy" && path !== "tool-policies") || (role === "provider" && path === "tool-policies")) throw new AiAdminError("denied");
        if (path.includes("provider-catalog")) return [provider];
        if (path === "provider-configs") return [config];
        return [policy];
      });
      const html = await h.mount();
      assert.equal(h.forms.some(f => f.kind === "ConfigForm"), role === "provider");
      assert.equal(h.forms.some(f => f.kind === "PolicyForm"), role === "policy");
      assert.equal(h.forms.some(f => f.kind === "CatalogForm"), role === "site");
      if (role === "chat") assert.ok(html.includes(fa.AiManagementErrors.denied));
      if (role === "site") assert.deepEqual(requests.map(r => r.path), ["provider-catalog/platform"]);
      if (role === "provider") {
        const save = h.forms[0].props.save as (path: string, method: string, body?: unknown) => Promise<void>;
        failure = "conflict"; await save("provider-configs", "POST", {});
        assert.ok(h.render().includes(fa.AiManagementErrors.conflict));
        assert.equal(requests.filter(r => r.method === "GET").length, 3, "conflict must preserve edits until explicit reload");
        await h.buttons[0].onClick!(); await new Promise(resolve => setImmediate(resolve)); h.render();
        assert.equal(requests.filter(r => r.method === "GET").length, 6);
        failure = "denied"; await save("provider-configs", "POST", {});
        assert.ok(h.render().includes(fa.AiManagementErrors.denied)); assert.equal(h.forms.length, 0);
      }
    }
    const requests: string[] = [];
    const h = workspaceHarness(false, async (_org, path, _schema, method = "GET") => { requests.push(method); return path.includes("catalog") ? [provider] : path === "provider-configs" ? [config] : []; });
    await h.mount(); const save = h.forms[0].props.save as (path: string, method: string) => Promise<void>;
    org = "org-b"; await save("provider-configs", "POST");
    assert.ok(h.render().includes(fa.AiManagementErrors.conflict)); assert.ok(!requests.includes("POST"));
  } finally { if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage"); }
});
