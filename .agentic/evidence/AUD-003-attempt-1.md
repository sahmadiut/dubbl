# AUD-003 attempt 1: provenance and license inventory

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant (Codex). Repository D:\Projects\dubbl; entry HEAD 6431132f124e553ababa43a680f7554e5805c57e, clean working tree before task claim. Changes remain uncommitted. Windows, existing pnpm installation/node_modules; no fresh install or production artifact examined.

## Audit result and owner scope

Inspected fork LICENSE, tracked notice/asset names, package.json, both lockfiles, root font declarations, installed pnpm license data and selected original package notices. Retrieved only external license files, repository commit metadata and public documentation; no Bigcapital implementation code imported or fetched. A repository text search is not proof of all historical provenance.

Created THIRD_PARTY_NOTICES.md, docs/ADR-001-CLEAN-ROOM.md, source/dependency JSON evidence and an offline inventory script. Updated registries/PROVENANCE.md, docs/RELEASE_GATES.md, docs/DECISIONS.md, START_HERE.md and the task handoff. Original LICENSE is unchanged against local upstream/master. No runtime, dependency, schema, MCP or DB change. A proposed public contribution-guide addition was removed after the owner's clarification.

The owner clarified during this task that the project is their private fork for use in Iran, will not be open source or contributed to upstream Dubbl, and licensing is not currently a priority. They accepted the existing notes and directed us to ignore remaining licensing work and move past this task. DEC-004 records that actual instruction. Further licensing remediation and newly proposed licensing review/release gates are deferred, not passed. Existing notes remain reference; no license clearance, publication permission or copying authorization is inferred.

Observed pnpm inventory: 1,284 package groups, including all 60 direct dependencies (45 runtime, 15 development). Graph rows may include multiple versions; the separate direct_dependencies array records actual root-link versions. Inventory retains manifest declarations separately from pnpm detection and hashes available top-level notices. 2,738 input/manifest/notice hashes were rechecked successfully. JSON paths are relative to the repository.

Findings retained: buffers@0.1.1 has unknown rights in the installed artifact and is reached through exceljs -> unzipper -> binary; Sharp Windows binary has Apache-2.0 AND LGPL-3.0-or-later; MPL packages require candidate-specific handling; installed Paper shaders 0.0.71 LICENSE is MIT while current upstream main LICENSE is Apache-2.0. Font source snapshots identify OFL but do not pin generated application font payloads. Inherited branding assets have no separate provenance file. These are owner-deferred findings under DEC-004, not current execution blockers.

## Acceptance mapping

1. Dependency inventory includes all declared direct dependencies and installed pnpm transitive graph, exact versions, manifest/detected licenses, notice hashes and input hashes. Source snapshots record pinned license commits and dates/digests; moving documentation is explicitly unversioned. Scope excludes uninstalled platform packages and OS/runtime artifact completeness.
2. ADR-001 records public-contract implementation boundaries, contribution checklist, source exposure reporting, original tests and notice retention. Owner's private-project scope supersedes newly proposed licensing enforcement; no public contribution-guide change remains.
3. ADR-001 records a boundary against unclear/incompatible reuse, without importing any such code. Newly proposed licensing-review remediation/release gates are explicitly deferred by the owner under DEC-004; no permission or compatibility determination is invented. Original plan's no-copy implementation boundary remains.

## Verification

All local commands ran from D:\Projects\dubbl.

| Command/procedure | Actual result | Limitation |
|---|---|---|
| python .agentic/agent.py validate/status/context/next | Exit 0; 60-task graph valid, AUD-003 selected and claimed | Structural checks only |
| pnpm licenses list --json | Exit 0; 1,284 package groups | Existing Windows installation, not full production SBOM; initial raw intermediate deleted after sanitized inventory generated |
| python .agentic/scripts/license_inventory.py | Exit 0; inventory written, all 60 direct dependencies found | No package install, top-level notice hashing only; refuses overwriting existing evidence |
| Python verification of inventory input/manifest/notice hashes and direct dependency coverage | Exit 0; 2,738 hashes verified, 60 direct names covered, relative paths confirmed | Installed package contents, not distribution payload |
| Re-run inventory script as overwrite-negative check | Script rejected existing file; assertion harness exit 0 | Expected rejection, preserved evidence |
| pnpm why buffers; pnpm why @img/sharp-win32-x64 | Exit 0; runtime paths recorded above | Dependency reachability, not proof of shipped payload |
| Primary-source retrieval using web and Python urllib | Successful; eight snapshot records including local Dubbl license, five pinned external license files and two moving documentation pages | Repository commits are license-source snapshots, not installed package versions; no source-code reuse grant |
| git diff --exit-code upstream/master -- LICENSE | Exit 0; no license change | Local upstream ref, no fetch/freshness claim |
| npx tsc --noEmit | Exit 0 | Existing generated sources; no full build/dev startup |
| git diff --check | Exit 0 before final handoff; final check repeated | LF/CRLF notices only |

Initial guessed top-level paths for transitive packages did not exist; corrected using paths returned by pnpm. A PowerShell literal wildcard passed to rg was invalid; pnpm why supplied the verified dependency chain. No findings depend on those failed lookups.

Not run: lint/application tests (no runtime change), build, dev server, Docker, dependency install, DB queries/mutations, migrations, deploy, production bundle inspection, font generation, or licensing remediation deferred by owner. Controller state transitions and final document links are checked separately in self-review.

## Review and handoff

Self-review by coding-assistant, not independent/human licensing review; see AUD-003-review-1.md. Close this bounded audit with owner's scope decision recorded. AUD-002 retains its dev-start blocker. Next ready task after closure is AUD-004, public-contract capability audit; defer licensing follow-up per DEC-004. Stop after this one task.
