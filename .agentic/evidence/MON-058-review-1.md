# MON-058 review 1 - implementing-assistant self-review

2026-10-04, Asia/Tehran. Reviewer: coding-assistant. Kind: self. Reviewed final
shared services/wire/REST/MCP registration, fixtures, contract/API documentation,
manifest/matrix/legacy inventory and attempt evidence. This is not independent
financial, security, migration, linguistic or human review.

## Findings and disposition

- Immediate batch amount uses decimal-major inputs and distinct amountExact/
  amountMinor aliases. Stored items use integer-minor aliases. Header amount is
  rejected so a silently ignored separate total cannot enter this contract.
  Rational agreement, per-allocation currency-scale rounding and bigint sums
  preserve units and reject unsafe workflows before commit.
- Settlement transaction reuse preserves every MON-056 guard and audit rather
  than reproducing old floating/independent writers. Existing standalone paths
  still open their own transaction. Seven domain regressions pass, including
  note/prepayment carrying and payable recognition paths.
- Scoped org/batch/document serialization and atomic all-item submission prevent
  stale per-item balance reads, orphaned cash and false completion. Final audit
  injection proves rollback after all cash/GL writes; competing submits produce
  one completion. Draft create/edit and removal checks are atomic too.
- Snapshot reads validate even unexpanded bill/contact references and safe
  totals/counts. Review added scalar bill journal tenant checks and eliminated
  an unnecessary fake AuthContext from the organization-only remittance builder.
- Remittance requires retained explicit item-to-payment provenance, live matching
  allocations and live posted unreversed journal source/date. Review added safe
  parsing of corrupt audit JSON and fixtures for malformed mappings and nonposted
  linked journals. Reversed and old unlinked histories cannot claim payment.
- Exact currency formatting retains safe-max fractions; text is escaped. All
  messages preflight before the first email/log write. Actual provider delivery
  is deliberately not claimed; skipped no-email callbacks and HTML output are
  fixture-qualified. Sequential partial delivery/repeat behavior is documented.
- Described MCP inputs, one operation per tool, direct DB scope, wrapTool and new
  tool registration meet repository conventions. No schema changes require new
  migrations. Full lint has 155 existing warnings and no errors; final changed
  TS lint is clean. Typecheck, 175 units, all integration and inventory checks pass.
- Accidental overlapping session edits were repaired after explicit owner
  clarification. Final fixtures and services were reviewed together; no incomplete
  worker, foreign task edits or unverified completion claim remains in the diff.

## Accepted bounded compatibility changes and limits

New major inputs use actual currency scales and decimal tie math; historical
stored money is unchanged. Stored submit changes partial/unconditional completion
to atomic failure retaining the draft. Unsafe/inconsistent old batch histories
reject, and unlinked old remittances require future explicit qualification rather
than guessed matching. Mandatory financial audit retains retry/provenance records.
These changes are concrete, documented correctness repairs in the selected slice.

External email deliveries cannot roll back; later failures may retain earlier
deliveries/logs and repeated sends may resend. Unadopted writers, full-int64,
out-of-order residual carrying, actual HTTP/session/OAuth, performance and all
independent financial/security/migration/release/IRR gates remain assigned work.
No deployment, production migration, history repair or IRR rollout is implied.

## Result

Approve the three MON-058 criteria for this bounded exact batch contract slice.
No blocking finding remains. MON-021 combined acceptance stays open. Close through
controller, validate the staged diff, commit/push per user instruction, then stop.
