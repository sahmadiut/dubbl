# Versioned sensitive proposal storage acceptance

AI-042 independently accepts the AI-045 durable storage/revision boundary and
AI-046 finite domain observers. The executable parent journey is
`tests/integration/ai-action-storage-acceptance.test.ts` and its worker. It uses
actual REST handlers, registered MCP over linked SDK transports and migrated
disposable PostgreSQL. It supplements, rather than replaces, the
[combined domain/policy journey](AI_ACTION_INTEGRATION.md) and child regressions.

## Finite contract

| Proposed action | Trusted domain observation | Current domain grant |
|---|---|---|
| `post_entry` | Qualified manual draft, complete lines and per-currency posting impact | `post:entries` |
| `delete_draft_journal` | Qualified unlinked manual draft, removed lines and permanent deletion effects | `edit:entries` |
| `settle_document` | One recognized invoice/bill, saved cash/accounts, exact document amount and separate base GL/FX | `manage:payments` |
| `email_invoice` | One recognized invoice, saved contact recipient and derived summary | `manage:invoices` |

Every operation also requires live scoped AI/data access. Only a trusted leased
worker creates the initial unselected proposal. Read and revision share the
REST/MCP [batch contract](AI_ACTION_BATCHES.md); no endpoint or model tool can
create arbitrary authority. Unsupported actions, security/provider/credential/
role changes and frozen Stripe work remain unavailable.

The original validated arguments live in bounded `authority`, separately from
complete bounded business `display`. Bindings cover owner/org/run/step, action
and adapter version, resource and policy fingerprint, exact dependency graph,
selection, batch/run versions and original expiry. Generated migration
`0024_serious_chat.sql` enforces scope, uniqueness, versions, digests and payload
bounds. The parent reruns clean migration, checkpoint upgrade, baseline adoption,
idempotent rerun and failed-migration rollback without altering the schema.

## Independent replacement and race journey

The parent starts with six effects: USD/IRR manual posting, USD invoice/bill
settlement, separate manual deletion and saved-contact invoice email. The initial
selection and totals are empty. A full explicit revision changes one posting to
deletion and the other deletion to posting, edits both cash amounts/date/method/
reference, and replaces the email resource. Every new exact argument, action,
adapter/policy/resource binding, step and current permission is checked against
SQL. Old steps become skipped; the historical arguments/display stay unchanged
until retention. Original identity/configuration/start/deadline/expiry remain
bound. New steps have no executable input or dispatch lease.

The revised display contains all selected effects, new recipients/content and
separate exact totals of 1250 IRR and 2750 USD minor. Deletion/email contribute
no new GL impact. Two different complete REST/MCP revisions then compete with
distinct request keys and different cash amounts. Exactly one new version is
stored; the loser conflicts. Display/authority match the actual winner, including
2750 or 2850 USD minor and unchanged IRR units. Request-key replay returns only
the original receipt, and stale versions or changed input under an old key do
not write. The next six-item revision exceeds the existing total-step bound.

Two real SQL-lock scenarios exercise Stop against revision. When revision owns
the run and waits on a step update, Stop waits and then erases both the original
and newly committed revision. When Stop is first in the run-lock queue, the
waiting revision conflicts after cancellation; it cannot recreate authority.
Every row loses arguments/display, every prepared step becomes skipped, and no
run can be claimed. Old request-key retry with runtime disabled returns metadata
only and cannot resurrect cancelled payloads.

Conversation deletion, content retention and batch expiry each run after a
mixed revision. All current and superseded payloads are erased, including old
resources and arguments. Retention/expiry maintenance runs in a fresh process,
expires the waiting run and never requeues effects. Sibling/foreign owners
cannot retrieve the proposal. A journey-wide SQL fingerprint verifies no changes
to financial, reference, policy or delivery tables; Stop's own audit is permitted.
Payments, delivery logs, AI approvals, usage and provider attempts remain empty.

## Combined qualification and remaining gates

The parent also reruns child and AI-046 suites for exact graph closure/acyclicity,
selection/alias bounds, complete display withholding, late permission revocation,
foreign resources, corruption, stale policy/resource edits, business-policy
evaluation, unsafe recipients, period/FX/reference checks and write-wait rollback.
Legacy approved metadata never satisfies current resource-bound approval or
self-approval. Failures return the finite recovery codes in the batch contract.

No product behavior needed changing for this acceptance. This qualifies
observation and versioned proposal storage only. AI-043/044 still own explicit
decisions, missing direct-domain business approval enforcement, executor-to-
proposal integration, fenced effects and recovery. AI-008 remains the outer
integration parent. No UI/native Persian, live provider/delivery, production
activation or green global money-inventory claim follows from this acceptance.
