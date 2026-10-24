# Mixed-text control foundation

Owner task: [RTL-006](../tasks/RTL-006.md), child of [RTL-002](../tasks/RTL-002.md).

## Shared contracts

- [`BidiText`](../../components/ui/bidi-text.tsx) renders a native `bdi` with
  `dir=auto` and CSS isolation. It does not parse, normalize, insert Unicode
  markers, translate, trim or otherwise rewrite caller text. React escapes text.
- `IdentifierText` defaults to `dir=ltr`, with explicit caller direction overrides
  retained. Identifiers remain selectable, use tabular numerals/monospace, preserve
  whitespace, and wrap at arbitrary positions when their containing layout needs
  to shrink. Email, URL, IBAN, UUID, document ID and long key examples are tested.
- [`Input`](../../components/ui/input.tsx) defaults only native `type=email` and
  `type=url` controls to LTR with isolation and start alignment. A caller's explicit
  `dir` wins. Generic text, search, number, password and date controls retain their
  inherited direction. Type, name, value, validation, ref, errors, accessibility
  descriptions and callback data pass through unchanged. This is presentation,
  not an identifier validator or Unicode spoofing/security normalization policy.
- [`ApiKeyFields`](../../components/settings/api-key-fields.tsx) adopts the real
  identifier display with a shrinkable code container. Name creation has an
  associated label and `dir=auto`; copy/name callbacks retain exact strings.

## Current semantic-input adoption

Source scan at the task's verified snapshot finds 13 existing native-email
`Input` call sites and no literal native-URL `Input` call sites. These inherit the
shared default without page edits:

| Source | Email controls |
| --- | ---: |
| `app/(dashboard)/settings/page.tsx` | 1 |
| `app/(dashboard)/settings/advisors/page.tsx` | 1 |
| `app/(dashboard)/settings/members/page.tsx` | 1 |
| `app/(dashboard)/payroll/employees/[id]/page.tsx` | 1 |
| `app/(dashboard)/payroll/contractors/[id]/page.tsx` | 1 |
| `app/(dashboard)/contacts/[id]/page.tsx` | 1 |
| `app/(dashboard)/contacts/[id]/people/page.tsx` | 1 |
| `app/(auth)/sign-in/page.tsx` | 1 |
| `app/(auth)/sign-up/page.tsx` | 1 |
| `components/dashboard/create-drawer.tsx` | 3 |
| `components/dashboard/send-document-dialog.tsx` | 1 |

This lexical literal-type census is not a claim that all identifiers are adopted:
dynamic type props, native HTML inputs, displayed metadata, IBAN/account/reference
fields, document IDs and output templates remain RTL-008 audit responsibilities.

## Ownership and review limits

RTL-007 owns approved local font delivery/notice and typography review. RTL-008
owns actual domain tables/forms/headers/errors/totals, charts/tooltips, metadata,
portal/output and long-translation/narrow-width/zoom/text-spacing hardening.
RTL-002 independently accepts their combination against its unchanged criteria.

Real React/provider controls, exact event callbacks and installed Tailwind CSS
are tested. SSR and emitted CSS do not prove computed clipping, selection/caret
geometry, zoom, screen-reader output or mounted visual/focus behavior. No such
browser/native/accounting/output review is claimed. DEC-005 removes screenshots
as a requirement, not actual behavioral/layout/accessibility review.

No new user operation, endpoint, DB schema or MCP tool is introduced. Existing
REST/MCP values, money amounts/scales, ISO codes, identifiers, snapshots, export
and document/email/PDF contracts are unchanged. No dedicated/frozen Stripe source
is modified. External primary-worktree edits remain outside this task snapshot.
