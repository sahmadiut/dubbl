// Read-only source inventory, not an authorization evaluator or agent allowlist.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const output = ".agentic/registries/AI_CAPABILITIES.json";
const posix = (value) => value.replaceAll("\\", "/");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const parse = (name) => ts.createSourceFile(name, read(name), ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); };
const files = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]).sort();
const unique = (values) => [...new Set(values)].sort();
const literal = (node) => node && ts.isStringLiteralLike(node) ? node.text : null;
const uncast = (node) => ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? uncast(node.expression) : node;
const namesFor = (node, argument) => {
  if (literal(argument)) return [literal(argument)];
  if (argument.getText() === "op.name" && node.getSourceFile().fileName === "lib/mcp/tools/project-master.ts") {
    const operations = parse("lib/api/project-master-operations.ts");
    const names = [];
    walk(operations, (part) => {
      if (ts.isCallExpression(part) && part.expression.getText(operations) === "operation") {
        const name = literal(part.arguments[0]);
        if (!name) throw new Error("Nonliteral project operation");
        names.push(name);
      }
    });
    if (!names.length) throw new Error("No project operations found");
    return names;
  }
  if (ts.isTemplateExpression(argument) && argument.templateSpans.length === 1) {
    const span = argument.templateSpans[0];
    return namesFor(node, span.expression).map((name) => `${argument.head.text}${name}${span.literal.text}`);
  }
  // Current registry also has literal tuple loops (e.g. approval actions).
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isArrowFunction(parent) && ts.isVariableDeclaration(parent.parent)) {
      const index = parent.parameters.findIndex((parameter) => parameter.name.getText() === argument.getText());
      if (index >= 0) {
        let ast = parent;
        while (ast.parent) ast = ast.parent;
        const names = [];
        walk(ast, (call) => {
          if (ts.isCallExpression(call) && call.expression.getText() === parent.parent.name.getText()) {
            const name = literal(call.arguments[index]);
            if (!name) throw new Error("Dynamic registration helper requires manual inventory");
            names.push(name);
          }
        });
        if (names.length) return names;
      }
    }
    if (!ts.isForOfStatement(parent) || !ts.isVariableDeclarationList(parent.initializer)) continue;
    const binding = parent.initializer.declarations[0].name;
    const values = uncast(parent.expression);
    if (!ts.isArrayLiteralExpression(values)) continue;
    if (ts.isIdentifier(binding) && binding.text === argument.getText()) {
      return values.elements.map((element) => {
        const name = literal(element);
        if (!name) throw new Error("Nonliteral tool loop requires manual inventory");
        return name;
      });
    }
    if (!ts.isArrayBindingPattern(binding)) continue;
    const index = binding.elements.findIndex((element) => element.name?.getText() === argument.getText());
    if (index < 0) continue;
    return values.elements.map((element) => {
      const tuple = uncast(element);
      const name = ts.isArrayLiteralExpression(tuple) ? literal(tuple.elements[index]) : null;
      if (!name) throw new Error("Nonliteral dynamic tool tuple requires manual inventory");
      return name;
    });
  }
  throw new Error(`Dynamic tool name requires manual inventory: ${argument.getText()}`);
};
const registry = parse("lib/mcp/tools/index.ts");
const registeredModules = [];
for (const statement of registry.statements) {
  if (ts.isImportDeclaration(statement) && literal(statement.moduleSpecifier)?.startsWith("./")) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) throw new Error("Unsupported MCP registry import");
    const moduleName = literal(statement.moduleSpecifier).slice(2);
    for (const element of bindings.elements) {
      let called = false;
      walk(registry, (node) => { if (ts.isCallExpression(node) && node.expression.getText(registry) === element.name.text) called = true; });
      if (!called) throw new Error(`MCP import not registered: ${element.name.text}`);
    }
    registeredModules.push(moduleName);
  }
}
const tools = [];
const modules = [];
for (const moduleName of unique(registeredModules)) {
  const source = `lib/mcp/tools/${moduleName}.ts`;
  const ast = parse(source);
  const imports = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = literal(statement.moduleSpecifier);
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) imports.set(element.name.text, from);
    }
  }
  const moduleTools = [];
  walk(ast, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.expression.getText(ast) !== "server" || !["tool", "registerTool"].includes(node.expression.name.text)) return;
    const names = namesFor(node, node.arguments[0]);
    const handler = node.arguments.at(-1);
    const directPermissions = [];
    const serviceCalls = [];
    let directDatabase = false;
    walk(handler, (part) => {
      if (ts.isCallExpression(part)) {
        const called = part.expression.getText(ast);
        if (called === "requireRole") directPermissions.push(literal(part.arguments[1]) ?? `DYNAMIC:${part.arguments[1]?.getText(ast)}`);
        if (imports.get(called)?.startsWith("@/lib/")) serviceCalls.push(`${imports.get(called)}#${called}`);
      }
      if (ts.isIdentifier(part) && part.text === "db") directDatabase = true;
    });
    const description = node.expression.name.text === "tool"
      ? literal(node.arguments[1])
      : node.arguments[1]?.properties?.find((property) => property.name?.getText(ast) === "description")?.initializer;
    for (const name of names) tools.push({
      name, module: moduleName, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      description: typeof description === "string" ? description : literal(description) ?? description?.getText(ast) ?? node.arguments[1]?.getText(ast),
      directPermissions: unique(directPermissions), directImportedCalls: unique(serviceCalls), directDatabase,
      exposure: "disabled-pending-AI-006-review",
    });
    moduleTools.push(...names);
  });
  if (!moduleTools.length) throw new Error(`Registered module has no inventoried tools: ${source}`);
  modules.push({ module: moduleName, source, tools: moduleTools.sort(), apiImports: unique([...imports.values()].filter((value) => value?.startsWith("@/lib/api/"))) });
}
const duplicates = tools.filter((tool, index) => tools.findIndex((other) => other.name === tool.name) !== index);
if (duplicates.length) throw new Error(`Duplicate MCP names: ${duplicates.map((tool) => tool.name).join(", ")}`);
const routes = files("app/api").filter((file) => file.endsWith("/route.ts")).map((source) => {
  const ast = parse(source);
  const methods = [];
  walk(ast, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && ["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"].includes(node.name.text) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) methods.push(node.name.text);
    if (ts.isVariableStatement(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) if (["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"].includes(declaration.name.getText(ast))) methods.push(declaration.name.getText(ast));
    }
  });
  return { source: posix(source), methods: unique(methods), domain: source.split("/")[2] === "v1" ? source.split("/")[3] : `public:${source.split("/")[2]}` };
});
const pages = files("app").filter((file) => file.endsWith("/page.tsx")).map(posix);
const inventory = {
  version: 1,
  interpretation: "Static source discovery only. Direct permissions/calls exclude transitive helpers and dynamic guards. Empty permissions are NOT permissionless. Names/descriptions do not prove reads, safe writes, shared-service parity or authorization. All tools remain disabled for chat until individually reviewed in AI-006.",
  counts: { modules: modules.length, tools: tools.length, apiRoutes: routes.length, pages: pages.length },
  modules, tools: tools.sort((a, b) => a.name.localeCompare(b.name, "en")), routes, pages,
};
const encoded = JSON.stringify(inventory, null, 2) + "\n";
if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(root, output), encoded, "utf8");
  console.log(`Wrote ${output}: ${JSON.stringify(inventory.counts)}`);
} else {
  if (read(output).replaceAll("\r\n", "\n") !== encoded) throw new Error(`AI capability source drift; inspect and run node scripts/audit-ai-capabilities.mjs --write`);
  console.log(`AI capability inventory matches source: ${JSON.stringify(inventory.counts)}`);
}
