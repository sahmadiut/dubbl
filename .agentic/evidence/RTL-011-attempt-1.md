# RTL-011 independent public/admin/output integration acceptance

## Identity and selection

Codex task agent `codex-batch-rtl011`, 2026-10-25 through 2026-10-26, repository
`D:/Projects/dubbl`, master baseline
`684a0d0faa47dc701b7073451c7dcd3ea02922f4`. Initial working tree and index were
clean. Controller validate/status/next independently selected ready RTL-011
with all eight split children and RTL-006/007 resolved. This parent was explicitly
started; no checkbox or approval was inherited from a child's done status.
The prior local dashboard/owner-theme commit is preserved and the owner
explicitly authorizes a paired push after this task's commit.

## Independent audit result

The current ownership registry and actual app/components/lib TSX were reconciled:
all 135 assigned paths exist, every path has exactly one owner, and there is no
unowned TSX anywhere in that census. Counts are RTL-022=4, RTL-023=9,
RTL-024=3, RTL-025=35, RTL-026=9, RTL-027=14, RTL-028=53, RTL-029=8.
The full path ledger and per-group proof are retained in
[RTL_PUBLIC_OUTPUT_ACCEPTANCE.md](../registries/RTL_PUBLIC_OUTPUT_ACCEPTANCE.md).
The audit reads the original task criteria, current shared BidiText/IdentifierText,
email inline isolation, document HTML/PDF rendering, current child source
inventories and actual callback/provider/CSS tests rather than accepting task
counts as implementation proof.

The child source audits distinguish native controls, server delegates,
framework/decorative primitives, technical code/data and frozen provider surfaces.
The parent independently executes all eight child groups together with root,
provider, typography, existing consumers and a cross-surface financial fixture.
No additional production repair was needed. No new low-impact implementation-
mirroring tests, source feature or REST/MCP operation is introduced by this
acceptance-only change.

`git diff --name-only 894db899 HEAD --` the frozen checkout/billing/Stripe-card
paths, `app/api`, `lib/mcp`, `lib/db/schema`, `drizzle`,
`lib/documents/render-service.ts` and `lib/documents/render-wire.ts` returns no
paths. Baseline 894db899 precedes the RTL-022..029 adoption. This verifies that
those complete machine/persistence/frozen surfaces are unchanged across the
integration range. Provider-specific embedded admin/pricing/legal subtrees remain
the preserved exceptions documented in each child audit; no dedicated provider
repair or test is performed.

## Acceptance mapping

1. Assigned mixed text and identifiers: the exhaustive census plus actual rendered
   en-US/fa-IR and latn/arabext component tests pass. Native bdi/auto caller scopes,
   explicit LTR/selectable technical scopes and exact escaping retain values
   without inserting directional controls or rewriting data. Existing auth,
   organization, import/template, navigation, portal acceptance/signature and
   confirmation/search callbacks pass. The interleaved-language financial fixture
   traverses actual public invoice and issued-signature JSX, HTML, email and digest
   with USD/IRR/JPY/KWD and safe-integer maximum values. Snapshot fields, exact
   request/data values, machine CSV/JSON, URLs and raw template bytes remain exact.
   The legacy English/Helvetica PDF is an explicit output exception, not a claim
   that Persian PDF identifiers now shape or select correctly.
2. Public/admin/portal/output behavior and layout: real current component/hook
   callbacks and installed CSS checks pass together. Coverage includes growing
   auth/admin/onboarding controls, logical navigation/edges, long names/IDs, local
   table/code overflow, wrapping settings/import actions, native field labels,
   selected/pressed states, confirmation cancellation/rejection/retry, physical
   signing canvas/DPR/PNG bytes, chart/code chronology and isolated date/rate
   display. Root, Radix and docs direction remain independent of numeral choice.
   Email output executes the installed React Email renderer with actual inline
   CSS; document tests execute the real HTML builders and React-PDF binary engine.
   Modeled lifecycle/DOM services do not establish native focus, painting or
   measured pixel clipping. Those limits remain explicit.
3. Exceptions/qualification: the acceptance registry exhaustively maps all 135
   sources and technical/provider/output exceptions. DEC-008 Stripe checkout,
   billing and embedded provider content stay frozen and nonblocking. Legacy
   English/Helvetica PDF shaping, pagination and financial visual review remain
   [L10N-011](../tasks/L10N-011.md), whose actual human gate is still todo.
   Native Persian/accountant review remains L10N-001/L10N-012 and QA/release.
   Parent RTL-008 and RTL-002 criteria stay unchecked; neither global acceptance
   nor PDF-01 is closed by this scoped technical parent acceptance.

## Actual verification

All commands use the repository root and existing installed dependencies.
Only synthetic local fixtures are used; no application DB, live messages or
network provider operation is invoked.

Combined command, reproduced against the current integrated source snapshot:

