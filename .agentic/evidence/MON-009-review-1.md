# MON-009 self-review 1

2026-10-16, Asia/Tehran. Reviewer: coding-assistant (Codex), implementing agent.
Self-review only, no independent peer/human/accounting/legal approval.

Reviewed final product diff, generated migration/snapshot, seeding and immutable
metadata triggers, shared authenticated REST/MCP catalogue, exact-string factor
storage, primary display-source evidence, fixtures, registry/matrix and inventory.

## Findings and resolutions

- IRR fallback was absent and DisplayNames construction could fail. Explicit
  metadata now survives absent/throwing/partial currency enumeration, missing
  names and runtime fractional-digit drift. The frozen exact IRR scale remains
  zero. Actual persisted currency list responses agree across REST and MCP.
- Existing currency-create default was fixed-two. It now uses currency metadata
  and rejects conflicting IRR overrides; integration tests cover omitted/default
  zero and number/string/null conflicts. Other existing explicit-scale behavior
  is retained.
- Numeric typmod could round a future factor before validation. Final schema uses
  unconstrained numeric plus positive 20/18 checks; raw SQL/ORM precision and
  nonfinite negatives reject. A same-tenant composite predecessor FK and immutable
  metadata prevent silently replacing policy. Organization cascade still works.
- The organization-ID composite uniqueness is a table constraint, so it exists
  when the generated self-reference FK is installed. New baseline seeds are atomic;
  clean installs, historical upgrades, replay, rollback and backups pass.
- No user can submit official cutover dates or mutate policy through the new
  surface. Both read transports use the full strict schema, shared permission
  check and authenticated tenant scope. Cross-tenant references, header overrides,
  unknown fields, unauthorized and denied calls reject without financial writes.
- Catalogue coexistence is deliberately separate from activating a new ledger
  unit. No posted amount, rate or historical regime ID is guessed/backfilled.
  Complete SQL row snapshots and literal balanced totals survive the migration,
  future fixture and replay. The registry states the required future snapshot/
  conversion qualification rather than implying that a metadata date can switch
  posted history.
- Official operational facts could not be established from usable primary CBI
  material. Seeded dates/factor remain null, official remains false, and no future
  regime or toman alias is enabled. Unicode evidence supports display only.
  Production rollout guard remains false, tested independently of tracker state.

## Verification and decision

[Attempt evidence](MON-009-attempt-1.md) records actual checks, initial failed
fixture attempts, corrections and limitations. Final joint PostgreSQL suite is
20/20, unit suite 554/554, final focused currency/gate suite 15/15; typecheck,
zero-error full lint, clean owned-file lint, inventory/legacy gates and structural
checks pass. Local PostgreSQL 18, no build/dev, no application-DB mutation.

Approved for MON-009's metadata expansion scope. No unresolved scoped finding.
MON-010 retains money-migration/IRR financial qualification and its required human
review. Completion here cannot enable IRR or approve an official redenomination.
