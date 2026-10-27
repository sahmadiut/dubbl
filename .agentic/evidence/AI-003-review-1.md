# AI-003 self-review

2026-10-27, Codex task_003, kind **self**. No independent peer or human review is
claimed. Reviewed schema, generated migrations, shared services, REST/MCP parity,
inventory, real disposable DB tests and task acceptance against AI-001's contract.

Resolved findings:

- Scope must be part of every parent relation, not merely an organization field:
  composite organization/owner foreign keys reject mismatched nested records.
- State writes require version checks and valid terminal shape. Concurrent CAS
  loses safely, terminal runs cannot reopen, and unknown dispatched outcomes
  cannot become ordinary successful completion or automatic write retries.
- Histories must not return raw saved identity/configuration objects. DTOs omit
  them and current domain permissions gate generated inputs/results/record IDs.
- Generic role presets must not silently gain private-transcript audit powers:
  excluded the dedicated permission and verified it plus owner/admin distinctions.
- Deletion cannot silently forget financial effects: payloads erase while
  uncertain run/step metadata, operation keys and bounded actual record IDs remain.
- Expired reads hide content before maintenance, and expired/deleted conversations
  reject new payload storage. Database constraints and service input/aggregate
  limits both enforce bounded persistence.
- Auth mocking had to precede loading persistence. Corrected import order and
  reran the real integration; corrected a test-only TypeScript argument type.

Acceptance: **approve storage/history scope**, supported by the attempt evidence.
No provider/worker/UI/approval implementation is inferred. Later task owners must
enforce policy, domain provenance, approved transitions, concrete reconciliation,
worker maintenance and actual rollout gates. No application database migration,
live provider, browser, production or human security qualification is claimed.
