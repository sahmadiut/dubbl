# Risks and controls

All risks originate in the supplied plan unless labeled implementation-system risk. Track each actual finding with severity, owner, evidence, mitigation task and disposition.

| Risk | Primary control / task |
|---|---|
| Incompatible copied implementation code | Clean-room provenance and pinned license review: AUD-003 |
| 32-bit money overflow / fixed cents | Complete manifest and exact-money cutover: MON-001..010 |
| Scaled integer FX / poisoned rates | Exact decimal, explicit direction/provenance/history: MON-004..005 |
| Broken JSON / legacy API consumers | Safe string contracts and compatibility window: MON-006, REL-004 |
| Balance-changing migration | Counts, checksums, financial invariants and restore: MON-010, QA-005 |
| Currency redenomination / guessed toman | Explicit regimes and official dated evidence: MON-009 |
| Duplicated existing Dubbl capabilities | Evidence-based parity audit: AUD-004 |
| Incorrect accounting language | Native accountant glossary and acceptance: L10N-001, L10N-012 |
| RTL only works in dashboard | Full surfaces, PDF goldens, a11y: RTL, L10N, QA-003 |
| Bidi spoofing / malformed financial input | Sensitive identifier policy and strict parser: LOC-003, QA-002 |
| Assumed Iranian provider availability | Optional adapters and deployment review: DATA-005..006, QA-002 |
| Calendar leaks into storage | Canonical Gregorian/UTC boundary: LOC-004 |
| Translation/client performance regression | Server-first architecture and measured budgets: QA-004 |
| Evolving upstream / moving parity target | Pinned snapshot, merge log and maintenance: AUD-001, OPS-001 |
| Tracker records untrue completion | Evidence, honest review and Git review; CLI is not proof of external facts |
| Competing assistants or manual state edits | Single writer, lock, dependency validation; no distributed coordination |
