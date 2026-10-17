import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { createTranslator } from "next-intl";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SidebarProvider } from "../components/ui/sidebar";
import { CreateDrawerProvider } from "../components/dashboard/create-drawer";
import { AppSidebar } from "../components/dashboard/sidebar";
import { Topbar } from "../components/dashboard/topbar";
import SettingsLayout from "../app/(dashboard)/settings/layout";
import GeneralSettings from "../app/(dashboard)/settings/page";
import TeamsLayout from "../app/(dashboard)/teams/layout";
import TeamsPage from "../app/(dashboard)/teams/page";
import NotificationsPage from "../app/(dashboard)/notifications/page";
import AuthLayout from "../app/(auth)/layout";
import SignInPage from "../app/(auth)/sign-in/page";
import SignUpPage from "../app/(auth)/sign-up/page";
import { renderWithPresentation } from "./helpers/presentation";
import { TestSession } from "./helpers/session";
import { sourceCallback } from "./helpers/source-callback";
import { authDestination } from "../i18n/navigation";
import { authErrorMessage, AuthPresentationError } from "../i18n/auth-errors";
import { COUNTRIES } from "../lib/data/business-types";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const router: AppRouterInstance = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };
function contexts(pathname: string, child: ReactNode) {
  return createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: pathname },
      createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, createElement(TestSession, null, child))));
}

test("LOC-006 composes auth layouts and dashboard shell with settings, teams and notifications in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    for (const Page of [SignInPage, SignUpPage]) {
      const html = renderWithPresentation(contexts("/sign-in", createElement(AuthLayout, null, createElement(Page))), locale);
      assert.ok(html.includes(messages.AuthLayout.tagline));
      assert.ok(html.includes(Page === SignInPage ? messages.Auth.welcome : messages.Auth.createTitle));
      assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("INVALID_MESSAGE"));
    }
    for (const [path, child, label] of [
      ["/settings", createElement(SettingsLayout, null, createElement(GeneralSettings)), messages.SettingsNavigation.organization],
      ["/teams", createElement(TeamsLayout, null, createElement(TeamsPage)), messages.Teams.teams],
      ["/notifications", createElement(NotificationsPage), messages.Notifications.notifications],
    ] as const) {
      // Compose the ready shell contents explicitly: OrgLoader intentionally
      // withholds children during SSR and is covered separately by locale tests.
      const html = renderWithPresentation(contexts(path, createElement(SidebarProvider, null,
        createElement(CreateDrawerProvider, null, createElement(AppSidebar), createElement(Topbar), child))), locale);
      assert.ok(html.includes(label), `${locale}: ${path}`);
      assert.ok(html.includes(messages.Shell.search));
      assert.ok(html.includes('href="/settings"'));
      assert.ok(html.includes("&lt;script&gt;user&lt;/script&gt;"));
      assert.ok(!html.includes("<script>user"));
      assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("INVALID_MESSAGE"));
    }
  }
});

