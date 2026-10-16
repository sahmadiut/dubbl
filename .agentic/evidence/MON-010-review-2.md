# MON-010 implementing-agent self-review, attempt 2

Reviewer: Codex, implementing agent. Kind: self. Date: 2026-10-17, Asia/Tehran.
This is technical preparation for actual human accounting/database review.
It is not independent review or approval to enable production IRR.

## Findings

1. The previous localized-input gap is addressed at a shared strict boundary.
   Script normalization only converts recognized digits. Separator removal
   follows validation of the entire string; there is no arbitrary stripping,
   locale guessing, Number monetary arithmetic or implicit rounding/currency.
   Tests cover three scripts, mixed/bidi/unknown rejection, explicit separator
   grammar, signed int64 edges, currency scales and rounding. Canonical wire
   parsing stays unchanged. LOC-003 retains full product UI integration.
2. The migration fixture persists the Persian-digit IRR opening through the
   new boundary; its independent SQL oracle still expects literal 123456789.
   Existing row hashes/counts/nulls and financial/tenant corruption negatives
   remain intact. No posted history, schema, money units or production flag changes.
3. Deprecated `lib/money.ts` compatibility parsing is not the new boundary.
   A source search finds no product consumers of that function. No new use is
   permitted by the legacy money lint gate; separate import/export parsing keeps
   its existing strict contracts. Do not claim all Persian UI inputs are adopted.
4. Human review remains mandatory. `.agentic/docs/CONTROLLER.md` explicitly says
   human-review tasks reject self/peer approval. Neither this review nor the
   generic request to complete/push is attributable human accounting/DB approval.
   Retain the task for that review and keep the IRR financial guard false.

## Evidence

[Attempt 2](MON-010-attempt-2.md) records actual commands, final results and any
initial failures/retries. The original attempt/review remain historical evidence.
All 25 selected integration cases have passing current results after an isolated
retry of the unchanged core test; the joint command was 24/25, not a passing run.
558 units, final four localized tests, typecheck, owned-file lint and money/legacy
gates pass. Full lint exits 0 with zero errors and 81 existing warnings. The test
assertion typing correction and initial timeout are recorded; fixture cleanup
leaves zero disposable databases and the dedicated server stopped.
Review disposition: automated acceptance is satisfied within the documented
boundary/synthetic scope; submit for actual human accounting/database review.
Do not call controller human approval or done without that approval record.
