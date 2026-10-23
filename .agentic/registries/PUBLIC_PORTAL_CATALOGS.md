# Public portal catalog inventory (LOC-121)

The six app/portal/[token] layout/page files use the paired PublicPortal catalog
for navigation, overview, invoice list, quotes, payment history and statements.
Known statuses are localized for display; unknown statuses use a reviewed label.
Machine comparisons, payable statuses, routes, tokens and POST payloads are retained.

## Exceptions

- app/pay/[token]/page.tsx is the Stripe checkout/redirect flow. The entire file,
  including display prose, is preserved under DEC-008 and the owner scope freeze.
- Organization/contact names, invoice/quote numbers, statement descriptions and
  other saved user data remain verbatim, escaped by React.
- Currency codes and documentMoneyText output retain the existing exact-money
  contract. ISO date strings and payment history's existing browser date formatter
  remain unchanged; calendar/numeral formatting is separate qualification work.
- API/PDF paths, opaque tokens/IDs, query names, filenames (statement.pdf and
  invoice-number.pdf), status values, CSS and icon names remain machine contracts.
- Internal clientJson diagnostic strings are caught and replaced by catalog errors;
  they are not shown to the visitor. Missing payment date retains the dash marker.
- Downloaded documents and server-produced statement descriptions are outside
  this display-catalog slice. Existing REST/MCP implementations are unchanged.

Persian wording is provisional. Native terminology review, mounted browser,
keyboard, full RTL, calendar/numeral and provider qualification remain open.
LOC-009 and LOC-002 retain independent acceptance.
