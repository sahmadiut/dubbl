import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";

const noop = () => {};

test("functional currency picker blocks disabled IRR callbacks without changing reference pickers", () => {
  const path = "components/ui/currency-select.tsx";
  const require = createRequire(resolve(path));
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const currencies = ["USD", "IRR"].map(code => ({ id: code, code, name: code, symbol: code, decimalPlaces: code === "IRR" ? 0 : 2 }));
  let state = 0;
  const load = (id: string) => {
    if (id === "react") return { ...React, useEffect: noop, useState: () => [state++ % 2 === 0 ? false : currencies, noop] };
    if (id === "next-intl") return { useTranslations: () => (key: string) => key };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const compiled = { exports: {} as { CurrencySelect: (props: Record<string, unknown>) => React.ReactNode } };
  new Function("require", "module", "exports", source)(load, compiled, compiled.exports);
  function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
    if (!React.isValidElement<Record<string, unknown>>(node)) return [];
    return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(elements)];
  }
  for (const disabledCodes of [["IRR"], []]) {
    const selected: string[] = [];
    let tree: React.ReactElement<Record<string, unknown>>[] = [];
    function Probe() {
      tree = elements(compiled.exports.CurrencySelect({ value: "USD", onValueChange: (code: string) => selected.push(code), disabledCodes, "aria-describedby": "policy-help" }));
      return null;
    }
    renderWithPresentation(React.createElement(Probe));
    assert.equal(tree.find(node => node.props.role === "combobox")?.props["aria-describedby"], "policy-help");
    for (const code of ["IRR", "USD"]) {
      const item = tree.find(node => typeof node.props.value === "string" && node.props.value.startsWith(`${code} `));
      assert.ok(item);
      assert.equal(item.props.disabled, disabledCodes.includes(code));
      (item.props.onSelect as () => void)();
    }
    assert.deepEqual(selected, disabledCodes.length ? ["USD"] : ["IRR", "USD"]);
  }
});
