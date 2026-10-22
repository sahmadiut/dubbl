import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import SettingsLayout from "../app/(dashboard)/settings/layout";
import { renderWithPresentation } from "./helpers/presentation";
import { readSettingsLockDate } from "../components/settings/period-lock-response";
import { requireSettingsResponse, settingsFailureMessage } from "../i18n/settings-errors";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const root = "app/(dashboard)/settings";
const noop = () => {};
const router: AppRouterInstance = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };

// Execute the production callbacks with controlled network/state boundaries.
// This catches success notifications and state changes after failed requests,
// which server rendering alone cannot exercise.
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    if (name === "initialEffect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") expression ||= node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}

test("LOC-012 combines every in-scope settings page with real navigation and both production locales", async () => {
  const paths = readdirSync(root, { recursive: true }).map(String).filter(p => /(^|[\\/])page\.tsx$/.test(p))
    .map(p => p.replaceAll("\\", "/")).filter(p => !p.startsWith("integrations/stripe/"));
  assert.equal(paths.length, 20);
  for (const path of paths) {
    const Page = (await import(`../${root}/${path}`)).default;
    for (const locale of locales) {
      const pathname = `/settings/${path.replace(/\/?page\.tsx$/, "")}`.replace(/\/$/, "");
      const html = renderWithPresentation(createElement(PathnameContext.Provider, { value: pathname },
        createElement(AppRouterContext.Provider, { value: router }, createElement(SettingsLayout, null, createElement(Page)))), locale);
      const messages = locale === "en-US" ? en : fa;
      assert.ok(html.includes(messages.SettingsNavigation.organization), `${path}: ${locale}`);
      assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("INVALID_MESSAGE"), `${path}: ${locale}`);
    }
  }
});

test("period lock reads the actual API envelope, preserves dates, and rejects failures or wrong shapes", async () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const errors = createTranslator({ locale, messages, namespace: "SettingsErrors" });
    const fallback = messages.SettingsGeneral.failedToLoadLock;
    assert.equal(await readSettingsLockDate(Response.json({ periodLock: { lockDate: "2026-10-17" } }), errors, fallback), "2026-10-17");
    assert.equal(await readSettingsLockDate(Response.json({ periodLock: null }), errors, fallback), "");
    for (const body of [{ lock: { lockDate: "2026-10-17" } }, {}, null, { periodLock: { lockDate: 20261017 } }]) await assert.rejects(readSettingsLockDate(Response.json(body), errors, fallback));
    for (const [status, expected] of [[401, messages.SettingsErrors.unauthenticated], [403, messages.SettingsErrors.forbidden], [500, fallback]] as const) {
      await assert.rejects(readSettingsLockDate(Response.json({ error: "server-secret" }, { status }), errors, fallback), { message: expected });
    }
    await assert.rejects(readSettingsLockDate(new Response("bad json"), errors, fallback));
  }
});

