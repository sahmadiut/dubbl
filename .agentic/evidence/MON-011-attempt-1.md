# MON-011 attempt 1 — exact wire foundations

## Identity

2026-10-02, Asia/Tehran. Operator: codex. Entry HEAD
`b1101aee692ef7b78a97d535a0c3d64c33948890`, clean working tree. This work remains
uncommitted. Self-review only, without peer/human/accounting or deployment approval.

## Implementation and bounded scope

The controller selected MON-006. Inspected root/nested instructions,
START_HERE/controller/project/repository map, MON-004 dependency evidence,
ADR-002/004, source money/API sections, money manifest, exact primitives,
transitional ORM, shared response/MCP adapters, currency tools, exchange-rate and
invoice routes. Actual architecture has hundreds of direct v1 responses,
independent MCP writers and a number-only ORM/domain layer. Split the oversized
task per controller instructions: MON-011 foundation, MON-012 real boundary
rollout, parent MON-006 final integration. Original parent criteria remain
unchecked and unchanged; it depends on both children and is blocked on them.
No external approval is needed for this implementation split.

- Added `lib/money/wire.ts`: strict canonical signed int64-string money input,
  safe numeric aliases, currency-tagged DTOs, conflict rejection, explicit legacy
  bridge and exact-decimal FX aliases with quote-per-base direction. Neither
  units nor values rescale. Rates normalize with existing exact bigint/string
  policy; legacy DTOs reject unrepresentable int32-millionths rates.
- Added `stringifyWire`, legacy numeric by default; exact mode emits bigint
  strings only when explicitly selected by server code. Nested values, arrays,
  dates, nulls and ordinary safe decimals retain JSON behavior. Unsafe/nonfinite
  Numbers are rejected in both modes; no rounded-number-to-string repair and no
  BigInt prototype patch or magnitude-driven type fallback.
- Added `lib/api/json-response.ts`; shared REST helpers use it, retaining HTTP
  status/headers. `handleError` maps compatibility errors to 422 plus stable
  `LEGACY_NUMERIC_RANGE` code. Transitional ORM still exposes safe Numbers, now
  using the classified RangeError subclass rather than an unclassified failure.
- Updated all `wrapTool` results to use the shared serializer; unsafe values
  become error results with status/code. Handler invocation is inside the promise
  chain so synchronous validation/auth errors are handled consistently. Existing
  AuthContext is passed unchanged; no queries/roles are added or bypassed.
- Added 13 meaningful contract groups in `tests/money-wire.test.ts`, ADR-006,
  README/manifest/test matrix and refreshed machine inventory. Every Zod input
  field describes its units and expectations.

This foundation introduces no new public operations. Direct NextResponse calls,
real domain schemas, exact endpoint capability/negotiation and endpoint/tool
fixtures remain MON-012. Full-range DB/business consumers remain MON-007/008.
Serializers cannot undo prior writes or recover precision already lost upstream;
real endpoint adoption must validate supported range before mutation. Proposed
deprecation retains numeric compatibility through financial/client qualification
and an owner-approved window; no sunset date is invented. No storage migration,
data change, IRR enablement or deployment.

## Acceptance mapping

1. `money-wire.test.ts` groups 1–6 verify both signed int64 edges, +/- values above
   JS precision, safe numeric limits, canonical syntax rejection, alias conflicts,
   no USD/IRR/JPY/KWD rescaling, explicit legacy-input rejection, positive exact FX
   bounds/direction and rejection of lossy millionths. Rates are synthetic fixtures,
   not current market quotes. Invalid dual fields produce Zod errors, not leaked
   BigInt conversion exceptions.
2. Groups 7–13 invoke actual shared REST/MCP adapters and ORM encoders/decoders:
   nested bigint emits safe legacy numbers, status/headers are preserved, unsafe
   values return classified 422 errors, and synchronous auth failures remain 403.
   Fixture context identity/org are passed unchanged; this is not DB tenant
   isolation qualification. No database connection/query is made by these fixtures.
3. Exact-mode payloads round-trip signed int64 edges and synthetic tiny/high FX
   strings without Number conversion. Counts/quantities remain ordinary numbers.
   ADR-006 and README explicitly separate transport foundations from real endpoint
   availability and record the pending rollout/deprecation window.

## Verification

All commands ran in `D:/Projects/dubbl`.

| Actual command/procedure | Result | Limits |
|---|---|---|
| `python .agentic/agent.py validate/status/context` and task selection/start/split | Exit 0; structure valid, 62 tasks after split | Tracker validity is not implementation proof |
| `node --import tsx --test tests/money-wire.test.ts tests/money-column.test.ts` | Exit 0; 16/16 pass | Initial contract/storage adapter regression run |
| `npm test` (final run after code changes) | Exit 0; 83/83 pass | Includes all 13 new groups and existing suites |
| `npx tsc --noEmit` (final run) | Exit 0 | Existing generated Next/MDX sources, no full build |
| `npm run lint` | Exit 0; 0 errors/167 existing warnings | Matches MON-005 warning count; no new warnings |
| `npx eslint tests/money-wire.test.ts`, `npx eslint lib/money/wire.ts` after final small changes | Exit 0; clean | Full lint above preceded final fixture generic/length guard |
| `python .agentic/scripts/money_inventory.py --write`, then without `--write` | Exit 0 | 410 columns, 1,307 scanned files, 1,091 consumers, 21,086 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | Drizzle exports, source hashes and lines match |
| `git diff --check` | Exit 0 | Git LF/CRLF notices only |

Initial typecheck found generic inference incompatibility between different
negative MCP fixture return types. Specified `wrapTool<unknown>` in that fixture;
final typecheck passes. During self-review, guarded dual-input comparisons to
avoid BigInt/fromLegacyRate conversion errors on invalid aliases, with negative
fixtures. A length guard prevents parsing oversized integer strings with BigInt.
Final code tests/typecheck and changed-file lint pass after these corrections.

No full build, Next dev server, Docker, schema generation, migration/integration
DB suite, deployment or live provider request was run. Storage/schema is unchanged;
adapter behavior is covered through the existing all-column unit tests. Existing
financial defects and application-wide qualification remain their assigned tasks.

## Review and handoff

See `MON-011-review-1.md` for actual self-review findings and scope. MON-011 has
no remaining blocker. Next is MON-012; MON-006 retains final integration acceptance
after its children. Changes remain uncommitted for owner review.
