# Approved cash settlement effects

AI-053 adds `executeApprovedSettlement` in `lib/ai/action-batches.ts`, a trusted
worker primitive accepting only run, lease, batch and item UUIDs. It does not
queue a run or expose a REST/MCP/model dispatch tool. Existing invoice/bill
payment REST/MCP operations retain their contracts and share the extracted
`payDocumentInTransaction` service. AI-051 owns resume/worker orchestration;
AI-054 owns external invoice delivery; AI-050/AI-044/AI-008 remain open parents.

Only the finite `settle_document` adapter may be consumed through this entry
point. Only a fresh one-time consumption supplies the original validated
document kind/UUID, exact amountMinor, Gregorian payment date, method, optional
saved bank UUID and reference. Caller-supplied arguments, old receipts, current
document status and narration cannot reconstruct a lost handoff. Repeated calls
observe bounded receipts and never repeat a domain invocation. Unsupported or
unbound business approval remains blocked, including self-assigned workflows.

Journal and settlement adapters share decision/selection/argument/step/fence
checks, original identity/configuration/lease/deadline checks and immutable
receipt reconciliation. Settlement additionally reobserves its exact resource
and business-policy digests inside the locked payment transaction through
`previewSettlementInTransaction`. This includes saved recognition and historical
carrying journals, previous allocations/carriers and audit base provenance,
contact, bank/ledger link, existing control/cash/FX accounts, saved exact rates,
base currency and current period/fiscal locks. Public previews stay read-only.

The transaction takes journal header/line SHARE ROW EXCLUSIVE locks first, then
the same mode on organization, invoice, bill, payment, allocation, numbering
and audit tables. SHARE locks protect credentials, grants, subscriptions, AI
configuration, references, period/fiscal/business policy, contact/bank, rates,
document lines and credit/debit/prepayment carriers. These locks fence ordinary
SQL writers and absent-row insertion as well as existing records. Run locks
follow domain locks so Stop can win while the adapter waits for resources.
Five-second lock and ten-second statement timeouts bound SQL waits; deadlocks,
timeouts and database faults fail closed without replay. These conservative
global locks can contend across organizations and do not qualify throughput.
No provider or network delivery runs while holding them.

The shared settlement writes payment, allocation, balanced cash/carrying/realised
FX journal, outstanding balance, number sequence and domain audit. An additional
operation-linked audit and succeeded step receipt commit in the same transaction.
The receipt contains only document, payment and settlement-journal UUIDs, in that
order, plus existing bounded step metadata. A final live authority/clock/runtime
check follows receipt/event writes and any waits. No new schema or stored-unit
conversion is needed. The shared safe-number bridge still rejects amounts above
Number.MAX_SAFE_INTEGER; bigint storage and exact intermediate arithmetic retain
their existing contracts. USD cents and IRR rials remain distinct minor units.

A failure rolls back the entire current payment and receipt, retaining earlier
batch effects. A lost COMMIT acknowledgement reconciles only the durable
succeeded step receipt; payment references and current balances are never replay
authority. A killed worker's uncommitted transaction rolls back, while the prior
consumption remains for fresh-process maintenance to mark uncertain and require
reconciliation. A recovered/replaced fence or late call cannot resume effects.
Stop retains already completed effects.

Disposable PostgreSQL acceptance uses actual session-backed REST approval,
registered MCP proposal/revision reads and real worker leases. Fixture-only SQL
queues approved runs; application resume is not implied. Cases cover invoice and
bill payments, partial/full USD and bigint IRR, EUR recognition/cash FX and later
partial carrying rounding, concurrent calls, unselected/dependent work, lost
handoffs, SQL resource/authority/policy/period/rate/bank races, post-write expiry,
atomic rollback, partial batches, lost commit acknowledgement and killed-worker
recovery. No live provider, production authentication interaction, delivery,
deployed worker, UI/native Persian, performance, deployment or rollout activation
is qualified. Existing runtime/provider rollout gates remain unchanged.