test("actual sign-in preserves credential and TOTP contracts and safe callbacks across languages", async () => {
  for (const locale of locales) for (const state of ["twoFactor", "invalid", "invalidTotp", "network", "success"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const errors: string[] = [], loading: boolean[] = [], twoFactor: boolean[] = [];
    const location = { href: "", origin: "https://dubbl.test" };
    const needsTotp = state === "invalidTotp";
    const run = sourceCallback("app/(auth)/sign-in/page.tsx", "handleSubmit", {
      t: createTranslator({ locale, messages, namespace: "Auth" }),
      email: "person@example.test", password: "private-password", needsTotp, totp: "123456",
      callbackUrl: "https://attacker.test/phishing", authDestination, window: { location },
      setError: (value: string) => errors.push(value), setLoading: (value: boolean) => loading.push(value), setNeedsTotp: (value: boolean) => twoFactor.push(value),
      signIn: async (provider: string, args: object) => {
        assert.equal(provider, "credentials");
        assert.deepEqual(args, { email: "person@example.test", password: "private-password", ...(needsTotp ? { totp: "123456" } : {}), redirect: false });
        if (state === "network") throw new Error("network-secret");
        return state === "success" ? {} : { error: "untrusted-server-prose", code: state === "twoFactor" ? "TwoFactorRequired" : "CredentialsSignin" };
      },
    });
    await run({ preventDefault: noop });
    assert.deepEqual(twoFactor, state === "twoFactor" ? [true] : []);
    assert.deepEqual(errors, state === "twoFactor" ? ["", ""] : state === "success" ? [""] : ["", state === "network" ? messages.Auth.signInFailed : needsTotp ? messages.Auth.invalidCode : messages.Auth.invalidCredentials]);
    assert.deepEqual(loading, state === "success" ? [true] : [true, false]);
    assert.equal(location.href, state === "success" ? "https://dubbl.test/dashboard" : "");
  }
});

test("actual registration localizes failures and preserves registration body, credentials and onboarding route", async () => {
  for (const locale of locales) for (const outcome of ["duplicate", "network", "invalidJson", "loginFailed", "success"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const errors: string[] = [];
    const location = { href: "" };
    let logins = 0;
    const run = sourceCallback("app/(auth)/sign-up/page.tsx", "handleSubmit", {
      t: createTranslator({ locale, messages, namespace: "Auth" }), te: createTranslator({ locale, messages, namespace: "AuthErrors" }),
      authErrorMessage, AuthPresentationError, name: "Caller <script>", email: "person@example.test", password: "private-password",
      window: { location }, setError: (value: string) => errors.push(value), setLoading: noop,
      fetch: async (path: string, init: RequestInit) => {
        assert.equal(path, "/api/auth/register"); assert.equal(init.method, "POST");
        assert.deepEqual(JSON.parse(init.body as string), { name: "Caller <script>", email: "person@example.test", password: "private-password" });
        if (outcome === "network") throw new Error("network-secret");
        if (outcome === "invalidJson") return new Response("server-secret", { status: 500 });
        return Response.json(outcome === "duplicate" ? { error: "Email already registered" } : {}, { status: outcome === "duplicate" ? 409 : 201 });
      },
      signIn: async (provider: string, args: object) => {
        logins++; assert.equal(provider, "credentials");
        assert.deepEqual(args, { email: "person@example.test", password: "private-password", redirect: false });
        return outcome === "loginFailed" ? { error: "secret" } : {};
      },
    });
    await run({ preventDefault: noop });
    assert.equal(logins, ["loginFailed", "success"].includes(outcome) ? 1 : 0);
    assert.equal(location.href, outcome === "success" ? "/onboarding" : "");
    assert.deepEqual(errors, outcome === "success" ? [""] : ["", outcome === "duplicate" ? messages.AuthErrors.emailRegistered : outcome === "loginFailed" ? messages.Auth.postRegistrationFailed : messages.Auth.registrationFailed]);
  }
});

test("actual invitation acceptance keeps token branching and failed state separate from successful org selection", async () => {
  for (const locale of locales) for (const isLinkToken of [true, false]) for (const outcome of ["expired", "network", "success"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const states: string[] = [], orgs: string[] = [], errors: string[] = [];
    const token = "a".repeat(isLinkToken ? 32 : 64);
    const run = sourceCallback("app/(dashboard)/invite/[token]/page.tsx", "handleAccept", {
      t: createTranslator({ locale, messages, namespace: "Invitation" }), te: createTranslator({ locale, messages, namespace: "AuthErrors" }), authErrorMessage,
      token, isLinkToken, setState: (value: string) => states.push(value), setOrgId: (value: string) => orgs.push(value), setError: (value: string) => errors.push(value),
      fetch: async (path: string, init: RequestInit) => {
        assert.equal(path, isLinkToken ? "/api/v1/invite-links/join" : "/api/v1/invitations/accept");
        assert.equal(init.method, "POST"); assert.deepEqual(JSON.parse(init.body as string), { token });
        if (outcome === "network") throw new Error("network-secret");
        return Response.json(outcome === "success" ? { organizationId: "org-a" } : { error: "This invitation has expired" }, { status: outcome === "success" ? 200 : 410 });
      },
    });
    await run();
    assert.deepEqual(states, ["accepting", outcome === "success" ? "success" : "error"]);
    assert.deepEqual(orgs, outcome === "success" ? ["org-a"] : []);
    assert.deepEqual(errors, outcome === "success" ? [] : [outcome === "expired" ? messages.AuthErrors.invitationExpired : messages.Invitation.failed]);
  }
});

test("actual onboarding submits canonical country/currency/legal/referral values in either locale and stops on errors", async () => {
  for (const locale of locales) for (const outcome of ["forbidden", "network", "success"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const location = { href: "" };
    const errors: string[] = [], submitting: boolean[] = [];
    const country = COUNTRIES.find(country => country.code === "US")!;
    const run = sourceCallback("components/onboarding/onboarding-wizard.tsx", "handleComplete", {
      t: createTranslator({ locale, messages, namespace: "Onboarding" }), te: createTranslator({ locale, messages, namespace: "AuthErrors" }), authErrorMessage, AuthPresentationError,
      orgId: "org-a", orgName: "Caller org", countryCode: country.code, businessType: "llc", industry: "technology", referralSource: "other", referralOther: "  Personal referral  ", COUNTRIES,
      window: { location }, setSubmitting: (value: boolean) => submitting.push(value), toast: { error: (value: string) => errors.push(value) },
      fetch: async (path: string, init: RequestInit) => {
        assert.equal(path, "/api/v1/organization"); assert.equal(init.method, "PATCH");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(init.body as string), { name: "Caller org", country: country.name, countryCode: "US", defaultCurrency: "USD", businessType: "llc", industrySector: "technology", referralSource: "other: Personal referral" });
        if (outcome === "network") throw new Error("network-secret");
        return Response.json(outcome === "success" ? {} : { error: "Not a member of this organization" }, { status: outcome === "success" ? 200 : 403 });
      },
    });
    await run();
    assert.equal(location.href, outcome === "success" ? "/dashboard" : "");
    assert.deepEqual(submitting, outcome === "success" ? [true] : [true, false]);
    assert.deepEqual(errors, outcome === "success" ? [] : [outcome === "forbidden" ? messages.AuthErrors.notMember : messages.Onboarding.failed]);
  }
});
