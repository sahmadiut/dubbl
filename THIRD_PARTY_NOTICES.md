# Third-party notices and license inventory

Audited 2026-10-02 for AUD-003. Dubbl source remains under the unchanged [Apache-2.0 LICENSE](LICENSE). Third-party components retain their own licenses and notices; this index does not relicense them.

Owner scope DEC-004: this is a private fork for use in Iran. The owner accepted these notes and deferred further licensing work. The review/release gates described below are retained as reference and do not block current project tasks. No public distribution or upstream contribution is planned.

This is an audit index, not a complete distribution notice bundle. The [installed-graph inventory](.agentic/evidence/AUD-003-license-inventory.json) records 1,284 pnpm package groups, all 60 direct dependencies (45 runtime, 15 development), resolved versions, original manifest declarations, pnpm detection and available top-level notice paths/hashes. Package groups can contain multiple versions. It includes development dependencies and Windows-installed packages; no claim of complete Linux/production-bundle coverage. `package.json`, both lockfiles and LICENSE hashes are recorded. The npm lockfile is fingerprinted, not treated as the pnpm dependency graph. Embedded/nested notices and OS packages require candidate inspection.

Original license/copyright/NOTICE files must accompany distributions wherever their terms require it. Retain upstream notices and changed-file notices. The paths/hashes in the inventory locate the original package texts in the existing installation; package-manager license detection is evidence, not legal approval. A packaged release must carry the required texts, rather than relying on links to ignored node_modules. See [ADR-001](.agentic/docs/ADR-001-CLEAN-ROOM.md) for contribution and release checks.

## Direct dependencies

Versions below are resolved from root node_modules links, rather than every transitive version with the same name. The manifest declaration is shown verbatim; external URLs and unusual expressions require inspection of the pinned artifact.

| Package | Resolved version | Use | Manifest license |
|---|---|---|---|
| @auth/drizzle-adapter | 1.11.1 | runtime | ISC |
| @aws-sdk/client-s3 | 3.1000.0 | runtime | Apache-2.0 |
| @aws-sdk/s3-request-presigner | 3.1000.0 | runtime | Apache-2.0 |
| @dnd-kit/core | 6.3.1 | runtime | MIT |
| @dnd-kit/sortable | 10.0.0 | runtime | MIT |
| @dnd-kit/utilities | 3.2.2 | runtime | MIT |
| @modelcontextprotocol/sdk | 1.27.1 | runtime | MIT |
| @paper-design/shaders-react | 0.0.71 | runtime | SEE LICENSE IN https://github.com/paper-design/shaders/blob/main/LICENSE |
| @react-email/components | 1.0.9 | runtime | MIT |
| @react-email/render | 2.0.4 | runtime | MIT |
| @react-pdf/renderer | 4.3.2 | runtime | MIT |
| @tailwindcss/postcss | 4.2.1 | development | MIT |
| @trigger.dev/sdk | 4.4.6 | runtime | MIT |
| @types/bcryptjs | 2.4.6 | development | MIT |
| @types/mdx | 2.0.13 | runtime | MIT |
| @types/node | 20.19.35 | development | MIT |
| @types/nodemailer | 7.0.11 | runtime | MIT |
| @types/pg | 8.18.0 | development | MIT |
| @types/react | 19.2.14 | development | MIT |
| @types/react-dom | 19.2.3 | development | MIT |
| bcryptjs | 3.0.3 | runtime | BSD-3-Clause |
| class-variance-authority | 0.7.1 | runtime | Apache-2.0 |
| clsx | 2.1.1 | runtime | MIT |
| cmdk | 1.1.1 | runtime | MIT |
| date-fns | 4.1.0 | runtime | MIT |
| drizzle-kit | 0.31.9 | development | MIT |
| drizzle-orm | 0.45.1 | runtime | Apache-2.0 |
| eslint | 9.39.3 | development | MIT |
| eslint-config-next | 16.1.6 | development | MIT |
| exceljs | 4.4.0 | runtime | MIT |
| fumadocs-core | 16.6.8 | runtime | MIT |
| fumadocs-mdx | 14.2.9 | runtime | MIT |
| fumadocs-ui | 16.6.8 | runtime | MIT |
| jose | 6.2.1 | runtime | MIT |
| jsbarcode | 3.12.3 | runtime | MIT |
| lucide-react | 0.575.0 | runtime | ISC |
| motion | 12.34.3 | runtime | MIT |
| nanoid | 5.1.6 | runtime | MIT |
| next | 16.1.6 | runtime | MIT |
| next-auth | 5.0.0-beta.30 | runtime | ISC |
| next-themes | 0.4.6 | runtime | MIT |
| nextjs-toploader | 3.9.17 | runtime | MIT |
| nodemailer | 8.0.1 | runtime | MIT-0 |
| pg | 8.19.0 | runtime | MIT |
| radix-ui | 1.4.3 | runtime | MIT |
| react | 19.2.4 | runtime | MIT |
| react-day-picker | 9.14.0 | runtime | MIT |
| react-dom | 19.2.4 | runtime | MIT |
| recharts | 3.7.0 | runtime | MIT |
| resend | 6.9.3 | runtime | MIT |
| shadcn | 3.8.5 | development | MIT |
| sonner | 2.0.7 | runtime | MIT |
| stripe | 20.4.0 | runtime | MIT |
| tailwind-merge | 3.5.0 | runtime | MIT |
| tailwindcss | 4.2.1 | development | MIT |
| trigger.dev | 4.4.6 | development | MIT |
| tsx | 4.21.0 | development | MIT |
| tw-animate-css | 1.4.0 | development | MIT |
| typescript | 5.9.3 | development | Apache-2.0 |
| zod | 4.3.6 | runtime | MIT |

