# AI-002 self-review

2026-10-27, Codex task_002. Self-review by the same agent that implemented the
change; not independent peer/human security or production approval.

Reviewed live identity, permission precedence, org scope and tested transport
behavior against AI-002 and the AI-001 execution contract. Scope includes shared
auth, MCP dispatch wrapping and OAuth minting; no financial posting algorithms,
database schema, Stripe paths, provider calls or activation flags changed.

Confirmed:

1. Removed membership never falls back to token/member roles; current organization
   custom roles are loaded for both API and MCP, with mismatch and empty grants
   handled without privilege fallback. Expired/deleted credentials deny execution.
2. Authenticated MCP closures revalidate their private credential binding at each
   dispatch; live grant changes and session/advisor revocation deny subsequent
   calls on existing transports. The reusable dispatch/resume helper rejects an
   organization mismatch or unknown permission and enforces current operation rights.
3. Registered strict tool inputs and existing organization-qualified resource
   queries prevent tested foreign arguments/IDs from escaping the credential org.
   API-key UI header behavior remains compatible and cannot change stored scope.
4. Site-admin rights are a separate live user check; organization ownership cannot
   access administrative organization REST/MCP operations. Site-admin status does
   not grant ordinary organization administration permissions. Global session
   checks enforce user existence, expiry, issuance and session revocation.
5. Existing locale, team/notification and administrative integration regressions
   passed, plus typecheck, full lint, focused lint, inventory and controller checks.

Acceptance is bounded to this implemented authorization foundation. Actual durable
run/approval storage, allowlist, retry/resume orchestration and approval execution
do not exist yet and remain AI-003/006/007/008 obligations. They must use the
server-created reference and `authorizeExecution`, never deserialize model-provided
identity or use discovery as authorization. Domain services retain resource-level
and accounting guards. A concurrent revocation after dispatch authorization does
not promise rollback of an already executing operation; later worker/reconciliation
tests must preserve the execution contract's transactional boundaries.

Optional full pure suite was interrupted after relevant checks passed and is not
reported as passing. No browser/JWT, live provider, human or release acceptance is
claimed. Approved as an honestly scoped AI-002 implementation for dependent tasks.
