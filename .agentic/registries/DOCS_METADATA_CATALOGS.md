# Documentation chrome and public metadata catalogs (LOC-128)

PublicMetadata owns 22 paired messages for root page title/description, social
title/description/image alt text, 13 descriptive keywords and privacy/terms
page metadata. Docs gains 11 paired messages: the complete page-title wrapper
and all ten Fumadocs UI labels. Existing Docs navigation keys remain in use.
The root and legal routes use Next generateMetadata with the existing request
locale; root Open Graph locale is en_US or fa_IR. English strings retain their
previous exact values, including Fumadocs' formerly implicit English defaults.
The formerly inline Persian Fumadocs labels retain their exact values.

## Preserved contracts and explicit exceptions

- Brand/legal/technical tokens remain literal: dubbl, Dubbl, Mindroot Ltd, ERP,
  CRM, API, MCP, Apache 2.0 and UK GDPR. Brand names in translated metadata are
  retained. The root title template remains `%s · dubbl`; the docs wrapper is a
  complete message with the existing MDX title interpolated as text.
- All canonical/site/author URLs, NEXT_PUBLIC_APP_URL and its dubbl.dev fallback,
  `/og.jpg`, dimensions 1200x630, `/logo.svg`, Apple icon, manifest reference,
  Apple app-title brand, creator/author values, robots settings and Twitter card
  type remain intact. The existing `/manifest.json` reference is preserved;
  this task does not create a manifest or verify availability of linked assets.
- Docs continue choosing `en`/`fa` from the request presentation without URL
  locale prefixes. source.getPageTree, source.getPage, source.getPages/static
  params, notFound, `/`, `/dashboard`, GitHub destination/external flag, TOC/full
  props, clerk TOC style and MDX component rendering are preserved.
- MDX frontmatter titles/descriptions and bodies remain owned by the existing
  bilingual content source, including technical code, legal/provider references
  and frozen Stripe documentation. No content/MDX, Stripe or provider file is
  changed. Public metadata preserves existing product/legal claims; it does
  not certify them, translate legal entity names or change jurisdiction facts.
- Fonts, theme/session providers, cookie/preference precedence, authorization,
  REST/MCP, schema and money contracts remain unchanged. This display-only
  extraction adds no user operation requiring a new MCP tool or DB fixture.

## Verification and limits

tests/docs-metadata-catalogs.test.ts executes production server components and
metadata with real next-intl catalogs. Request/auth/fonts/framework providers
are controlled boundaries; the production root PresentationProvider remains
real. Tests inspect all ten translated values supplied to Fumadocs, render root
and docs content, preserve metadata/link/SEO contracts, exercise both docs
languages, absent/explicit/missing slugs, notFound and static params, and audit
metadata key references and Persian script. Existing landing/pricing/legal
suites cover neighboring pages and frozen legal facts.

Persian wording is provisional. No native/legal linguistic, mounted browser,
keyboard, full RTL, search indexing/crawler, asset/network, provider, production
or release acceptance is claimed. No full build/dev server is run. LOC-122,
LOC-009 and LOC-002 require independent combined acceptance; native and RTL
qualification remain with their own tasks.
