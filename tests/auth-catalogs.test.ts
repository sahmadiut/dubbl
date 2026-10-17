import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathParamsContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import SignInPage from "../app/(auth)/sign-in/page";
import SignUpPage from "../app/(auth)/sign-up/page";
import ConsentPage from "../app/(auth)/mcp-authorize/page";
import AuthLayout from "../app/(auth)/layout";
import OnboardingLayout from "../app/(onboarding)/layout";
import InvitationPage from "../app/(dashboard)/invite/[token]/page";
import { StepOrgName, StepCountry, StepBusinessType, StepIndustry, StepReferral, StepReview } from "../components/onboarding/onboarding-wizard";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { authErrorMessage } from "../i18n/auth-errors";
import { invitationRole } from "../i18n/invitation-role";
import { countryName, industryName, referralName } from "../i18n/onboarding-options";
import { COUNTRIES } from "../lib/data/business-types";
import { INDUSTRIES } from "../lib/data/industries";
import { REFERRAL_SOURCES } from "../lib/data/referral-sources";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
function render(language: "en-US" | "fa-IR", child: ReactNode, search = new URLSearchParams()) {
  return renderToStaticMarkup(createElement(PresentationProvider, {
    presentation: resolvePresentation({ user: { language } }), messages: language === "en-US" ? en : fa,
    now: new Date("2026-10-17T00:00:00Z"),
  }, createElement(AppRouterContext.Provider, { value: router },
    createElement(SearchParamsContext.Provider, { value: search },
      createElement(PathParamsContext.Provider, { value: { token: "a".repeat(32) } }, child)))));
}

test("actual sign-in/sign-up render bilingual labels with stable input contracts and destinations", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const signIn = render(locale, createElement(SignInPage));
    const signUp = render(locale, createElement(SignUpPage));
    assert.ok(signIn.includes(messages.Auth.welcome));
    assert.ok(signIn.includes(messages.Auth.passwordPlaceholder));
    assert.ok(signUp.includes(messages.Auth.createTitle));
    assert.ok(signUp.includes(messages.Auth.passwordHint));
    assert.match(signIn, /<input type="email"[^>]*id="email"/);
    assert.match(signIn, /<input type="password"[^>]*id="password"/);
    assert.ok(signIn.includes('href="/sign-up"'));
    assert.ok(signUp.includes('href="/sign-in"'));
    assert.ok(signUp.includes('minLength="8"'));
  }
});

test("actual MCP consent renders safely escaped client names and translated permission copy", () => {
  const client = '<img src=x onerror="bad()">';
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const html = render(locale, createElement(ConsentPage), new URLSearchParams({ client_name: client }));
    assert.ok(html.includes(messages.Consent.title));
    assert.ok(html.includes(messages.Consent.accounts));
    assert.ok(html.includes(messages.Consent.deny));
    assert.ok(html.includes('<strong>&lt;img'));
    assert.ok(!html.includes('<img'));
    assert.match(html, /disabled=""/);
  }
});

test("auth and onboarding layouts preserve brand and links; invitation loading is localized", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const html = render(locale, createElement(AuthLayout, null, createElement("p", null, "child")));
    assert.ok(html.includes(messages.AuthLayout.tagline));
    assert.ok(html.includes(messages.AuthLayout.journals));
    assert.ok(html.includes(messages.AuthLayout.home));
    assert.ok(html.includes("dubbl"));
    assert.ok(html.includes('href="/"'));
    assert.ok(render(locale, createElement(OnboardingLayout, null, "child")).includes("child"));
    assert.ok(render(locale, createElement(InvitationPage)).includes(messages.Invitation.loading));
  }
});

test("known server errors translate, arbitrary/network/prototype text falls back and dynamic data escapes", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "AuthErrors", onError: error => { throw error; } });
    assert.equal(authErrorMessage(t, "Email already registered", "fallback"), messages.AuthErrors.emailRegistered);
    assert.equal(authErrorMessage(t, "Not a member of this organization", "fallback"), messages.AuthErrors.notMember);
    assert.equal(authErrorMessage(t, "This invitation has been revoked", "fallback"), messages.AuthErrors.revoked);
    assert.equal(authErrorMessage(t, { error: "secret" }, "fallback"), "fallback");
    for (const message of ["Failed to fetch", "<script>secret</script>", "constructor", "__proto__", "Internal error"]) {
      assert.equal(authErrorMessage(t, message, "fallback"), "fallback");
    }
    assert.equal(authErrorMessage(t, "unknown validation prose", "fallback", 400), messages.AuthErrors.invalidInput);
    const text = authErrorMessage(t, 'This invitation was sent to <script>x</script>. Please sign in with that email.', "fallback");
    const html = renderToStaticMarkup(createElement("p", null, text));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    for (const count of [1, 2]) {
      const source = `You've reached the limit of ${count} organization${count === 1 ? "" : "s"}. Upgrade your plan to create more.`;
      assert.equal(authErrorMessage(t, source, "fallback"), t("organizationLimit", { count }));
    }
    assert.equal(authErrorMessage(t, "You've reached the limit of 99999999999999999 organizations. Upgrade your plan to create more.", "fallback"), "fallback");
  }
});

