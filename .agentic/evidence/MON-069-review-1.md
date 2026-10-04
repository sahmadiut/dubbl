# MON-069 self-review 1

2026-10-04, Asia/Tehran. Reviewer coding-assistant, kind self. Reviewed actual
source/diff, REST/MCP schemas and envelopes, database ownership/lock order,
rule/import/posting/auto/payment/undo interactions, editor changes, fixtures,
registry and verification results. This is not independent human/peer financial
or security approval.

- Strict thresholds and opaque saved fixed amounts reject malformed/unsafe values
  without partial parsing, float money products or bigint serialization crashes.
  Numeric money stays bank minor units; exact aliases are additive. Decimal-percent
  ratios and sequential caps/final remainder conserve signed totals exactly.
- REST/MCP share direct DB services and described strict schemas. Eight operations
  cover existing features plus new detail parity. Review restored MCP list
  relations/deleted row and original REST keyword suggestion envelope. Partial
  defaults cannot reset omitted fields. Numeric control fields remain bounded.
- Organization scope precedes primary foreign money decoding. Active owned rule
  references and pre-existing bank/movement references validate before mutation.
  API keys/custom permissions/spoofed headers are exercised by actual handlers;
  registered SDK tool fixtures include negative scope/role/strict-input cases.
- Posting reuses qualified exact categorization/tax/FX/date-lock services inside
  the application transaction. One split journal with one bank leg and saved
  provenance supports exact undo. Imports remain suggestions without journals.
  Pending/zero/excluded/already linked history is excluded; hidden cash rejects.
- Automatic matching requires signed exact cash on a specific bank GL, skips
  ties, excludes recognition/noncash and links existing payments through their
  owning workflow. Original document/payment state is not resettled. Qualified
  saved FX/history/period checks and awaited audit stay in the transaction. Job
  audit actor resolves a real owner membership, not an invented identity.
- Actual SQL snapshots/audit injection verify atomic errors; races produce one
  journal/link. Final expanded worker covers malformed JSON, foreign saved refs,
  safe maximum, four currency scales, tax, preview, undo and existing cash.
  Full 202 units/eight integration regressions passed before final scoped guards;
  final five target groups, types, full lint (148 baseline warnings), inventory,
  legacy checks and diff checks passed afterward. Synthetic database count zero,
  server stopped; no application dev server, build or deployment.
- UI amount input explicitly uses bank minor units and retains safe exact text,
  avoiding an ambiguous hardcoded cents conversion for shared multi-bank rules.
  This changes the UI amount entry convention but preserves existing saved values
  and numeric API units; documentation calls it out. Source/type/behavior review
  only; no browser/screenshot or native linguistic review claim.

No unresolved defect found within this bounded rollout. Approve the three task
criteria using attempt evidence and documented limits. Preview is match-only;
whole-call fail-closed posting/matching and safe-number range remain intentional.
MON-021 and money/migration/accounting/security/IRR release gates remain open;
task tracker completion does not enable production currency flags.
