# RTL-009 final shared tables and owner-requested CI repair

This final attempt retains [attempt 1](RTL-009-attempt-1.md) as immutable shared-table implementation/verification history and adds the owner-requested preceding CI repair documented in [CI investigation](RTL-009-ci-investigation.md). No shared-table implementation changed after attempt 1; two test font mocks were corrected, generated money consumer hashes refreshed, and task evidence/handoff updated. The original commit request was rejected before a commit existed, then the owner authorized including this repair in the pending task commit.

## Reproduced cause and final verified results

GitHub origin run 40137985215 at commit 82552ef3a43bec40304075543a828b1f0e74030f failed only its Test job (1,525 pass/4 fail). Connector job summaries/logs show all four failures are stale next/font/google-only mocks in docs-metadata-catalogs and landing-help-integration after RTL-007 introduced the next/font/local build-time boundary. Before editing, the exact four TypeError local_1.default failures reproduced locally (3 pass/4 fail). Add the default local-font boundary mock and retain actual Google font names. Production font loader, root metadata and all assertions remain intact; no skip or workflow/product workaround.

- Focused repair plus installed-loader/direction regression command: node --import tsx --test --test-concurrency=1 tests/docs-metadata-catalogs.test.ts tests/landing-help-integration.test.ts tests/rtl-typography.test.ts tests/rtl-root-direction.test.ts: **16/16 pass**, exit 0.
- Exact full CI unit command **pnpm test: 1,534/1,534 pass**, exit 0; zero failures/skips/cancellations; duration 234,965.8076ms. Includes all four repaired root tests, all five new shared-table groups and existing money/domain/shared-control regressions.
- pnpm exec eslint tests/docs-metadata-catalogs.test.ts tests/landing-help-integration.test.ts: exit 0, no warnings/errors. Earlier final shared-table owned lint is also clean.
- Final regenerated inventory python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: exit 0; 417 columns/1,871 consumer hashes. Explicit UTF-8 comparison confirms all 417 complete schema column records unchanged from HEAD; only owned source/test consumer data changes.
- Earlier shared-table verification remains applicable: 48/48 combined and final5/5 focused tests, typecheck exit0, whole lint exit0 (20 pre-existing warnings), catalogs10,702 per locale, legacy9/9, exhaustive417 TSX ownership and empty diffs for four frozen provider files. The additional CI repair is test-boundary-only and passes its own lint and the full unit suite.
- Final controller validation and Git staged whitespace/scope checks precede the authorized local task commit. No hosted replacement result is claimed. Local Node23.11.0 differs from CI's configured Node22; the exact hosted failure reproduced and the same full command passes locally.

## Final scope and review limits

Acceptance covers only the two shared tables and the explicitly authorized CI harness repair. Native sort buttons/accurate column/sort state, long-header growth/wrapping, shrinkable toolbar, localized search names, logical icon spacing and isolated RTL-aware pagination preserve exact callback strings/row identity/money. Canonical API/MCP/DB/output contracts and frozen provider sources are unchanged. New children and exhaustive census preserve all other module/output responsibility.

No mounted browser keyboard/selection/caret geometry, computed device clipping, zoom/text-spacing/screen-reader, native linguistic/accounting or PDF correctness is claimed. Those remain the assigned module/output children and independent RTL-008/RTL-002 acceptance. No full build, dev startup, app DB write, deployment, IRR enablement or dedicated Stripe work occurred. Supervisor performs the requested paired push after two completed task commits. Next controller task: RTL-010.
