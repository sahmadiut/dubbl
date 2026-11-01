# Approved execution combined acceptance

AI-044 accepts the combined backend execution boundary implemented by
AI-043/049/050/051/052/053/054. AI-008 still owns the outer integrated
preview/decision/resume journey. This acceptance does not activate any runtime,
provider, worker, deployment or production gate.

The actual executor routes a durably resumed selection before entering the model
loop. It accepts only posting, invoice/bill cash settlement, saved-contact invoice
email and draft-journal deletion. The seven automatic read/draft tools retain
their existing catalog. Security, provider and role changes remain excluded.
Neither model text nor clarification supplies approval or expands a selection.

| Boundary | Required behavior | Combined evidence |
|---|---|---|
| Decision and queue | Exact interactive decision and separate explicit REST/MCP resume; queue receipt is content-free | ai-approved-worker and ai-action-decisions |
| Dispatch | One fresh argument handoff, immutable operation identity and original decision/resource/policy bindings | ai-action-consumption and ai-approved-execution-acceptance |
| Domain effect | Recheck current identity, organization, permissions, exact resource and policy, period/business approval, lease, deadline and Stop after SQL waits | Per-adapter suites, ai-mixed-effects and new parent late-authority scenarios |
| Dependency | Every succeeded prerequisite needs a matching immutable consumption receipt; status alone cannot authorize a successor | Parent removes a receipt or damages its argument, policy or resource digest after actual posting |
| Concurrency and commit loss | Same-lease executor competition cannot duplicate effects; lost payment COMMIT acknowledgement observes the committed receipt | Parent races two actual executors at a payment SQL wait and faults the real committed payment acknowledgement |
| Partial failure | Preserve the completed financial prefix; failed or uncertain email stops deletion and cannot resend | ai-mixed-effects and ai-approved-worker |
| Recovery | New lease may continue unconsumed effects only; lost handoff or uncertain delivery requires reconciliation | Separate-process crash/maintenance journeys in child suites, repeated in this acceptance run |

The new parent test reuses the real child fixture setup and shared domain/SQL
assertions, with a separate entry point and independently added scenarios.
It exercises linked registered MCP and session-backed REST handlers, actual
leases, executor locks, domain transactions, constraints and committed SQL.
Only authentication-session acquisition and external email transport are stubbed;
no model/provider attempt occurs in its approved scenarios. The payment case
asserts exact 2147483648 IRR minor units, one allocation, one operation-linked
audit and a balanced settlement journal after acknowledgement loss. Child
regressions retain USD, FX, SQL races, cancellation, external sending outcomes
and process restart coverage.

These are per-effect transactions. An earlier posting/payment or confirmed
external delivery survives later failure; there is no batch-wide rollback.
Confirmed email means transport acceptance, not inbox delivery. Domain status,
display content, current records or narration never reconstruct a lost executable
handoff. SQL corruption scenarios establish fail-closed behavior for the tested
bindings; they are not a claim against an attacker with arbitrary DB authority.

Qualification remains local with disposable loopback PostgreSQL, an injected
email transport and existing installed dependencies. Live providers, production
MCP interactive consent, deployed worker supervision, throughput, browser/native
Persian and production activation remain outside this task. Conservative global
domain table locks retain their existing contention cost. No public contract,
schema, migration, automatic catalog or Stripe functionality changed.

Run the new parent suite with an explicit disposable local TEST_DATABASE_URL:

```text
node --import tsx --test tests/integration/ai-approved-execution-acceptance.test.ts
```

Actual combined commands, results and review are recorded in
../evidence/AI-044-attempt-1.md and ../evidence/AI-044-review-1.md.
