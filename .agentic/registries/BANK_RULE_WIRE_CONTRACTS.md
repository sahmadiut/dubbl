# Bank rule wire contracts (MON-069)

2026-10-04, Asia/Tehran. Strict schemas in `lib/api/bank-rule-wire.ts`, shared
direct-DB services in `bank-rules.ts` / `bank-auto-reconcile.ts`, pure evaluator
in `lib/banking/rule-engine.ts`. Eight MCP operations use AuthContext and wrapTool.
No schema, historical rescaling, representation header or rollout flag change.

## Operations, scope and envelopes

| REST / consumer | MCP | Success |
|---|---|---|
| GET /api/v1/bank-rules | list_bank_rules | REST `{data,pagination:{page,limit,total,totalPages}}`; MCP `{rules,total,page,limit}` |
| GET /api/v1/bank-rules/:id | get_bank_rule (new) | REST `{bankRule}`; MCP `{rule}` |
| POST /api/v1/bank-rules | create_bank_rule | REST 201 `{bankRule}`; MCP `{rule}` |
| PATCH /api/v1/bank-rules/:id | update_bank_rule | REST `{bankRule}`; MCP `{rule}` |
| DELETE /api/v1/bank-rules/:id | delete_bank_rule | REST `{success:true}`; MCP `{rule}` containing deleted row |
| GET /api/v1/bank-rules/suggestions | get_bank_rule_suggestions | `{suggestions}`; keyword/pattern variants below |
| POST /api/v1/bank-accounts/:id/apply-rules | apply_bank_rules | REST `{applied,reconciled,split}`; MCP adds `{matched,updated,dryRun,matches?}` |
| Bookkeeping maintenance; no existing REST auto route | auto_reconcile_bank_transactions | `{checked,reconciled,skipped}` |

Reads/suggestions require authentication. CRUD writes require manage:bank-rules.
Application (including preview) and automatic cash matching require manage:banking,
consistent with manual operations. Configuration permission alone cannot post
cash. API keys retain creator permissions and tenant despite spoofed org headers.
Reads use repeatable-read snapshots; CRUD/application/matching use the shared
organization lock. Scheduled matching resolves an actual owner membership with
no custom-role override and audits that user's UUID. No such owner means skip;
this job actor choice is not human approval. MCP list retains owned account/
contact/taxRate relations and adds contact creditLimitMinor. REST retains flat rows.

Pagination page/limit are canonical positive integers, limit 1..100, page and
offset int32. REST isActive is literal true/false. Priority is signed int32,
highest first, UUID breaks ties. Primary/parent/reference IDs are UUIDs.

## Conditions, fixed aliases and split policy

Up to 100 conditions use field description/reference/amount/payee/counterparty,
op contains/equals/starts_with/ends_with/gt/lt/between and nonempty value up to
10000 characters. Text operators are case-insensitive. Amount supports only
equals/gt/lt/inclusive between, with canonical signed **BANK minor-unit strings**,
e.g. `1250`, `-1250`, `-1250,1250`. No whitespace/plus/leading zero/exponent/
fraction/localized digit/negative zero/partial parse. Min cannot exceed max.
Thresholds and all money fit +/-9007199254740991; valid int64 strings outside
this safe range return classified 422. No units change: USD/JPY/KWD/IRR 1250 stays
1250. Rules apply across banks and do not convert thresholds or fixed allocations.
The editor labels bank minor units rather than assuming dollar-to-cent scaling.

Nonempty conditions supersede legacy matchField/matchType/matchValue. matchAll
true means AND, false OR. Empty multi-conditions require a valid nonempty legacy
comparison; matchType retains its four text enum operators (amount equals is
supported). Superseded empty legacy DB values remain. Every condition validates,
including otherwise short-circuited OR branches. PATCH inserts no create defaults
into omitted fields and validates the merged configuration. Unknown fields reject.

Split arrays contain 1..100 actions or null. Each has active owned accountId,
optional taxRateId, optional percent and fixed amount/amountMinor. Numeric amount
is nonnegative safe integer bank minor units, USD cents. amountMinor is equivalent
canonical nonnegative int64 text bridged to safe range; dual aliases agree.
Fixed takes precedence over percent. Percent is an ordinary number 0..100 with
at most six decimals; its decimal string becomes a bigint ratio, not float money
math. It is not a monetary amount or scaled basis point field.

