import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { milestoneAssignmentsJson, milestoneBillingJson, milestoneInvoiceJson, projectMilestoneJson } from "../i18n/project-milestones-presentation";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { locales, caller, esc, milestone, entry, project, translate, renderSlice, has, button, flush } from "./helpers/project-slice";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const assignment = { id: "assignment-a", amount: 29, amountMinor: "29", description: caller, isPaid: true, member: { user: { name: caller, email: "a@example.test" } } };
const billing = { billingType: "milestone", currency: "KWD", billableExpensesTotal: 0, billableExpensesTotalMinor: "0", totalRemaining: milestone.amount, totalRemainingMinor: milestone.amountMinor, milestones: [{ ...milestone, remaining: milestone.amount, remainingMinor: milestone.amountMinor }] };
const form = { title: "  Caller title  ", desc: caller, dueDate: "2026-10-21", amount: "90071992547409.91", assignMilestoneId: milestone.id, assignments: [assignment], assignMemberId: "member-a", assignAmount: "0.29", assignDesc: caller, uninvoicedData: billing, selectedMilestoneIds: [milestone.id], invoiceNotes: caller };
const invoice = { id: "invoice-a", invoiceNumber: "INV-1", ...Object.fromEntries(["subtotal", "taxTotal", "total", "amountPaid", "amountDue"].flatMap(k => [[k, 0], [k + "Minor", "0"]])) };

