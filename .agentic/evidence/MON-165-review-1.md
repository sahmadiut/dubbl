# MON-165 self-review 1

2026-10-14, Asia/Tehran. Reviewer coding-assistant (same implementing Codex);
kind self. No independent peer/human/accounting approval is claimed.

Reviewed final task, implementation diff, regression assertions, operation/unit
inventories and MON-165-attempt-1 actual check results. Approved within the stated
bounded scope after repairing the findings below.

- Issue-date reference FX could rewrite carrying history; revaluation now reuses
  qualified saved recognition/control/carrier releases and never converts base GL.
  Edited reference rates and literal SQL expected amounts verify preserved history.
- Replay/period/accounts outside the transaction allowed duplicate/partial writes;
  org serialization, guarded period tables, qualified paired replay and transactional
  accounts/numbering/reversal/audit close those gaps. Actual overlapping workers,
  absent-row lock insertion and injected second-entry/audit failure verify behavior.
- UPDATE org locking initially deadlocked with a period insertion FK KEY SHARE;
  NO KEY UPDATE preserves writer serialization while allowing that insert to finish.
  Race observer refreshes PostgreSQL's cached activity snapshot, avoiding flakiness.
- Current dues after later partial/full releases could fabricate period-end money;
  they now reject unchanged, including paid docs. Future recognition is excluded.
- Bill due corruption lacked a saved original supplier-payable snapshot. Saved
  lines/header/control must establish total-payable/single-conversion history.
  Standard-tax bill succeeds; reverse-charge below total/ambiguous GRNI rounding
  rejects unchanged instead of guessing historical tax policy. Public settlement
  support is retained. This compatibility limitation is explicit in the mapping.
- Bigint conversions/groups/sides retain scales/low digits, rounding releases and
  oversized intermediate cancellation while safe Number outputs remain bounded.
- Recurring separate-template numbering now serializes on organization. Member
  creator, references and periods are checked inside the catch-up transaction;
  audit is atomic. Existing identity-tagged amounts/locked-date skip policy remain.
- Bank alert overlapping sweeps now lock/recheck exact SQL-text amounts and dedup
  per recipient/UTC day before commit; optional email follows commit. Full-int64
  formatting remains an alert-only policy, not an int64 ledger posting claim.
- Source mapping correctly distinguishes actual Trigger workers from authenticated
  payroll/accrual/payment-schedule/stock-costing processors. Existing provider-free
  domain fixtures, recorded local SMTP and Trigger source guards verify composition.
- No schema/migration/new public operation or tool registration is required. Both
  transports retain their shared domain services and distinct journal envelopes.
  No production currency flag, rescaling or posted original history was changed.
- Final static/money/controller/diff checks are supported by actual output. Full
  lint has zero errors and 90 unchanged warnings; owned TypeScript lint is clean.
  MON-159/MON-008 criteria remain independent and unchecked.

Residual limits: short global period-configuration blocking, no arbitrary past
balance reconstruction, no guessed legacy bill payable/pair repair, no external
email exactly-once guarantee, no production/provider/deployment/hosted CI/Docker/
browser qualification. These are documented supported-scope limits, not completion
claims for those separate gates. No remaining finding blocks MON-165 acceptance.
