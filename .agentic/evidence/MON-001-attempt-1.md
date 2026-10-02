# MON-001 attempt 1: money and rate boundary inventory

## Identity

2026-10-02 (Asia/Tehran), codex implementing assistant. Entry HEAD 06b6fae, clean working tree; this attempt is uncommitted. Read root/.agentic rules, START_HERE, CONTROLLER, PROJECT, REPOSITORY_MAP, task/backend role, CI-002 dependency evidence, money/rollout ADRs and relevant plan sections. Controller selected and claimed exactly MON-001. No independent peer or human approval claimed.

## Audit result

- MONEY_MANIFEST.md replaces placeholders with domain/currency map, current/target ranges, assigned tasks, conversion/serialization hazards, percentage/quantity exclusions and provenance-based IRR investigation.
- MONEY_COLUMNS.md enumerates all 402 numeric/JSON columns from actual schema: 194 money, 4 FX, 12 money envelopes, 1 method-dependent allocation basis, 38 percentage, 13 scaled quantity, 20 time/count, 2 multiplier, 1 metadata and 117 non-money rows. Every row has source/line, unit, storage range, currency source and owner. Current monetary columns are int32; no amount bigint claimed.
- MONEY_BOUNDARIES.json indexes 1,283 tracked source/config/docs paths, 1,070 candidate consumer files and 20,350 occurrences. Includes API/MCP, public pay/sign/portal, UI, PDF/email, jobs, import/export/provider, backup/JSON and test boundaries, with hashes, line tags, table profiles, unit/range/currency context and task ownership. Conservative lexical coverage is not semantic dataflow or proof that every candidate is defective.
- money_inventory.py generates/checks artifacts from source without DB imports or env reads. verify_money_inventory.mjs independently compares exported Drizzle table metadata and verifies all referenced schema/consumer lines, hashes and pattern tags. Source-only imports load schema, not lib/db/index.ts.
- MONEY_MANIFEST and RISKS preserve both AUD-002 defects. No application feature, monetary primitive, contract, schema, stored value, provider call, deployment or flag changed; no new MCP tool or Drizzle migration needed for this audit.

Important findings: three scaled int32 rates versus one unscaled payroll real; direct Number products/rounding and SQL aggregate coercion; fixed-two-decimal import/public/PDF paths; original-document journal currency tags attached to base amounts; currency-less configs and mixed payroll aggregates; JSON envelopes and immutable provider/audit history that cannot safely be globally rewritten.

## Acceptance mapping

1. Column appendix and per-file consumer index provide units/range/currency context/owners for all actual numeric/JSON fields and lexical candidates, with domain semantics in manifest. Independent Drizzle comparison verifies 402/402 coverage and no duplicates. Implicit currency/mixed-unit policy gaps are explicit inventory findings for later tasks, not guessed interpretations.
2. Appendix and manifest distinguish basis points, plain percent, hundredths of item/miles, whole inventory quantity, numeric BOM quantities, labor/leave time, multipliers and non-money counters. Method-dependent allocationBasis is separate. Divisors are not blindly replaced.
3. Suspect IRR source cohorts are identified by write/import/display provenance, not amount magnitude. Owner-authorized local DB read-only counts show zero IRR-tagged records across 31 currency tables and zero IRR rate pairs; MON-001-irr-cohorts.json stores counts only. Private production cohort investigation and explicit remediation remain later qualification work. No data rescaled or changed.

## Verification

All commands from D:/Projects/dubbl, installed dependencies/local Node 23.11.0 and Python. Runtime source baseline remains HEAD; audit artifacts are uncommitted.

| Command / procedure | Actual result | Limitation |
|---|---|---|
| python .agentic/agent.py validate/status/context/start MON-001 --owner codex | Exit 0; valid 60 tasks; MON-001 selected/claimed | Structural workflow only |
| python .agentic/scripts/money_inventory.py --write | Exit 0, generated counts above | Lexical candidate index, not AST traversal |
| python .agentic/scripts/money_inventory.py | Exit 0; artifacts reproduce exactly from source | Refresh only after reviewing actual source changes |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 402 columns, 1,070 hashes and all occurrence/source lines verified | Source schema metadata, not live production schema |
| pnpm exec eslint .agentic/scripts/verify_money_inventory.mjs | Exit 0, no output/errors/warnings | Scoped audit script; no runtime TS edited |
| python -m py_compile .agentic/scripts/money_inventory.py | Exit 0 | Syntax check, not financial qualification |
| Inline Python Markdown local-link check over manifest/appendix | Exit 0; local paths/line anchors verified | Source links, not external legal/provider evidence |
| node --env-file=.env --input-type=module, inline pg read-only cohort audit | Exit 0; 31 tables; 0 IRR-tagged records; 0 IRR rate pairs | Local owner-authorized test DB; no claims about production/mislabelled rows |
| git diff --check | Exit 0; LF/CRLF conversion notices only | Includes tracked Markdown; new artifacts additionally verified by source/link checks |

DB query procedure: Pool from DATABASE_URL without printing it; BEGIN READ ONLY; for each table/column listed in the sanitized cohort artifact, SELECT count(*)::text AS total, count(*) FILTER (WHERE upper(currency_column)='IRR')::text AS irr; SELECT count(*)::text FROM exchange_rate WHERE upper(base_currency)='IRR' OR upper(target_currency)='IRR'; ROLLBACK, release and close pool. No row IDs/details/amounts retrieved, no DB writes. Counts include deleted/draft/history. Currency-less descendants require parent joins later.

During implementation, initial broad regex generation was stopped and replaced with bounded token matching; an early inline verifier ran before its artifact existed and failed with ENOENT. Final sequential generation and independent verification passed. Exploratory rg calls exposed stale guessed paths; final inventories use actual git-tracked paths and actual Drizzle exports.

Full build, dev server, full product lint/typecheck/tests, Docker, schema generation, migrations, provider network calls and production queries were not run. This diff contains only audit docs/artifacts/scripts/controller state; meaningful checks are reproducibility, independent schema/source verification and read-only counts. No financial behavior change is claimed.

## Review and handoff

See MON-001-review-1.md for honest implementing-assistant self-review. Currency policy gaps, exact arithmetic/rounding, migration design, compatibility contracts, workflow/security/runtime tests and actual financial approval remain MON-002..010/QA/release work. IRR readiness remains disabled; tracker completion does not enable it. No inventory blocker remains. After controller check/submit/self-review/done, next task is MON-002. Stop after MON-001, with changes uncommitted.
