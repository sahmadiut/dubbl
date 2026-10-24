import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

test("landing activity requires visibility, viewport intersection and allowed motion, and cleans up", () => {
  let visible = false, inView = true, reducedMotion = false;
  let effect: () => () => void;
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (event: string, listener: () => void) => {
      assert.equal(event, "visibilitychange");
      listeners.add(listener);
    },
    removeEventListener: (event: string, listener: () => void) => {
      assert.equal(event, "visibilitychange");
      listeners.delete(listener);
    },
  };
  const mod = {exports: {} as {useLandingActivity: () => {isActive: boolean}}};
  const code = ts.transpileModule(readFileSync("components/landing/use-landing-activity.ts", "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  new Function("require", "module", "exports", "document", code)((id: string) => {
    if (id === "react") return {
      useRef: () => ({current: null}),
      useState: () => [visible, (next: boolean) => {visible = next;}],
      useEffect: (fn: typeof effect) => {effect = fn;},
    };
    if (id === "motion/react") return {
      useInView: () => inView,
      useReducedMotion: () => reducedMotion,
    };
    throw new Error(`Unexpected import: ${id}`);
  }, mod, mod.exports, doc);
  const active = () => mod.exports.useLandingActivity().isActive;
  assert.equal(active(), false, "initial render stays paused");
  const cleanup = effect!();
  assert.equal(listeners.size, 1);
  assert.equal(active(), true);
  inView = false;
  assert.equal(active(), false, "offscreen animation pauses");
  inView = true;
  reducedMotion = true;
  assert.equal(active(), false, "reduced motion prevents autoplay");
  reducedMotion = false;
  doc.visibilityState = "hidden";
  listeners.forEach(listener => listener());
  assert.equal(active(), false, "background tab pauses");
  doc.visibilityState = "visible";
  listeners.forEach(listener => listener());
  assert.equal(active(), true, "foreground tab resumes");
  cleanup();
  assert.equal(listeners.size, 0);
});
