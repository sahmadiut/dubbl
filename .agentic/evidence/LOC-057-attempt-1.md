# LOC-057 attempt 1 - contact people and files catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `1abb0ca197088fb52b40d36072db8d504228b051`; entry tree clean.
Live controller validate/status/next selected LOC-027. Source inspection found
nine route TSX files (2,965 lines including blanks) plus shared picker/drawer.
Split into LOC-057..060 and completed only LOC-057. LOC-027/007/002 remain
independent integration parents. No subagents were used.

Applied the memory controller-task skill and read repository/controller/frontend
instructions, localization source sections, catalog contract, LOC-006 dependency
evidence, actual contact people/files UI, REST routes, registered MCP source,
locale services and relevant tests. Stripe stays unchanged under DEC-008.

During final verification, the owner additionally requested fixing the previous
GitHub CI failure before committing and explicitly waived waiting for the next
hosted run. [Separate diagnosis and reproduction](CI-font-preferences-2026-10-18.md)
records the exact failing run and the authorized fixture-only repair. Historical
done-task content/evidence was not edited.

## Acceptance mapping

1. Extracted all authored UI copy in both owned tabs to `ContactPeople` (19)
   and `ContactFiles` (22): 41 paired messages, 2,962 total keys per locale.
   [Scope and explicit exceptions](../registries/CONTACT_PEOPLE_FILES_CATALOGS.md)
   inventory labels, guidance, form fields, counts, primary/visibility badges,
   confirmations, busy states, accessible icon actions and errors. English
   behavior/copy is retained; counts use ICU. Both pre-existing catalogs are
   unchanged outside the new namespaces, including all Stripe namespaces.
2. Real React/next-intl/PresentationProvider and production template rendering
   cover both locales, empty/populated/form/primary/busy/loading states, plural
   0/1/2, escaped caller data, byte-size units and action labels. Extracted actual
   production callback bodies verify exact org-scoped paths/headers, person
   fields/nulls, preserved input on denial, success reset, file metadata/MIME/
   visibility, signed PUT bytes, cancellation, download URL and HTTP/JSON/
   malformed envelope/network failures. Operation failures are translated and
   never expose arbitrary server prose. File reads/downloads check HTTP success;
   uploads require successful storage PUT. No financial logic, REST handler,
   schema, migration, auth policy, stored unit or IRR flag changed.
3. Scope, handoff and honest self-review retain provisional Persian, independent
   parent/native/RTL qualification and sibling ownership. Current MCP file
   list/upload/get-contact coverage and pre-existing add-person/download/delete
   gaps are explicitly recorded; extraction does not claim to resolve them.

## Actual verification

All commands ran in D:/Projects/dubbl. No full build, dev server, deployment or
application database access. Database tests used explicit TEST_DATABASE_URL on
a newly initialized PostgreSQL 18 cluster bound to 127.0.0.1 at a free port.
Fixtures migrated/dropped randomized disposable databases. Cleanup SQL returned
zero remaining dubbl_ci_* databases and the isolated server stopped in finally.
No live object storage was contacted.

| Check | Actual result |
|---|---|
| Controller selection/split/start/validate | Exit 0; valid 287-task graph |
| Focused contact catalog/wire/dashboard suite | Exit 0; 19/19 passed, no skips; 2.119 seconds |
| Full unit suite, concurrency 4 | Exit 0; 721/721 passed, no skips; 49.809 seconds |
| CI baseline reproduction | Expected exit 1; identical missing fontFamily assertion, 1 failed test |
| Repaired shell/auth/settings + locale + contact REST/MCP/SQL groups | Exit 0; 3/3 passed, no skips; 51.989 seconds |
| pnpm typecheck | Exit 0, also rerun after CI fixture repair |
| pnpm i18n:check | Exit 0; 2,962 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero errors/warnings, including repaired integration worker |
| pnpm lint | Exit 0; zero errors, 75 pre-existing warnings |
| Money inventory generation/verification | Exit 0; 417 columns, 2,215 scanned paths, 1,658 consumer hashes and occurrence lines |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog/registry audit | Exit 0; no unextracted JSX/display attributes, all new Persian keys contain Persian script, old namespaces unchanged, changed registry links resolve |
| Fetch/divergence before commit | Exit 0; HEAD and origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/contact-people-files-catalogs.test.ts tests/contact-wire.test.ts tests/contact-dashboard-ui.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test tests/integration/shell-auth-settings.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/shell-auth-settings.test.ts tests/integration/locale-preferences.test.ts tests/integration/contact-wire.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two owned pages> tests/contact-people-files-catalogs.test.ts tests/integration/shell-auth-settings-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The initial Persian write through PowerShell/Python stdin replaced Persian
characters with question marks. The new script assertion caught it; the catalog
was rewritten through UTF-8 apply_patch and focused/full checks passed. The CI
baseline failure is recorded as a failure, followed by successful repaired runs.
Inventory refresh is mechanical source/hash/line bookkeeping; no classification
or monetary policy changes. Ordinary full-suite provider regression tests do not
constitute dedicated Stripe work.

## Review and handoff

See [Codex self-review](LOC-057-review-1.md). Controlled rendering/callback
checks are not mounted browser interaction, native Persian review, full RTL,
storage-provider or hosted-CI qualification. The fixed CI assertions retain
exact equality and add independent persisted SQL checks. The full hosted suite
was not rerun locally. The next hosted result remains unverified, and the owner
explicitly requested not waiting for it after push.

Finish controller check/submit/self-review/done, commit only owned localization,
planning, inventory and explicitly authorized CI fixture/evidence files, push
origin/master, verify remote SHA and clean tree, report the next task and stop.
LOC-058..060 own the remaining contacts extraction; LOC-027/007/002 remain open.
