# Durable run clarification

AI-030 supplies the persisted clarification boundary. AI-031 must integrate it
with the metered worker; no provider, worker process or UI is activated here.
AI-023 retains independent integration acceptance.

GET `/api/v1/ai/runs/{id}/input` and `get_ai_run_input` share getRunInput.
They return a bounded pending question with input UUID, inputVersion, runVersion,
kind, expiry, and currently accessible choices, or NO_PENDING_INPUT,
INPUT_EXPIRED or INPUT_RESTRICTED with null input. Runtime can remain off for
observation. Owner/organization and live view:ai-history apply. Text and choices
additionally require every saved question permission. Contact/journal choices
require view:data; expense choices also require manage:expenses. Missing, deleted,
foreign or inaccessible choices hide the entire question rather than present an
incomplete candidate set. Labels/status are loaded from actual current records;
plain text is untrusted, redacted, length bounded, and never HTML or authority.
Links use fixed application routes. No model-supplied label/URL is persisted.

POST `/api/v1/ai/runs/{id}/input/answer` and `answer_ai_run_input` share the strict,
described answerRunInputSchema. REST takes runId only from the path; body fields
are inputId, inputVersion, expectedRunVersion, requestKey, and answer. The answer
is either `{kind: "choice", candidate: {type, id}}` from the exact offered set,
or `{kind: "text", text}` of 1..4000 trimmed characters. Question/answer kinds
must match. Unknown/nested authority fields, foreign identities, stale versions,
forged/deleted/inaccessible choices, expired or cancelled runs fail. REST success
and error responses are private/no-store; neither endpoint accepts query fields.

Acceptance locks conversation, then run, then input. Exactly one pending answer
is committed together with a queued run/version, a content-free input_answered
notification, and a content-free audit entry. Identical same-key/version/content
retries return the original ANSWER_ACCEPTED receipt even after the run advances;
this receipt describes historical acceptance, not the current execution state.
Different content/key/version conflicts. Retry never enqueues again or answers
a subsequent question. Idempotency digests bind canonical parsed answer content;
no answer text enters events or audit changes.

Current answer identity must retain use:ai, view:ai-history and question/domain
permissions. The original persisted identity must also remain valid; reconnecting
with a new credential does not revive a revoked original principal. Server-chosen
provider/config/credential and organization/agent policy versions must still match.
Runtime/kill switches are checked again before queueing. A changed snapshot needs
a new request rather than silently adopting a different policy. The next claim
and every dispatch must revalidate identity/config again using lifecycle services.

Internal requestRunInput requires a live fenced worker lease, exact run version,
a 1..2000-character question, nonempty known permission requirements, and either
1..10 unique scoped candidate references or a text question with no candidates.
There are at most 20 questions per run. It rejects unfinished prepared/executing/
uncertain steps and reserved/in-flight/unknown usage; the worker must reconcile
them first. It atomically suspends the run as awaiting_input and releases its
lease. A partial unique index enforces one pending question per run and a scoped
foreign key binds input ownership to the run. No public/model tool creates questions.

The same run, steps, operation keys, provider-attempt history and usage charges
survive continuation. Payload bytes are accumulated against the existing 1 MiB
ceiling. No budget/counter/start time/deadline is reset and no completed effect is
replayed. Pending questions expire at the earliest of 24 hours, conversation
content expiry, or the original execution deadline. This slice conservatively
keeps the original wall-clock deadline: it does not grant extra time for waiting.
The worker must choose an appropriate bounded question or a new user request.
This is stricter than the aspirational wait-exclusion rule in the initial execution
design; implementing a pause-aware cumulative deadline would require separate
accounted elapsed-time state and qualification, and is not inferred here.

Stop invalidates pending questions atomically with its existing run transition.
Maintenance expires waiting runs/questions after input/deadline/content expiry,
including questions already purged by retention. Erasure clears question,
candidates and answer for all run inputs. Conversation retention also clears this
content; normal metadata retention/cascade rules remove receipts later. Receipt
digests/keys contain no answer text and cannot restore erased content. Clients must
discard cached content and late responses after logout/scope changes.

Clarification has `authority: clarification_only`. Selecting a record or typing
"approve" cannot consume an approval, execute a tool or authorize posting/sending.
Awaiting_approval and reconciliation_required are separate, non-answerable states.
Lifecycle/clarification MCP operations remain outside the seven reviewed business
tools available to model dispatch. Truncated/redacted presentation and stored
untrusted answers must never be used as executable tool arguments without fresh
strict domain validation, current authorization and any required approval.
