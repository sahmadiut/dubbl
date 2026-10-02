# AUD-001 attempt 1: fork baseline

## Identity

2026-10-02 (user timezone Asia/Tehran). Operator: coding-assistant (Codex). Repository: D:\Projects\dubbl, master, HEAD f30f34aa55fe316a5e4ab79cdb70c9f61f6d5840. Working tree clean before claim; this audit is uncommitted. Windows PowerShell, installed dependencies, local Node 23.11.0/npm 11.3.0/pnpm 10.30.3/Python 3.13.9. Existing ignored .source/.next artifacts were present. No secrets or customer data inspected.

## Audit result

Updated docs/REPOSITORY_MAP.md and registries/UPSTREAM_DUBBL.md from inspected Git refs, manifest, CI, Docker/Compose/Railway, Drizzle config/journal/schema, API/auth/MCP registration, currency utilities/tests, root layout, PDF paths and Trigger configuration. CLAUDE.md points to AGENTS.md. Followed root and nested .agentic instructions. No application code, schema, dependency, branch, remote or deployment changes.

Fork origin is https://github.com/sahmadiut/dubbl.git. Upstream is https://github.com/dubbl-org/dubbl.git. Local upstream/master pins 13c3cf14e7900d32ad0ee8081c385e404dc120f9. No fetch was performed; online freshness is unknown. Local comparison is 0 behind/1 ahead, with only 99 new .agentic files at HEAD. Previously present runtime capabilities are inherited from that local upstream snapshot, not newly implemented by this audit.

Preserve existing currency-aware formatting and FX balancing/settlement/revaluation tests, bank rule/matching code, transfers, payment links, portal and period locks. Repository map records actual paths and distinguishes pure-function tests from untested workflows. Ledger/document/bank money columns inspected are PostgreSQL integer, FX integer millionths, and helpers use Number/parseFloat/Math.round. Root layout hardcodes English and Latin fonts. Exact money migration/Persian localization are pending requirements, not completed features.

## Acceptance mapping

1. Fork HEAD, branch, sanitized remote URLs and locally pinned upstream SHA recorded in both documents. Latest upstream freshness explicitly unverified.
2. Actual manifest commands, package manager/lockfiles, local versus CI runtime, DB config, tests, schema/migrations, CI and deployment mapped. Commands inspected but not executed are labeled. No plan assertion substituted for inspection.
3. Clean entry status and local upstream divergence inventoried. Capability table maps actual implementation and test paths; no workflow correctness claim from file presence.

## Verification

All commands below ran from D:\Projects\dubbl unless stated otherwise.

| Command/procedure | Actual result | Limitation |
|---|---|---|
| `git status --short` at entry | Exit 0, empty | Ignored .env/dependencies/generated files exist |
| `git rev-parse HEAD`, `git branch --show-current`, `git remote -v`, `git for-each-ref --format='%(refname:short) %(objectname)' refs/remotes` | Exit 0; values above | Local refs only |
| `git rev-list --left-right --count upstream/master...HEAD` | Exit 0, 0 and 1 | No network update |
| `git show --stat HEAD`, `git diff --name-only upstream/master HEAD` | Exit 0, only .agentic additions | Baseline commit, excludes this audit's uncommitted changes |
| `node --version`, `npm --version`, `pnpm --version`, `python --version` | Values in identity | Local Node differs from CI |
| Get-Content / rg file inventory and source inspection | Confirmed map/configuration paths; 520 v1 files and 55 MCP tool files | File counts do not equal operations or completeness. Guessed lib/accounting, lib/bookkeeping, lib/pdf and lib/api/auth.ts paths did not exist; actual locations recorded instead |
| `python .agentic/agent.py validate`, `status`, `context` | Exit 0; valid 60-task graph, AUD-001 selected | Structural validation only |
| `npx tsc --noEmit` | Exit 0 | Existing generated sources; scripts excluded |
| `npm run lint` | Exit 0, 0 errors / 167 warnings | Existing unused variables/hooks warnings; no --fix run |
| `npm test` in sandbox | Exit 1, spawn EPERM before test execution | Sandbox denied child processes, not assertion failures |
| `npm test` after approved escalation | Exit 0, 44 passed / 0 failed across eight files | Pure-function suite, no live DB/provider/browser tests |
| `python -m unittest discover -s .agentic/tests -v` in sandbox | Failed with temporary-directory permission errors | Compound inspection command exit was 0 from its final command; this unittest run did not pass |
| Same unittest command after approved escalation | Exit 1; 26 tests, 15 failures, 1 error (10 passed) | Tests copy current task state but expect 60 todo tasks and start AUD-001 again. Starting this audit exposes fixture dependence. Symlink test error: WinError 1314 privilege missing |
| `git diff --check` | Exit 0; only LF/CRLF notices | Checked tracked diff; subsequent final check recorded in review |

The controller test limitations are recorded rather than changing controller/test scope during a baseline audit. Fix fixture initialization and Windows privilege handling in future controller maintenance. Current task lifecycle is verified directly through controller commands; no claim that the controller suite passes.

Not run: full build, dev server, dependency install, Fumadocs regeneration, migrations/generation/push/seed, DB integration, E2E, rendered PDF/UI, provider calls, deploy or upstream fetch. No schema modification requires migration here.

## Review

Separate self-review in AUD-001-review-1.md. No peer or human approval claimed.

## Handoff

No blocker to this bounded source audit. Next task is computed after completion (expected AUD-002); later audits must inspect contracts deeply and verify live workflows. Lint warnings, state-dependent controller tests and Windows symlink privilege remain explicit baseline limitations.