## Additional components and open gates

- Bigcapital: GNU AGPL version 3 license identified at the pinned source snapshot. No Bigcapital implementation imported by this audit. It is a public-behavior reference under the clean-room policy, not a shipped dependency. Copying/adaptation is blocked pending a documented rights decision.
- `buffers@0.1.1`: unknown license in the installed artifact, via runtime exceljs -> unzipper -> binary. Release approval for candidates containing it is blocked pending version-specific rights evidence or a verified replacement.
- `@img/sharp-win32-x64@0.34.5`: Apache-2.0 AND LGPL-3.0-or-later; inspect the actual release platform and embedded libvips notices/source obligations.
- MPL-2.0: axe-core@4.11.1, lightningcss@1.31.1 and lightningcss-win32-x64-msvc@1.31.1; determine shipping scope and fulfill applicable conditions.
- jszip@3.10.1: `(MIT OR GPL-3.0-or-later)`; use the MIT alternative and retain its notice when distributing. Other AND/OR expressions remain recorded verbatim in the full inventory.
- caniuse-lite@1.0.30001775: CC-BY-4.0 dataset attribution; preserve its notices if included.
- Paper shaders/react 0.0.71: packaged LICENSE is MIT, including its original copyright notice. pnpm detects MIT. Its manifest links to the current upstream LICENSE, now Apache-2.0; do not substitute that moving text for the installed version.
- Geist, Geist Mono and Playfair Display: requested in app/layout.tsx through next/font/google. Pinned official license snapshots identify SIL OFL-1.1; generated payload versions and distribution notice inclusion remain unverified. No Persian font has been added.
- Inherited public/ logos, app icons and OG images: no separate asset notice/provenance file found. Preserve them and verify origin/branding rights before external release.

Source URLs, repository commits, retrieval dates and SHA-256 digests are in [PROVENANCE](.agentic/registries/PROVENANCE.md) and the [source snapshot record](.agentic/evidence/AUD-003-source-snapshots.json). Full audit outcomes and limitations are in [AUD-003 evidence](.agentic/evidence/AUD-003-attempt-1.md). Completion of this audit does not clear its release gates.
