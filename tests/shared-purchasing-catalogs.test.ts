import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { Receipt, CreditCard, ClipboardList, ClipboardCheck, PackageOpen, Undo2, PackageCheck, Repeat } from "lucide-react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import PurchasesLayout from "../app/(dashboard)/purchases/layout";
import Loading from "../app/(dashboard)/purchases/loading";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const caller = "<script>supplier & document</script>";
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const tabs = [
  { href: "/purchases", key: "bills", icon: Receipt },
  { href: "/purchases/bills/recurring", key: "recurringBills", hint: "recurringBillsHint", icon: Repeat },
  { href: "/purchases/debit-notes", key: "supplierCredits", hint: "supplierCreditsHint", icon: Undo2 },
  { href: "/purchases/expenses", key: "expenses", icon: CreditCard },
  { href: "/purchases/orders", key: "purchaseOrders", icon: ClipboardList },
  { href: "/purchases/goods-receipts", key: "goodsReceived", hint: "goodsReceivedHint", icon: PackageCheck },
  { href: "/purchases/requisitions", key: "requisitions", icon: ClipboardCheck },
  { href: "/purchases/landed-costs", key: "landedCosts", hint: "landedCostsHint", icon: PackageOpen },
] as const;

function render(path: string, locale: typeof locales[number]) {
  return renderWithPresentation(createElement(PathnameContext.Provider, { value: path }, createElement(PurchasesLayout, null, caller)), locale);
}

test("purchasing tabs render both catalogs with unchanged routes, order, icons and tooltips", () => {
  for (const locale of locales) {
    const messages = (locale === "en-US" ? en : fa).PurchasingNavigation;
    const html = render("/purchases", locale);
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.equal(anchors.length, tabs.length);
    tabs.forEach((tab, i) => {
      const [, attrs, content] = anchors[i];
      assert.ok(attrs.includes(`href="${tab.href}"`), tab.href);
      assert.ok(content.includes(escaped(messages[tab.key])), tab.key);
      const icon = renderWithPresentation(createElement(tab.icon, { className: "size-3.5 shrink-0" }), locale);
      assert.ok(content.includes(icon), tab.key);
      if ("hint" in tab) assert.ok(attrs.includes(`title="${escaped(messages[tab.hint])}"`));
      else assert.ok(!attrs.includes("title="));
    });
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
  }
});

test("each purchasing list keeps tabs visible and activates only its canonical tab", () => {
  for (const locale of locales) for (const selected of tabs) {
    const html = render(selected.href, locale);
    assert.ok(html.includes("<nav"), selected.href);
    const active = [...html.matchAll(/<a\b([^>]*)>/g)].filter(([, attrs]) => attrs.includes("border-foreground text-foreground"));
    assert.equal(active.length, 1, selected.href);
    assert.ok(active[0][1].includes(`href="${selected.href}"`));
  }
});

test("purchasing detail pages hide tabs while preserving escaped document children", () => {
  for (const locale of locales) for (const tab of tabs) {
    const html = render(`${tab.href}/document-a`, locale);
    assert.ok(!html.includes("<nav"), tab.href);
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
  }
});

test("purchasing loading reuses the existing bilingual accessible loader", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(Loading), locale);
    assert.ok(html.includes(`aria-label="${escaped(messages.SharedUI.loading2)}"`));
    assert.ok(html.includes('class="brand-loader"'));
  }
});

test("purchasing navigation has paired Persian messages and no literal tab copy", () => {
  assert.deepEqual(Object.keys(en.PurchasingNavigation), Object.keys(fa.PurchasingNavigation));
  assert.equal(Object.keys(en.PurchasingNavigation).length, 12);
  for (const value of Object.values(fa.PurchasingNavigation)) assert.match(value, /[\u0600-\u06ff]/);
  const source = readFileSync("app/(dashboard)/purchases/layout.tsx", "utf8");
  assert.doesNotMatch(source, /(?:label|title):\s*"/);
});