test("onboarding option labels cover all current codes without changing canonical country/currency data", () => {
  const snapshot = JSON.stringify({ COUNTRIES, INDUSTRIES, REFERRAL_SOURCES });
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "OnboardingOptions", onError: error => { throw error; } });
    for (const country of COUNTRIES) {
      const label = countryName(t, country);
      assert.ok(label);
      if (locale === "en-US") assert.equal(label, country.name);
      else assert.match(label, /[\u0600-\u06ff]/);
    }
    for (const industry of INDUSTRIES) {
      const label = industryName(t, industry);
      if (locale === "en-US") assert.equal(label, industry.name);
      else assert.match(label, /[\u0600-\u06ff]/);
    }
    for (const referral of REFERRAL_SOURCES) {
      const label = referralName(t, referral);
      assert.ok(label);
      if (locale === "en-US") assert.equal(label, referral.name);
    }
    assert.equal(countryName(t, { code: "ZZ", name: "New country", flag: "", defaultCurrency: "USD" }), "New country");
    assert.equal(countryName(t, { code: "constructor", name: "Custom country", flag: "", defaultCurrency: "USD" }), "Custom country");
  }
  assert.equal(JSON.stringify({ COUNTRIES, INDUSTRIES, REFERRAL_SOURCES }), snapshot);
});

test("all real onboarding steps render translated controls and review labels while preserving legal/data values", () => {
  const noop = () => {};
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const name = render(locale, createElement(StepOrgName, { name: "شرکت Test", onNameChange: noop }));
    assert.ok(name.includes(messages.Onboarding.nameTitle));
    assert.ok(name.includes('value="شرکت Test"'));
    const countries = render(locale, createElement(StepCountry, { selected: "JP", onSelect: noop }));
    assert.ok(countries.includes(messages.OnboardingOptions.country_JP));
    assert.ok(countries.includes("JPY"));
    const types = render(locale, createElement(StepBusinessType, { countryCode: "JP", selected: "KK", onSelect: noop }));
    assert.ok(types.includes("株式会社"));
    const industries = render(locale, createElement(StepIndustry, { selected: "technology", onSelect: noop }));
    assert.ok(industries.includes(messages.OnboardingOptions.industry_technology));
    const referral = render(locale, createElement(StepReferral, { selected: "other", other: "User text", onSelect: noop, onOtherChange: noop }));
    assert.ok(referral.includes(messages.Onboarding.more));
    assert.ok(referral.includes('value="User text"'));
    const review = render(locale, createElement(StepReview, { orgName: "<script>name</script>", countryCode: "JP", businessType: "KK", industry: "technology", referralSource: "other", referralOther: "User text" }));
    assert.ok(review.includes(messages.OnboardingOptions.country_JP));
    assert.ok(review.includes(messages.OnboardingOptions.industry_technology));
    assert.ok(review.includes(messages.Onboarding.chartNotice));
    assert.ok(review.includes("User text"));
    assert.ok(review.includes("&lt;script&gt;name&lt;/script&gt;"));
    assert.ok(!review.includes("<script>"));
  }
});

test("bounded auth source has no uncatalogued JSX copy beyond inventoried brands and technical samples", () => {
  const paths = ["app/(auth)/layout.tsx", "app/(auth)/sign-in/page.tsx", "app/(auth)/sign-up/page.tsx", "app/(auth)/mcp-authorize/page.tsx", "app/(onboarding)/layout.tsx", "app/(onboarding)/onboarding/page.tsx", "app/(dashboard)/invite/[token]/page.tsx", "components/onboarding/onboarding-wizard.tsx"];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) {
        assert.ok(["dubbl", "Google", "Apple", "&middot;"].includes(node.text.trim()), `${path}: unextracted JSX ${node.text.trim()}`);
      }
      if (ts.isJsxAttribute(node) && ["placeholder", "title", "aria-label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.equal(node.initializer.text, "you@example.com", `${path}: unextracted attribute ${node.initializer.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test("built-in invitation role labels translate while custom role names remain organization data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "Invitation" });
    for (const role of ["owner", "admin", "member"] as const) assert.equal(invitationRole(t, role), messages.Invitation[role]);
    for (const custom of ["Auditor", "viewer", "constructor"]) assert.equal(invitationRole(t, custom), custom);
  }
});
