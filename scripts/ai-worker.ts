// Explicit process entrypoint. Environment is supplied by the operator/host;
// never load .env, seed/migrate a database or enable flags automatically.
export {};
const controller = new AbortController();
let forcedExit: ReturnType<typeof setTimeout> | undefined;
const stop = () => {
  controller.abort();
  // Includes a DB lock wait as well as the normal ten-second drain. A hard
  // process boundary leaves all unfinished work to durable lease recovery.
  forcedExit ??= setTimeout(() => process.exit(1), 15000);
};
process.on("SIGINT", stop); process.on("SIGTERM", stop);
let exitCode = 1;
try {
  if (process.env.AI_RUNTIME_ENABLED !== "true" || process.env.AI_RUNTIME_KILL_SWITCH === "true" || process.env.AI_PROVIDER_CALLS_ENABLED !== "true") throw new Error("disabled");
  const { runWorker } = await import("../lib/ai/worker");
  const result = await runWorker({ signal: controller.signal, onEvent: event => process.stdout.write(`AI_WORKER_${event.toUpperCase()}\n`) });
  exitCode = result.unfinished ? 1 : 0;
} catch { process.stderr.write("AI_WORKER_STOPPED: disabled or unavailable; inspect authorized configuration.\n"); }
finally {
  process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  clearTimeout(forcedExit);
  // Bounded process shutdown: a stuck business call must recover from its
  // durable lease/operation receipt, never from a callback in a dying process.
  process.exit(exitCode);
}
