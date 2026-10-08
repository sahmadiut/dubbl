# MON-018 attempt 1 - combined journal contracts

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry HEAD
`67ff5b01d6aad3deb82627a1e9162f775b588c40`, master, clean working tree.
Exactly one controller-selected task: MON-018, the integration parent of
MON-035/036/037. Changes are uncommitted at evidence creation. Self-review only;
no independent peer/human/accounting or deployment approval is asserted.

Read applicable instructions, START_HERE/controller/project/repository map, task,
backend role, dependency evidence/reviews, ADR-006, money manifest, source money/
compatibility sections and actual REST/MCP/wire/service/generation/fixture source.
Existing child implementation is reused; no duplicate journal service or new tool
operation is introduced. The parent has independent combined acceptance evidence.

## Implementation and findings

- JOURNAL_INTEGRATION consolidates manual CRUD, lifecycle/import, recurring CRUD/
  generation and all corresponding tool boundaries, envelopes, monetary versus
  nonmonetary fields, exact aliases, legacy units, supported ranges and remaining
  qualification. Updated money manifest/README/test matrix and machine inventory.
- Added journal-integration.test.ts/worker using real migrated disposable DBs,
  API-key/custom-role REST handlers and all three actual MCP tool groups with SDK
  InMemoryTransport. Eighteen flows combine three origins, two writer transports
  and legacy/exact/dual clients at 1250, above-int32 and max-safe values.
- Manual/imported drafts cross transports for full replacement, scheduling,
  recoding, posting and voiding. Recurring templates cross transports for edits,
  pause/resume and generation; their posted entries then use explicit posted
  recoding and the same void/read paths. Generated history survives template
  soft-delete. Imports preview without writes. Run/post/void retries do not
  duplicate financial rows; existing successful no-op run auditing is retained.
- Both readers preserve distinct REST fixed-two-decimal strings versus MCP
  minor-unit numbers, raw Minor strings, saved currency, manual/identity FX and
  original/mirror links. IRR/JPY/KWD template tags never rescale or convert money;
  a saved EUR 1.25 manual rate survives reversal without another conversion.
- Reproduced an actual SDK mismatch: REST strict recurring create rejects unknown
  `fxRate`/`projectId` headers, but raw-shape MCP registration strips them and
  commits a template. Registered full recurring create/update object schemas
  instead. Advertised additionalProperties=false and runtime failure now preserve
  the financial/template/job/audit snapshot. Immutable startDate edits also fail
  through both transports. Existing nested strict leg validation remains intact.
- Updated the recurring child permission fixture to supply valid operation-specific
  bodies. Its previous shared body included templateId/status on create and an
  immutable startDate on update; strict SDK validation must not masquerade as a
  successful test of handler permission enforcement.

## Acceptance mapping

1. JOURNAL_INTEGRATION inventories every selected REST/tool/generation boundary,
   including scheduling/status tool distinctions, with companion complete CRUD,
   lifecycle/import and recurring field contracts. Numeric minor inputs, REST
   decimal imports/manual outputs, exact aliases, saved FX, safe money/sum/product
   bounds, int32 rates/counts and date policies are explicit. No full-int64 promise,
   public mode inference or rescaling is introduced.
2. The new combined fixture and all three child workers pass against migrated
   PostgreSQL. Actual legacy/exact/dual API-key and registered SDK writers/readers
   are exercised with two organizations, custom roles, organization-header override,
   foreign dimensions, credential failures and period locks. Child fixtures add
   every individual operation, both tenant directions and internal maintenance.
3. A combined snapshot covers exact-text journal/template legs, header/schedule
   rows, jobs and audit count. Unsupported headers/date edits, malformed/unsafe
   input, denied mutations and repeated lifecycle operations preserve it. Actual
   numeric/decimal/Minor reads at max-safe retain every unit without bigint JSON
   crashes. Child regressions reverify alias/rate conflicts, unsafe stored amounts/
   sums, forced SQL rollback, partial imports and serialized reversal/generation.

## Verification

All commands ran in D:/Projects/dubbl. Synthetic PostgreSQL 18.6 cluster:
`D:/Temp/dubbl-mon018-pg-2031a48c5b0a4869aba6d8f771c8c238`, loopback port 55448,
password-free fixture role dubbl_ci. Explicit TEST_DATABASE_URL pointed only to
this cluster; fixtures migrated/dropped random dubbl_ci_* databases, never the
configured application database. No .env credentials were opened/printed/persisted.
Final fixture database count was zero; pg_ctl fast/wait stop succeeded. Cluster
directory remains retained. No temporary server is left running.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0, valid 173-task graph; MON-018 selected | Structural state only |
| Final `node --import tsx --test --test-concurrency=1 tests/integration/journal-integration.test.ts tests/integration/journal-wire.test.ts tests/integration/journal-lifecycle-wire.test.ts tests/integration/recurring-journal-wire.test.ts` | Exit 0, 4/4 pass | Actual handlers/SDK, not HTTP/session/OAuth/browser |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | Exit 0, 359/359 pass | Full pure repository suite |
| Final `pnpm typecheck` | Exit 0 | MDX generation and tsc, no build |
| Changed-file `pnpm exec eslint` on tool and three fixture files | Exit 0, clean | All changed TypeScript |
| `pnpm lint` | Exit 0, 0 errors/106 warnings in unchanged files | Existing warnings retained |
| Money inventory --write, then reproducibility scan | Exit 0; 415 columns, 1871 scanned files, 1400 consumer files, 26582 occurrences | Conservative lexical inventory |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 415 Drizzle columns and 1400 hashes/source lines verified | No transitive arithmetic qualification |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; 9 regression checks | Deprecated-consumer lint gate |
| psql version/count, pg_ctl stop | PostgreSQL 18.6 / zero fixture DBs / exit 0 | Synthetic local cluster only |
| Controller validate and `git diff --check` | Exit 0 | Git line-ending notices only |
| Read-only remote check before commit | origin master equals entry HEAD | Commit/push occurs after evidence and controller completion |

Initial failing checks are not counted as passes. The first combined fixture
reproduced unknown-field stripping. Later fixture assumptions were corrected to
preserve existing reversal description conventions and to supply organization-owned
replacement dimensions when testing foreign parent lookup. The first child run
exposed the invalid generic permission bodies described above. Final combined/child
run passes after all corrections. Typecheck was repeated after the child fixture
change; final source inventory/changed-file lint also cover that change.

## Scope and handoff

No schema/migration, application-DB mutation, history repair, rollout flag, full
build, Next dev server, Docker, provider request, deployment or human review.
Existing REST-create versus MCP/edit balance policies, manually mixed versus
already-base automated semantics and fixed identity recurring posting remain
documented. Import commits per group; generation commits per template. Best-effort
audit durability, reference/lock races, cross-entry MAX+1 numbering, import retry
duplication, scheduled auto-reversal execution and full exact-domain/base-currency
qualification retain MON-007/008/010 and QA/release gates. PostgreSQL 16 runtime and
independent financial/production qualification are not claimed.

See MON-018-review-1.md for actual self-review. No remaining blocker for this
bounded parent acceptance. Complete the controller, commit/push only these task
files, verify remote SHA/working tree and stop; next selection is MON-019.
