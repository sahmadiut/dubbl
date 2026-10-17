import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute the actual component handler with explicit browser/network boundaries.
// This exercises mutation/error branches that initial server rendering cannot.
export function sourceCallback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, `${path}: ${name}`);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}
