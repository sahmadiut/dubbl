# Clean-room provenance log

AUD-003 inspection: 2026-10-02 (Asia/Tehran), operator coding-assistant. Fork entry commit: `6431132f124e553ababa43a680f7554e5805c57e`; local upstream baseline: `13c3cf14e7900d32ad0ee8081c385e404dc120f9`. Original LICENSE is unchanged against that local baseline. No tracked upstream NOTICE file was found. This audit imports no external implementation code. A text search is not proof of all historical authorship.

Policy: [ADR-001](../docs/ADR-001-CLEAN-ROOM.md). Distribution index: [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md). Dependency evidence: [inventory](../evidence/AUD-003-license-inventory.json). Source digests: [snapshot record](../evidence/AUD-003-source-snapshots.json).

## Inspected sources

| ID | Source snapshot | Observed role / permitted use |
|---|---|---|
| dubbl-local-license | [13c3cf14e7900d32ad0ee8081c385e404dc120f9](https://github.com/dubbl-org/dubbl/blob/13c3cf14e7900d32ad0ee8081c385e404dc120f9/LICENSE) | Apache-2.0, existing fork baseline; preserve notices |
| bigcapital-license | [a4fb2d9dc3187d5e6940aaac6e922c4103cea09f](https://raw.githubusercontent.com/bigcapitalhq/bigcapital/a4fb2d9dc3187d5e6940aaac6e922c4103cea09f/LICENSE) | GNU AGPL version 3 text; license inspection only, implementation reuse blocked |
| paper-shaders-license | [43cd68db79fa0b1759f72ffc941b3238e2a3954c](https://raw.githubusercontent.com/paper-design/shaders/43cd68db79fa0b1759f72ffc941b3238e2a3954c/LICENSE) | Current upstream Apache-2.0 text; not the installed 0.0.71 MIT license |
| geist-font-license | [9710da1eacb3be272583c3224dcb70f9da6eadbb](https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/geist/OFL.txt) | SIL OFL-1.1; actual generated payload still needs inventory |
| geist-mono-font-license | [9710da1eacb3be272583c3224dcb70f9da6eadbb](https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/geistmono/OFL.txt) | SIL OFL-1.1; actual generated payload still needs inventory |
| playfair-font-license | [9710da1eacb3be272583c3224dcb70f9da6eadbb](https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/playfairdisplay/OFL.txt) | SIL OFL-1.1; actual generated payload still needs inventory |
| bigcapital-api-introduction | [unversioned retrieval](https://docs.bigcapital.app/api-reference/introduction) | Public-contract research entry point; moving documentation, no prose/asset reuse grant |
| apache-gpl-guidance | [unversioned retrieval](https://www.apache.org/licenses/GPL-compatibility.html) | Primary compatibility guidance; not project-specific legal approval |

License snapshots are pinned to repository commits and fetched bytes, with hashes retained. Moving documentation records retain retrieval date/digest but not the whole page; future behavioral claims must capture their own relevant contract version and original specifications. No API implementation or Bigcapital repository source code was fetched. Current snapshots are not proof of future licensing or application artifact contents.

## Change attribution

| Capability / change | Requirements source | Author / commit | Tests / review |
|---|---|---|---|
| Initial requirements | User-supplied plan; sources/SOURCE.md | Existing planning package | Not a product license approval |
| AUD-003 policy and inventory | Actual fork LICENSE/manifests, installed notices, primary license/documentation sources above | coding-assistant; uncommitted working tree | AUD-003-attempt-1.md and AUD-003-review-1.md; self-review |

## Blocking decisions

DEC-004 supersedes the newly proposed licensing review/release gates below: the owner accepted these notes and deferred further licensing work for the private Iran-use fork. Treat unresolved licensing findings as reference, not current task blockers. This is a scope deferral, not license clearance or permission to copy implementation.

No exception permitting Bigcapital implementation reuse has been granted. Block copied/adapted implementation, unlicensed external material and unclear reuse until the exact artifact/use receives appropriate review. Inherited buffers rights, native/copyleft obligations, fonts and branding remain named release gates in ADR-001 and docs/RELEASE_GATES.md. Unknown is not permissive. Task completion is inventory/policy completion, not clearance of those gates.

For each later parity change append source URL/version/digest, original behavioral specification, source exposure, actual implementation author/commit, synthetic tests and attributable review. Preserve original notices. Added dependencies/fonts/assets require their own version-specific provenance.