The existing sequential policy remains: calculate fixed/percentage portions in
order against original magnitude, cap to remaining total and round half-up to
minor units. Last action gets the exact remainder regardless of its configured
value; omitted earlier values contribute zero. Zero portions omit. Signed parts
sum exactly to the movement. No fixed-first reorder or percent renormalization.
Saved JSON fixed amounts normalize to safe numeric storage; output adds
amountMinor per fixed action. Malformed/unsupported saved conditions, aliases and
JSON fail reads/application with 422. Delete retains its old full-row MCP response,
so unsupported monetary JSON also rejects atomically on delete. Removing a rule
with unavailable/foreign references does not disclose related data. No repair,
guessed currency scale or magnitude-driven conversion is attempted.

## Application and import suggestions

Only live active owned banks and unlinked, uncategorized, unreconciled movements
are eligible. Excluded/pending/zero/transfer/session/journal-linked lines skip;
hidden payment/expense history rejects. Bank/transaction currency agreement and
canonical Gregorian date are checked. Top-level and split category/contact/tax
references must be owned and live, active where applicable. dryRun returns matches
transactionId/ruleName/description without mutations/audits; it previews matching,
not all posting viability (locks, GL, tax or FX can still reject actual application).

Single-account autoReconcile posts via MON-065 categorization. Nonposting
suggestions assign category/contact/tax and remain unreconciled. Splits post even
with autoReconcile=false, retaining existing behavior; one exact shared split
journal with one bank leg replaces the old several-journal/first-link behavior.
Per-split tax is authoritative; top-level contact stays on the movement. Original
amount/balance remain unchanged. Shared services qualify GL ownership/type/
denomination/exclusivity, category currency, tax direction/metadata, date locks
and saved transaction-date FX. SourceId/base-currency/allocation audits support
MON-068 exact undo. Compound tax and unsupported FX follow MON-065 guards.
Import suggestions now validate/evaluate the same saved rules, but never post or
claim reconciliation, retaining MON-064 behavior.

An application call is atomic across selected banks/rows. Range/reference/FX/
posting/audit failure rolls back all writes, including GL allocation and journal
numbering. Shared organization locks serialize manual coding, application,
matching and undo, with eligibility selected after locking. Repeats do not repost
categorized/linked lines. Contact-only suggestions can match again while accountId
is null. No replay key or response cache is advertised.

## Automatic existing cash

Threshold integer 70..100, default 85. At most 500 checked lines total and 500
journal candidates per bank, ordered deterministically. Candidates are posted,
unreversed, owned journals on the **specific bank GL**, unlinked anywhere. SQL
bank sums stay text/bigint with safe-range guards, never net different bank GLs.
Signed exact amount equality precedes fuzzy date/text/reference ranking; close
amounts/opposite signs cannot link. Equal top confidence skips as ambiguous.

Manual/null-source journals require bank/base identity FX and MON-068 marking.
Existing payment-source cash uses MON-066 matching, including saved foreign FX
qualification, and links both payment and statement without resettling documents.
Recognition, noncash credit/debit/prepayment, transfer, expense and other domain
journals are excluded; open invoices/bills remain untouched. Saved journal/
allocation identity, original and statement date locks, audits and undo provenance
are validated by shared services. One transaction/organization lock prevents
duplicate cash links across calls/rows. Qualified-link errors roll back the call;
no-match/ambiguity/unsupported-source rows count as skipped. No journal/payment
is created. Existing-payment/manual undo only detaches.

## Suggestions, errors and qualification limits

MCP patterns retain description/category/contact/transactionCount, limit 1..50
(default 10). style=keywords mirrors REST: longest word longer than three chars,
minimum two matching rows, category name/code, occurrences, sampleDescription,
deduplicated keyword+category. REST retains its fixed limit 20 and old envelope.
Deleted banks exclude and returned references validate before names disclose.
No monetary sums in suggestions.

Malformed input 400; invalid/expired auth 401; permissions 403; missing/foreign
primary/reference UUID 404; unsupported exact range/saved JSON/FX/currency/history/
locked periods 422; unexpected DB/audit errors 500 with rollback. wrapTool returns
MCP errors and safe serialization; no bigint JSON crash or silent precision loss.

Four pure groups and actual exported REST/API-key/custom-role/registered SDK
fixtures ran on fully migrated disposable PostgreSQL18, including legacy/exact/
dual values, scopes, signed matching, four currency scales, safe maximum, tax,
undo, suggestions, saved corruption, locks, audit faults and races. Eight relevant
banking/payment regressions passed. MON-021 retains combined acceptance; full-int64
consumers, historical repair, independent accounting/security, foreign balance,
provider/OAuth/browser/PostgreSQL16/production and IRR release gates remain separate.
No builds, dev server, schema migration generation or deployment ran.
