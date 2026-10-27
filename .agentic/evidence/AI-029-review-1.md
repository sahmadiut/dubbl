# AI-029 review 1

Reviewer: Codex, self-review, 2026-10-28. No independent peer, human, security,
provider, native Persian or production approval is claimed.

Reviewed the scoped source/routes/MCP/tests, controller split and generated
capability/coverage diff. Accepted within the AI-029 observation boundary.

- Both transports call the same read service with authenticated current identity.
  No client organization/principal/config/lease argument is accepted. Current
  domain permission and record ownership checks are additional to history rights.
- Record projection is finite and uses no arbitrary stored text/URL. Only actual
  current nondeleted same-org records produce application links. Large expense
  amounts use SQL text; no exact-money decoder or rounding change was introduced.
- Conversation/run lock order agrees with deletion. Run-version changes and events
  commit atomically with step changes. Live authorization after lock waits prevents
  the tested delayed-response permission backdoor. A versioned cursor cannot point
  to another run and SQL compares full timestamps to handle microsecond ties.
- Reads leave usage, audit, queue and business state unchanged. Runtime remains
  disabled in tests. Event reconnect resets observation only. Unknown event kinds
  cannot disclose arbitrary stored content. No hidden retries/resubmissions exist.
- Completed versus pending/uncertain effects and stop requested/acknowledged are
  distinct. Restricted/unknown actions fail closed. Unknown worker availability is
  explicit. Source presence and test fixtures do not qualify worker execution.
- Required AI-030/031 children retain clarification, provider metering, worker
  scheduling, actual record provenance and streaming/recovery obligations. No
  AI-023/007 criterion was checked by this child or removed during the split.
- New tests plus lifecycle/persistence regressions pass, along with typecheck,
  focused/full lint (20 pre-existing warnings), AI inventories, legacy gate and
  controller/diff checks. The money inventory fails on verified unchanged baseline
  inputs, documented without disguising it as green. No new inventory waiver or
  unrelated rebaseline is inferred.

Final npx tsc --noEmit after the last test edits passed (exit0) before submission.
No remaining defect was identified within the scoped observation change. Final
worker/UI/provider/release qualification remains with the required later tasks.