test("actual general-settings effect loads the stored lock and reports errors without adopting failure data", async () => {
  for (const locale of locales) for (const failed of [false, true]) for (const irrEnabled of [undefined, false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const failures: string[] = [], dates: string[] = [], rolloutStates: boolean[] = [], organizations: unknown[] = [], forms: unknown[] = [];
    const effect = callback(`${root}/page.tsx`, "initialEffect", {
      localStorage: { getItem: () => "org-a" },
      errors: createTranslator({ locale, messages, namespace: "SettingsErrors" }),
      st: createTranslator({ locale, messages, namespace: "SettingsGeneral" }),
      requireSettingsResponse, readSettingsLockDate, settingsFailureMessage,
      setLockDate: (date: string) => dates.push(date), setOrg: (org: unknown) => organizations.push(org), setPeppolId() {}, setPeppolScheme() {},
      setForm: (form: unknown) => forms.push(form), setIrrEnabled: (enabled: boolean) => rolloutStates.push(enabled),
      toast: { error: (message: string) => failures.push(message) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        return failed ? Response.json({ error: "server-secret" }, { status: 403 }) : Response.json(url.endsWith("period-lock") ? { periodLock: { lockDate: "2026-10-17" } } : {
          organization: { name: "Saved", defaultCurrency: "USD", fiscalYearStartMonth: 1 },
          ...(irrEnabled === undefined ? {} : { currencyRollout: { irrEnabled } }),
        });
      },
    });
    effect();
    // Drain both independent request chains, including response.json().
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(dates, failed ? [] : ["2026-10-17"]);
    assert.deepEqual(failures, failed ? [messages.SettingsErrors.forbidden, messages.SettingsErrors.forbidden] : []);
    assert.deepEqual(rolloutStates, failed ? [] : [irrEnabled === true]);
    assert.equal(organizations.length, failed ? 0 : 1);
    assert.equal(forms.length, failed ? 0 : 1);
  }
});

test("actual pipeline/reminder deletes retain failed confirmations, localize cancel, and never falsely succeed", async () => {
  for (const locale of locales) for (const kind of ["pipelines", "reminders"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const namespace = kind === "pipelines" ? "SettingsPipelines" : "SettingsReminders";
    const t = createTranslator({ locale, messages, namespace });
    for (const failure of ["conflict", "forbidden", "html", "network", "success"] as const) {
      const successes: string[] = [], failures: string[] = [];
      let reloads = 0;
      const run = callback(`${root}/${kind}/page.tsx`, "handleDelete", {
        t, errors: createTranslator({ locale, messages, namespace: "SettingsErrors" }),
        requireSettingsResponse, settingsFailureMessage, orgId: "org-a", getHeaders: () => ({ "x-organization-id": "org-a" }),
        fetchPipelines: async () => { reloads++; }, fetchRules: async () => { reloads++; },
        toast: { error: (text: string) => failures.push(text), success: (text: string) => successes.push(text) },
        confirm: async (options: { cancelLabel: string; onConfirm(): Promise<void> }) => {
          assert.equal(options.cancelLabel, messages[namespace].cancel);
          await options.onConfirm(); // useConfirm closes only when this resolves.
        },
        fetch: async (url: string, init: RequestInit) => {
          assert.equal(init.method, "DELETE");
          assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
          assert.ok(url.endsWith("/saved-id"));
          if (failure === "network") throw new Error("network-secret");
          if (failure === "html") return new Response("server-secret", { status: 500 });
          return Response.json(failure === "success" ? { success: true } : { error: "Delete live deals before deleting their pipeline" }, { status: failure === "success" ? 200 : failure === "forbidden" ? 403 : 409 });
        },
      });
      const action = () => run(kind === "pipelines" ? { id: "saved-id", name: "Caller" } : "saved-id");
      if (failure === "success") { await action(); assert.equal(reloads, 1); assert.equal(successes.length, 1); assert.deepEqual(failures, []); }
      else { await assert.rejects(action()); assert.equal(reloads, 0); assert.deepEqual(successes, []); assert.equal(failures.length, 1); assert.ok(!failures[0].includes("secret")); }
      if (failure === "conflict") assert.equal(failures[0], messages.SettingsErrors.pipelineHasDeals);
    }
  }
});

test("actual default/toggle callbacks keep state and success messages unchanged after failed HTTP requests", async () => {
  for (const locale of locales) for (const kind of ["pipelines", "reminders"] as const) for (const ok of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const successes: string[] = [], failures: string[] = [];
    let adopted = 0;
    const run = callback(`${root}/${kind}/page.tsx`, kind === "pipelines" ? "handleSetDefault" : "handleToggle", {
      t: createTranslator({ locale, messages, namespace: kind === "pipelines" ? "SettingsPipelines" : "SettingsReminders" }),
      errors: createTranslator({ locale, messages, namespace: "SettingsErrors" }), requireSettingsResponse, settingsFailureMessage,
      orgId: "org-a", getHeaders: () => ({ "x-organization-id": "org-a" }),
      fetchPipelines: async () => { adopted++; }, setRules: () => { adopted++; },
      toast: { error: (text: string) => failures.push(text), success: (text: string) => successes.push(text) },
      fetch: async () => Response.json(ok ? {} : { error: "secret" }, { status: ok ? 200 : 403 }),
    });
    await run({ id: "saved-id", name: "Caller", isDefault: false, enabled: false });
    assert.equal(adopted, ok ? 1 : 0);
    assert.equal(successes.length, ok && kind === "pipelines" ? 1 : 0);
    assert.deepEqual(failures, ok ? [] : [messages.SettingsErrors.forbidden]);
  }
});

test("pipeline/reminder loaders report failures, keep saved rows, and finish initial loading", async () => {
  for (const locale of locales) for (const [kind, name] of [["pipelines", "fetchPipelines"], ["reminders", "fetchRules"], ["reminders", "fetchLogs"]] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const failure of ["forbidden", "network", "json"] as const) {
      const failures: string[] = [], loading: boolean[] = [];
      let adopted = 0;
      const run = callback(`${root}/${kind}/page.tsx`, name, {
        t: createTranslator({ locale, messages, namespace: kind === "pipelines" ? "SettingsPipelines" : "SettingsReminders" }),
        errors: createTranslator({ locale, messages, namespace: "SettingsErrors" }), requireSettingsResponse, settingsFailureMessage,
        orgId: "org-a", getHeaders: () => ({}), logPage: 2, logStatus: "failed", URLSearchParams,
        setPipelines: () => { adopted++; }, setRules: () => { adopted++; }, setLogs: () => { adopted++; }, setLogTotal: () => { adopted++; },
        setLoading: (value: boolean) => loading.push(value), toast: { error: (text: string) => failures.push(text) },
        fetch: async () => {
          if (failure === "network") throw new Error("secret");
          return failure === "json" ? new Response("secret") : Response.json({ error: "secret" }, { status: 403 });
        },
      });
      await run();
      assert.equal(adopted, 0);
      assert.equal(failures.length, 1);
      assert.ok(!failures[0].includes("secret"));
      if (failure === "forbidden") assert.equal(failures[0], messages.SettingsErrors.forbidden);
      assert.deepEqual(loading, name === "fetchLogs" ? [] : [false]);
    }
  }
});