```powershell
node --import tsx --test --test-concurrency=1 tests/rtl-auth-consent.test.ts tests/auth-catalogs.test.ts tests/shell-auth-settings-integration.test.ts tests/rtl-admin.test.ts tests/workspace-catalogs.test.ts tests/rtl-onboarding.test.ts tests/rtl-marketing.test.ts tests/landing-shell-catalogs.test.ts tests/landing-features-catalogs.test.ts tests/pricing-legal-catalogs.test.ts tests/docs-metadata-catalogs.test.ts tests/landing-help-integration.test.ts tests/landing-activity.test.ts tests/currency-website-acceptance.test.ts tests/rtl-public-portals.test.ts tests/public-portal-catalogs.test.ts tests/public-signing-catalogs.test.ts tests/rtl-shared-settings.test.ts tests/settings-data-catalogs.test.ts tests/settings-document-catalogs.test.ts tests/settings-automation-catalogs.test.ts tests/settings-access-catalogs.test.ts tests/procurement-settings-wire.test.ts tests/rtl-confirm-controls.test.ts tests/rtl-primitives.test.ts tests/rtl-bidi-controls.test.ts tests/rtl-shells.test.ts tests/shell-catalogs.test.ts tests/currency-domain-presentation.test.ts tests/whole-catalog-integration.test.ts tests/rtl-output.test.ts tests/output-catalogs.test.ts tests/document-render-wire.test.ts tests/rtl-root-direction.test.ts tests/rtl-typography.test.ts tests/public-output-catalog-integration.test.ts
```

Result: **193 tests, 193 pass, 0 failures, 0 skips/cancellations**, exit 0,
194095 ms. All 36 files execute in one invocation. In addition to individual
surface regressions, `public-output-catalog-integration.test.ts` independently
checks one financial fixture across output consumers and alternates languages
to expose accidental translator/presentation leakage.

| Other command/check | Actual result |
|---|---|
| `pnpm i18n:check` | Exit 0, 10,723 paired keys and structural arguments. |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0, 417 schema columns, 1,887 consumer hashes and occurrences. Initial snapshot verified; subsequent owner-source metadata refresh is recorded below. |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0, all nine legacy-money regression checks. |
| Source census and pre-child frozen/machine-boundary diff above | No missing/duplicate/unowned sources; no changed frozen or machine-boundary files. |
| `python .agentic/agent.py validate` | Exit 0, 415 tasks at selection and during acceptance. Structural validation is not proof of product/human review. |
| `git diff --check` | Exit 0. Windows line-ending conversion notices are informational. |

- Initial `pnpm typecheck`: exit 0, including MDX generation and TypeScript.
- Initial `pnpm lint`: recovered actual exit 0, 20 existing warnings and zero errors.

## Owner commit during interrupted continuation

After the usage-limit interruption, current HEAD was owner-authored commit
`c01b07a26939e84ca266959ec11388da899b800a`, already atop the prior dashboard
repair. It is retained unchanged and included in the authorized push. It changes
contacts table/toolbar sizing, dashboard money markup from forced LTR to auto bidi,
sidebar spacing/icon size, docs layout width and adds local visual-inspection
scripts/assets. No RTL-011-assigned TSX changed; the docs CSS is shared context.
The new inspection HTML/PNG/script artifacts are preserved, not executed or
represented as browser/visual validation by this task. No dependency was installed
for the owner's unused puppeteer inspection import.

Bounded verification of those actual changes:

```powershell
node --import tsx --test --test-concurrency=1 tests/dashboard-overview-catalogs.test.ts tests/rtl-dashboard-summaries.test.ts tests/rtl-relationships.test.ts tests/rtl-shells.test.ts tests/docs-metadata-catalogs.test.ts
```

Exit 0, **31/31 pass**, no failures/skips/cancellations, 67110 ms. The prior
193-test parent result remains attached to its unchanged assigned TSX snapshot;
these current adjacent consumers qualify the owner's changed presentation scope
without pretending the entire earlier run happened after that commit.

`pnpm exec eslint` on the owner's three changed UI surfaces and three
inspection scripts (contacts/dashboard/sidebar, check-positions/make-crop/test-format)
exits 0, zero errors/two warnings: existing unused contacts `total`, and owner's
unused `puppeteer` import. Full lint was not rerun after that commit; the recovered
prior full-lint result plus current scoped lint are stated separately.

`python .agentic/scripts/money_inventory.py --write` and the verifier exit 0,
417 columns/1,888 consumers. The only changed root inventory fields are
`scanned_paths` (three new inspection scripts) and `consumers` (contacts,
dashboard, sidebar records plus the new test-format script). Schema classifications
are unchanged. This lexical refresh repairs the owner commit's stale source
metadata and does not alter any owner source or financial behavior.

Final post-owner `pnpm typecheck`: exit 0, MDX generation and TypeScript complete without diagnostics.

## Qualification limits and review boundary

This is independent code/runtime/CSS acceptance of the public/admin/output
implementation under DEC-005, not an invented mounted/browser/native release
qualification. Screenshot capture/goldens are not required by the owner. No
browser session, measured narrow viewport/zoom/text-spacing clipping, live
caret/selection, native keyboard focus/assistive technology, reduced-motion
painting, real signing device, old-client email layout, printer or Persian PDF
visual/shaping/extracted-text qualification ran. Existing native behavior in
Radix/native controls is not reimplemented or described as fully qualified.
The actual legacy PDF font/English limitation is retained as a known
implementation exception owned by L10N-011, not hidden by the `%PDF-` test.

No application data/schema/migration/REST/MCP, saved snapshots, machine export,
financial calculation or IRR activation changed. No full build, dev startup,
provider operation, deployment or hosted-CI wait was performed. No human/native/
peer review is impersonated. Separate honestly attributed self-review is allowed
by START_HERE step 6/CONTROLLER because RTL-011 has human_review=false.

## Handoff

The task's final controller state, commit and remote parity are independently
recorded after evidence/review completion. Higher RTL-008/002 and the explicit
native/output/accounting gates remain open. The next task must be selected from
the live controller and assigned to a fresh agent by the supervisor. Push this
scoped acceptance commit together with prior dashboard/owner-theme and retained
owner RTL/inspection commits per the owner's two-to-three-commit batch authorization.
