# ADR-001: Public-contract parity and provenance

Date: 2026-10-02 (Asia/Tehran). Status: implements the supplied project requirement; not a legal opinion or a new owner approval. Task: AUD-003.

Owner scope update, DEC-004 (2026-10-02): this is the owner's private fork for use in Iran, with no planned open-source release or contribution to upstream Dubbl. The owner accepted the notes already written and deferred further license/provenance work. The checklist and findings below are retained as audit reference; their newly proposed review/release gates are deferred and must not block current project tasks. This decision does not change third-party license terms or grant reuse rights. The original plan's no-copy implementation boundary remains; no copying was requested.

## Context and decision

Dubbl remains the runtime and its existing Apache-2.0 license and notices remain intact. Bigcapital is a behavioral reference. Its pinned LICENSE identifies GNU AGPL version 3; see [source snapshots](../evidence/AUD-003-source-snapshots.json). We independently implement selected behavior from public contracts and synthetic observations. We do not import, translate, adapt or paraphrase Bigcapital implementation code, tests, migrations, internal algorithms, UI source, assets or documentation prose into the product.

Allowed inputs are public API field names, request/response shapes, documented behavior, and authorized observations using synthetic data. Write original requirements describing observable outcomes, intentional differences and negative cases. Documentation access does not establish permission to copy prose, examples, screenshots or assets. No source-code inspection is necessary for parity research; access to repository metadata and license files for provenance is separately recorded.

This is a project boundary, not a claim that all copyleft software is incompatible. The [Apache compatibility guidance](https://www.apache.org/licenses/GPL-compatibility.html) explains that compatibility is directional. Dependency-specific conditions still apply; LGPL, MPL and dual-license expressions require their own review. Never treat a permissive application license as relicensing dependencies.

## Contribution checklist

Before implementing parity:

- Record public source URL, retrieval date, version/commit or content digest, and what behavior it supports in [PROVENANCE](../registries/PROVENANCE.md). A moving page needs a new dated capture; a license snapshot is not an API snapshot.
- Write an original behavior specification and synthetic input/output examples. Record any implementation-source exposure; do not claim an independent clean-room process if the implementer inspected that source. Stop affected reuse and seek a documented rights/review decision, or assign an unexposed implementer if a stricter separation is required.
- Check existing Dubbl schema/domain/API/UI/MCP paths before adding functionality. Preserve organization scope, authorization, locks, audit and money contracts.
- Implement from Dubbl patterns; create original tests for observable behavior and negative cases. Record actual author, commit when committed, test command/results and reviewer kind. A self-review is not independent or human approval.

Before adding any dependency, font, icon, image, copied snippet or other asset:

- Pin the exact artifact and source; inspect its license text, copyright and NOTICE files, including embedded components. Record hashes and retention obligations. Missing metadata is unresolved, never inferred permissive.
- Update [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md) and the inventory with a new attempt. Select and record a permitted branch for dual-license expressions; satisfy every term of an AND expression. Do not replace original notice texts with generated summaries.
- Block unlicensed, incompatible, source-derived or unclear reuse pending an attributable licensing decision. Keep it out of merges/releases until the decision identifies the exact artifact, intended use, obligations and reviewer. Generic task continuation is not such approval.

Before distributing a release:

- Inventory the actual platform and bundle, including standalone/server native binaries, client assets, generated fonts and container OS packages where applicable. Development packages in this audit are not proof of shipment.
- Include required original license, copyright and NOTICE texts with the distributed artifact; handle source/relinking obligations where applicable. Inspect the artifact to verify inclusion. Resolve every open gate below and record candidate-specific evidence in REL-001/QA-002.

## Current review gates

| Gate | Observed evidence | Required resolution |
|---|---|---|
| Bigcapital reuse | Pinned AGPL-3.0 license; no Bigcapital code imported by AUD-003 | Block copied/adapted implementation or assets. Public-contract research may proceed under this boundary. |
| `buffers@0.1.1` | pnpm reports Unknown; installed manifest has no license and no top-level license file. Runtime path: exceljs -> unzipper -> binary -> buffers. | Block release approval for any candidate shipping this artifact until version-specific rights evidence or an independently verified replacement is recorded. Do not silently delete the working dependency. |
| Sharp/libvips | Windows `@img/sharp-win32-x64@0.34.5`: Apache-2.0 AND LGPL-3.0-or-later, via next -> sharp | Inspect actual target-platform native payload, notices, applicable source/relinking requirements and distribution evidence before release. Windows inspection does not qualify Linux containers. |
| MPL packages | axe-core@4.11.1, lightningcss@1.31.1, lightningcss-win32-x64-msvc@1.31.1 | Determine candidate reachability, modifications and required notices/source handling; do not label the whole graph Apache-only. |
| Paper shaders | Installed 0.0.71 LICENSE is MIT; manifest points to moving GitHub LICENSE now Apache-2.0 | Use the pinned installed/tarball license for the shipped version. Recheck on upgrade; moving-main license is not evidence of 0.0.71 terms. |
| Fonts | Geist, Geist Mono, Playfair Display requested through next/font/google; current official font-license snapshots identify OFL-1.1 | Inventory actual generated font payloads and deliver their notices. Current Google Fonts repository commit does not pin already generated local artifacts. Future Persian fonts require separate evidence. |
| Upstream branding/assets | public/ contains inherited logos, icons and OG images; no asset-specific provenance file found | Preserve upstream assets/notices; verify asset provenance and branding permissions before external release. No grant of trademark rights is inferred. |

## Consequences and limitations

AUD-003 establishes the inventory and blocking policy; it does not approve production distribution, certify licensing compliance, or remediate every inherited dependency. These named findings remain release gates even when this task is done. No runtime, dependency, schema or financial behavior changes are required for this audit. No application MCP operation is added by these repository policy documents.
