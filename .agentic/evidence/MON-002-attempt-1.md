# MON-002 attempt 1: canonical exact-money primitives

## Identity

2026-10-02 (Asia/Tehran). Implementer: codex. Entry HEAD df96c63, clean working tree. Changes remain uncommitted. Read repository and nested instructions, controller/project/repository map, backend role, MON-001 evidence, money manifest/ADR and relevant requirements sections. Controller selected and claimed MON-002 only. No independent peer/human review claimed.

## Implementation

- `lib/money/exact.ts`: immutable currency-tagged bigint amounts; strict currency validation; signed PostgreSQL int64 final bounds; exact decimal parsing/output; add/subtract/negate/sum; rational multiplication and decimal-percent tax; explicit reject/truncate/floor/ceiling/half-away/half-even rounding; nonnegative-weight largest-remainder allocation conserving totals and mirroring refunds; guarded safe-integer legacy bridges. Only the explicit safe bridge converts bigint to Number, after checking both signs against MAX_SAFE_INTEGER. No floating-point accounting calculation in the core.
- `lib/money/scales.ts`: frozen installed-ICU scale snapshot, IRR explicitly zero according to the supplied plan. No claim of a newly researched legal regime or production enablement. Runtime ICU upgrades cannot silently change arithmetic scales. Future/historical regime design remains MON-009.
- `lib/money/README.md`: units, input grammar/256-character limit, rounding modes, deterministic allocation policy, errors, compatibility and scope. No implicit jurisdictional tax or FX rounding policy is applied. Every parsing/multiplication/tax caller chooses its mode explicitly.
- `lib/money.ts`: deprecated comments only; existing Number behavior unchanged. `scripts/eslint-legacy-money.mjs`, `scripts/legacy-money-baseline.json` and `eslint.config.mjs` reject new legacy imports/increases in imported-binding references. Grandfathered counts include each import itself; literal dynamic imports, require and re-exports are rejected. Baseline generated once from existing tracked TS consumers. Static guard cannot prove computed-import/whole-program dataflow or detect replacing an existing use without increasing counts; review remains necessary.
- `tests/exact-money.test.ts`: seven financial fixture groups for scales, malformed inputs, signed rounding, exact extreme values, bounds, tax/quantities, allocation and safe legacy boundaries. Allocation includes 100 positive/negative total fixtures plus both int64 extremes.
- `.agentic/scripts/verify_legacy_money.mjs` and `tests/legacy-money-lint.test.ts`: nine lint regression cases, also executed by the normal unit suite.
- `tsconfig.json`: ES2020 target for bigint syntax/operators in the core/test consumers. Node supports bigint; no full browser build/runtime qualification claimed.
- Mutable MONEY_MANIFEST/BOUNDARIES refreshed; inventory script includes new nonignored source before commit and explicitly identifies exact-core units/ranges/owner. Schema remains 402 numeric/JSON columns (194 money), 1,289 scanned paths, 1,074 consumers and 20,640 lexical occurrences. Completed MON-001 evidence remains unchanged.

## Acceptance mapping

1. Canonical primitive code performs bigint ledger math and exact integer ratio rounding. Only checked safe compatibility conversion uses Number. Existing legacy workflows retain their inventoried floating-point limitations for the separately assigned consumer/FX tasks; this criterion qualifies the new core, not application-wide migration.
2. Fixtures verify bigint 1250 formats/parses as USD 12.50 and IRR 1250; JPY zero decimals and KWD three decimals also round-trip, including negatives and int64 bounds. No stored value is changed.
3. Unit fixtures cover signs, zero, tie direction/even parity, overflow in every arithmetic operation, currency mismatch, malformed/fractional input, divide-by-zero, precise tax ratios, residual totals and unsafe number rejection. Normal suite: 58 passed, zero failed/skipped.

## Verification

Commands run from D:/Projects/dubbl, installed dependencies, Node 23.11.0 and Python 3.13.9. No database required for these pure financial checks.

| Command | Actual final result | Limit |
|---|---|---|
| python .agentic/agent.py validate/status/context/start MON-002 --owner codex | Exit 0; valid backlog; MON-002 selected/claimed | Workflow structure only |
| node --import tsx --test tests/exact-money.test.ts | Exit 0; 7 groups passed | Primitive financial behavior |
| pnpm test | Exit 0; final 58 tests passed, 0 failed/skipped | Existing tests plus core/lint guard, not full workflow qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 lint scenarios passed | Literal/static imports and reference ceilings |
| pnpm typecheck | Exit 0, twice; fumadocs-mdx and tsc --noEmit | No full build |
| npm run lint | Exit 0; 0 errors, 167 warnings in existing files | Existing warnings retained |
| pnpm exec eslint lib/money.ts lib/money/exact.ts lib/money/scales.ts tests/exact-money.test.ts tests/legacy-money-lint.test.ts scripts/eslint-legacy-money.mjs .agentic/scripts/verify_legacy_money.mjs eslint.config.mjs | Exit 0, clean | Changed runtime/test/config files |
| python .agentic/scripts/money_inventory.py --write, then without args | Both exit 0; reproduces refreshed counts above | Lexical inventory, no transitive proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 402 Drizzle columns, 1,074 hashes and source lines verified | Source metadata, not live DB |
| python -m py_compile .agentic/scripts/money_inventory.py | Exit 0 | Syntax only |
| git diff --check | Exit 0 | Git LF/CRLF conversion notices only |

Exploratory failures were corrected: PowerShell stripped quotes from an inline Node snapshot command; file-based generation succeeded. A temporary baseline generator initially tried an unavailable direct parser import, then inherited parser configuration from eslint-config-next; a strict lint-error check was narrowed to parser failures because existing source has unrelated rule findings under that standalone configuration. Generation helpers were removed after producing fixed artifacts. Final full configured lint passed. An initial manifest patch failed to match the actual sentence and was corrected using the read source. None of these failed exploratory commands are reported as passed.

No full build, dev server, Docker, schema generation, database mutation, provider lookup or deployment executed. This internal service adds no user-facing operation or changed REST/MCP route, so no new MCP tool or migration is required here. IRR readiness flags remain unchanged. Persisted exact FX, wire evolution, locale parsing/formatting and all workflow cutovers remain their own tasks.

## Review and handoff

Implementing-assistant self-review in MON-002-review-1.md. No primitive-task blocker. Next controller-selected task after completion: MON-003, storage expansion with migration fixtures/checksums. Stop after MON-002; changes uncommitted.
