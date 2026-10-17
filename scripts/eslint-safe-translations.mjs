// Translation modules must render text or React nodes, never translated HTML.
// This is a code-review guard, not a sandbox for untrusted JavaScript.
/** @type {import("eslint").Rule.RuleModule} */
export const safeTranslationsRule = {
  meta: { type: "problem", schema: [{ type: "object", properties: { allowCatalogAccess: { type: "boolean" } }, additionalProperties: false }], messages: {
    unsafe: "Use typed translations or t.rich with i18n/rich-text tags; raw messages and HTML rendering are forbidden in translation modules.",
  } },
  create(context) {
    let translationModule = false;
    const unsafe = [];
    const forbidden = new Set(["raw", "markup", "useMessages", "getMessages", "dangerouslySetInnerHTML"]);
    if (context.options[0]?.allowCatalogAccess) forbidden.delete("getMessages");
    const key = node => node?.name ?? node?.value;
    return {
      ImportDeclaration(node) {
        if (/^(next-intl|use-intl)(\/|$)/.test(node.source.value) || /(?:^|\/)messages\//.test(node.source.value)) {
          translationModule = true;
          for (const specifier of node.specifiers) {
            if (forbidden.has(key(specifier.imported))) unsafe.push(specifier);
          }
        }
      },
      MemberExpression(node) {
        if (forbidden.has(key(node.property))) unsafe.push(node);
      },
      Property(node) {
        if (forbidden.has(key(node.key))) unsafe.push(node);
      },
      JSXAttribute(node) {
        if (node.name.name === "dangerouslySetInnerHTML") unsafe.push(node);
      },
      "Program:exit"() {
        if (translationModule) for (const node of unsafe) context.report({ node, messageId: "unsafe" });
      },
    };
  },
};
