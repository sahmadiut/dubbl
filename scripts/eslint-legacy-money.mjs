import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyPath = path.join(root, "lib", "money");
function isLegacy(source, filename) {
  if (typeof source !== "string") return false;
  if (source === "@/lib/money" || source === "@/lib/money.ts") return true;
  return source.startsWith(".") && path.resolve(path.dirname(filename), source).replace(/\.ts$/, "") === legacyPath;
}

/** Existing imported-binding reference counts are a ceiling, never a license for new use. */
export function legacyMoneyRule(baseline, record) {
  return {
    meta: { type: "problem", schema: [], messages: { deprecated: "New legacy money usage is forbidden. Use lib/money/exact with explicit currency and rounding." } },
    create(context) {
      const imports = [];
      const filename = context.filename;
      const relative = path.relative(root, filename).replaceAll("\\", "/");
      return {
        ImportDeclaration(node) {
          if (isLegacy(node.source.value, filename)) imports.push(node);
        },
        ExportNamedDeclaration(node) {
          if (node.source && isLegacy(node.source.value, filename)) context.report({ node, messageId: "deprecated" });
        },
        ExportAllDeclaration(node) {
          if (isLegacy(node.source.value, filename)) context.report({ node, messageId: "deprecated" });
        },
        ImportExpression(node) {
          if (isLegacy(node.source.value, filename)) context.report({ node, messageId: "deprecated" });
        },
        CallExpression(node) {
          if (node.callee.type === "Identifier" && node.callee.name === "require" && isLegacy(node.arguments[0]?.value, filename))
            context.report({ node, messageId: "deprecated" });
        },
        "Program:exit"() {
          const usage = {};
          for (const node of imports) {
            for (const variable of context.sourceCode.getDeclaredVariables(node)) {
              const specifier = node.specifiers.find(s => s.local.name === variable.name);
              const imported = specifier?.type === "ImportSpecifier" ? specifier.imported.name ?? specifier.imported.value : "*";
              // Include the import itself so unused new imports are also forbidden.
              usage[imported] = (usage[imported] ?? 0) + 1 + variable.references.length;
            }
            if (!node.specifiers.length) usage["side-effect"] = (usage["side-effect"] ?? 0) + 1;
          }
          if (record) { if (imports.length) record(relative, usage); return; }
          for (const [name, count] of Object.entries(usage)) {
            if (count > (baseline[relative]?.[name] ?? 0)) context.report({ node: imports[0], messageId: "deprecated" });
          }
        },
      };
    },
  };
}