test("milestone dialogs and exact totals render in both locales, including persisted isPaid", () => {
  for (const locale of locales) {
    const t = translate(locale, "ProjectMilestones"), h = renderSlice("milestones", locale, form);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["progress", "totalValue", "completedValue", "invoiced", "createInvoice", "newMilestone", "manageAssignments", "paid", "progressInvoice", "invoiceTotal"]) assert.ok(h.html.includes(esc(t(key as "progress"))), key);
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(esc(projectMoneyDisplay(BigInt(milestone.amount) * 2n, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(!h.html.includes(esc(t("markPaid"))));
    assert.ok(renderSlice("milestones", locale, { ...form, assignments: [{ ...assignment, isPaid: false }] }).html.includes(esc(t("markPaid"))));
    assert.ok(renderSlice("milestones", locale, { context: { project: { ...project, milestones: [] } } }).html.includes(esc(t("noMilestones"))));
    const fixed = renderSlice("milestones", locale, { ...form, fixedPercent: "0.1", context: { project: { ...project, billingType: "fixed" } }, uninvoicedData: { billingType: "fixed", fixedPrice: Number.MAX_SAFE_INTEGER, totalInvoiced: 0, remaining: Number.MAX_SAFE_INTEGER, invoicedPercent: 0 } });
    assert.ok(fixed.html.includes(esc(t("fixedProgress"))) && fixed.html.includes(esc(projectMoneyDisplay(9007199254741n, "KWD", resolvePresentation({ user: { language: locale } })))));
    const hourly = renderSlice("milestones", locale, { ...form, context: { project: { ...project, billingType: "hourly" } }, uninvoicedData: { billingType: "hourly", timeEntries: [{ ...entry, amount: 29 }] } });
    assert.ok(hourly.html.includes(esc(t("uninvoicedTime"))));
    assert.equal(renderSlice("milestones", locale, { context: { project: null } }).html, "");
  }
});

test("milestone create/complete/delete, assignment and invoice callbacks preserve scoped payloads and finite feedback", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const op of ["create", "complete", "delete", "assign", "paid", "invoice"]) for (const mode of ["ok", "http", "json", "envelope", "network"]) {
      const t = translate(locale, "ProjectMilestones"), h = renderSlice("milestones", locale, { ...form, assignments: [{ ...assignment, isPaid: false }] });
      const label = { create: "createMilestone", complete: "markComplete", delete: "deleteMilestone", assign: "addAssignment", paid: "markPaid", invoice: "createInvoice" } as const;
      const requests: { url: string; method?: string; body?: unknown }[] = [];
      globalThis.fetch = async (url, init) => {
        requests.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined });
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "network") throw new Error("Private network");
        if (mode === "envelope") return Response.json({});
        if (!init?.method) return Response.json({ assignments: [assignment] });
        return Response.json(op === "invoice" ? { invoice } : op === "delete" ? { success: true } : ["assign", "paid"].includes(op) ? { assignment } : { milestone: { id: milestone.id } });
      };
      let action = button(h, t(label[op as keyof typeof label]));
      if (op === "invoice") action = h.captured.find(c => typeof c.props.onClick === "function" && c.props.onClick.name === "handleCreateInvoice")!.props.onClick as () => Promise<void>;
      await action();
      if (mode === "ok") {
        if (!["assign", "paid"].includes(op)) assert.ok(has(h, "refresh"), op);
        const req = requests[0];
        const root = "/api/v1/projects/project-a";
        if (op === "create") assert.deepEqual(req, { url: root + "/milestones", method: "POST", body: { title: "Caller title", description: caller, dueDate: "2026-10-21", amountMinor: String(Number.MAX_SAFE_INTEGER) } });
        if (op === "complete") assert.deepEqual(req, { url: root + "/milestones/milestone-a", method: "PATCH", body: { status: "completed" } });
        if (op === "delete") assert.equal(req.method, "DELETE");
        if (op === "assign") assert.deepEqual(req.body, { memberId: "member-a", amountMinor: "29", description: caller });
        if (op === "paid") assert.ok(req.url.endsWith("/assignments?assignmentId=assignment-a") && req.method === "PATCH");
        if (op === "invoice") assert.deepEqual(req.body, { notes: caller, milestoneIds: [milestone.id] });
      } else {
        assert.ok(h.events.some(v => v[0] === "error"), op + ":" + mode);
        assert.ok(!has(h, "refresh") && !h.events.some(v => v[0] === "success"));
      }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("assignment/billing effects reject malformed replies, settle loading, and ignore cleaned-up responses", async () => {
  const original = globalThis.fetch;
  try {
    for (const effect of [0, 1]) for (const mode of ["ok", "http", "json", "envelope", "network", "cancel"]) {
      const h = renderSlice("milestones", "fa-IR", { assignMilestoneId: milestone.id, invoiceOpen: true });
      globalThis.fetch = async () => {
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "network") throw new Error("Private network");
        return Response.json(mode === "envelope" ? {} : effect === 0 ? { assignments: [assignment] } : billing);
      };
      const cleanup = h.effects[effect]() as () => void;
      if (mode === "cancel") { cleanup(); h.events.length = 0; }
      await flush();
      if (mode === "cancel") assert.deepEqual(h.events, []);
      else {
        assert.ok(has(h, effect === 0 ? "loadingAssignments" : "invoiceLoading", false));
        if (mode === "ok") assert.ok(has(h, effect === 0 ? "assignments" : "uninvoicedData", effect === 0 ? [assignment] : billing));
        else assert.ok(h.events.some(v => v[0] === "error") && !has(h, "uninvoicedData", billing));
      }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("milestone readers preserve exact aliases and reject bad envelopes, dates and foreign billing policy", async () => {
  await milestoneAssignmentsJson(Response.json({ assignments: [assignment] }));
  await milestoneBillingJson(Response.json(billing), "milestone", "KWD");
  for (const patch of [{ isPaid: undefined, paid: true }, { amountMinor: "30" }, { member: {} }]) await assert.rejects(milestoneAssignmentsJson(Response.json({ assignments: [{ ...assignment, ...patch }] })));
  for (const patch of [{ billingType: "fixed" }, { currency: "USD" }, { milestones: null }, { milestones: [{ ...billing.milestones[0], remainingMinor: "30" }] }]) await assert.rejects(milestoneBillingJson(Response.json({ ...billing, ...patch }), "milestone", "KWD"));
  await assert.rejects(projectMilestoneJson(Response.json({ milestone: { id: "foreign" } }), "milestone", milestone.id));
  for (const read of [milestoneAssignmentsJson, (r: Response) => milestoneBillingJson(r, "milestone", "KWD"), milestoneInvoiceJson, projectMilestoneJson]) for (const response of [Response.json({}), Response.json(null), new Response("Private JSON"), Response.json({ error: "Private" }, { status: 500 })]) await assert.rejects(read(response));
});

test("milestone authored copy is extracted with paired Persian messages", () => {
  const path = "app/(dashboard)/projects/[id]/milestones/page.tsx", source = readFileSync(path, "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/);
    if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.doesNotMatch(source, /error\.message|data\.error|toast\.(?:success|error)\("/);
  assert.deepEqual(Object.keys(en.ProjectMilestones).sort(), Object.keys(fa.ProjectMilestones).sort());
  for (const value of Object.values(fa.ProjectMilestones)) assert.match(value, /[\u0600-\u06ff]/);
});
