# Contact people and files catalogs

LOC-057 covers these two complete production routes:

- `app/(dashboard)/contacts/[id]/people/page.tsx`: section heading/description,
  empty guidance, add/cancel form, field labels/placeholders, primary badge,
  ICU people count, success and operation failure messages.
- `app/(dashboard)/contacts/[id]/files/page.tsx`: heading/description, empty
  guidance, visibility choices/badges, upload/busy labels, ICU file count,
  table headers, delete confirmation, accessible download/delete buttons,
  read/upload/download/delete success and failure messages.

`ContactPeople` (19) and `ContactFiles` (22) add 41 paired keys, bringing each
catalog to 2,962 compatible keys. All Persian copy is provisional pending native
linguistic review; key parity is not Persian terminology or RTL approval.

## Explicit exceptions and contracts

Caller data remains untouched and React-escaped: person names, email, phone,
job titles, initials and file names. No caller prose or canonical values become
translation keys. `organization`/`private`, `isPrimary`, contact/document IDs,
`activeOrgId`, MIME types, field names, API paths, HTTP methods, organization
headers, signed upload/download URLs, byte sizes and uploaded bytes stay machine
values. POST metadata and signed PUT retain their existing split; no tenant
header is sent to the storage URL. Empty optional person fields still become
null; failed submissions keep form data and successful submissions reset it.

`B`/`KB`/`MB` are technical unit symbols. Existing file-size scaling/rounding
and `toLocaleDateString()` date presentation remain unchanged for the dedicated
number/date adapters. CSS classes, layout, animation, required/email input
semantics and technical DOM IDs remain unchanged. Generic UI primitives and
confirmation buttons use their existing shared catalogs. Financial tabs and
their exact-money/date/status presentation belong to LOC-060; no money code,
REST handler, database schema, migration or IRR rollout flag changed here.

Failures now use complete translated operation messages rather than raw server
or network prose. File reads reject unsuccessful HTTP responses and malformed
list envelopes. Upload success requires both metadata and storage PUT success;
download rejects unsuccessful HTTP responses and missing URLs. These checks
preserve request contracts and do not change storage cleanup/pagination policy.

## Existing MCP coverage and remaining scope

`get_contact` returns contact people. `list_contact_files`/`upload_contact_file`
and generic `list_entity_files`/`attach_file_to_entity` already cover contact
attachment listing and upload metadata through direct DB access. Current source
has no MCP add-person operation or generic file download/delete tool; these are
pre-existing parity gaps, not implemented or claimed resolved by extraction.
No user operation or REST API was added or changed. Do not describe the UI-only
localization acceptance as full transport parity or security qualification.

LOC-058 owns contact list/picker/creation; LOC-059 owns detail layout/overview;
LOC-060 owns bookkeeping/activity/statements. LOC-027/007/002 retain independent
combined acceptance. Native Persian, number/date adapters, complete RTL, browser
layout, hosted CI and production qualification remain separate. Stripe remains
unchanged under DEC-008.

## Verification boundaries

`tests/contact-people-files-catalogs.test.ts` renders the real production
templates, shared UI, React and next-intl through `PresentationProvider` with
controlled hooks/navigation/contact context. Both locales cover empty, loaded,
primary, busy, form, count, file size and escaped caller-data states. Actual
production callback bodies run against controlled network/confirmation IO and
verify exact paths, headers, payloads, nulls, canonical visibility/MIME values,
storage bytes, retry resets, cancellation, missing organization and
HTTP/JSON/envelope/network failures. A source audit rejects unextracted JSX and
display attributes and verifies Persian script. These are behavioral/rendering
checks, not mounted browser or live object-storage qualification.
