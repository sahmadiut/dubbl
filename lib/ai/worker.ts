import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { assertRuntimeEnabled, claimNextRun, heartbeatRun, maintainRuns } from "./run-lifecycle";
import { executeRun } from "./executor";
import type { ProviderTransport } from "./provider-attempts";

const settings = z.object({
  pollMs: z.number().int().min(20).max(30000).default(1000),
  heartbeatMs: z.number().int().min(20).max(10000).default(5000),
  maintenanceMs: z.number().int().min(20).max(30000).default(5000),
  concurrency: z.number().int().min(1).max(2).default(2),
  drainMs: z.number().int().min(0).max(30000).default(10000),
}).strict();
type Settings = z.input<typeof settings>;
export type WorkerEvent = "started" | "claimed" | "settled" | "lease_lost" | "maintenance_failed" | "claim_failed" | "execution_failed" | "stopping";

/** Internal process runner. No client/model supplies options, transport or event
 * callbacks. Events are content-free and never prove worker availability to a
 * user. Polling, renewals and executions are independently bounded/serialized. */
export async function runWorker(options: Settings & { signal: AbortSignal; transport?: ProviderTransport; onEvent?: (event: WorkerEvent) => void }) {
  const { signal, transport, onEvent, ...input } = options, config = settings.parse(input);
  const enabled = () => {
    assertRuntimeEnabled();
    if (!transport && process.env.AI_PROVIDER_CALLS_ENABLED !== "true") throw new Error("AI provider execution is disabled");
  };
  enabled();
  const jobs = new Set<Promise<void>>(), controllers = new Set<AbortController>(), renewals = new Set<AbortController>();
  let stopping = false, nextMaintenance = 0, wake: (() => void) | undefined;
  // Diagnostics cannot become execution authority or leak arbitrary exceptions.
  const emit = (event: WorkerEvent) => { try { onEvent?.(event); } catch { /* Observer only. */ } };
  const stop = () => { if (!stopping) emit("stopping"); stopping = true; for (const controller of controllers) controller.abort(); wake?.(); };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  function start(run: NonNullable<Awaited<ReturnType<typeof claimNextRun>>>) {
    const controller = new AbortController(), finished = new AbortController(); controllers.add(controller); renewals.add(finished);
    if (stopping) controller.abort();
    const renewal = (async () => {
      while (!finished.signal.aborted) {
        try { await delay(config.heartbeatMs, undefined, { signal: finished.signal }); } catch { break; }
        if (finished.signal.aborted) break;
        try { enabled(); await heartbeatRun(run.id, run.leaseOwner!); }
        catch { emit("lease_lost"); controller.abort(); break; }
      }
    })();
    const job = (async () => {
      try {
        await executeRun(run.id, run.leaseOwner!, transport, { signal: controller.signal }); emit("settled");
      } catch { emit("execution_failed"); /* Expired lease recovery owns unfinished work. */ }
      finally { finished.abort(); await renewal; controllers.delete(controller); renewals.delete(finished); }
    })();
    jobs.add(job); void job.finally(() => { jobs.delete(job); wake?.(); });
    emit("claimed");
  }
  emit("started");
  try {
    while (!stopping) {
      try { enabled(); } catch { stop(); break; }
      if (Date.now() >= nextMaintenance) {
        try { await maintainRuns(); } catch { emit("maintenance_failed"); }
        nextMaintenance = Date.now() + config.maintenanceMs;
      }
      if (stopping) break;
      try {
        while (!stopping && jobs.size < config.concurrency) {
          enabled();
          const run = await claimNextRun();
          if (!run) break;
          // A signal or flag change while claim waited cannot start an action.
          try { enabled(); } catch { stop(); }
          start(run);
        }
      } catch { emit("claim_failed"); }
      if (stopping) break;
      await new Promise<void>(resolve => {
        const timer = setTimeout(done, config.pollMs);
        function done() { clearTimeout(timer); wake = undefined; resolve(); }
        wake = done;
      });
    }
  } finally { signal.removeEventListener("abort", stop); stop(); }
  // Abort stops provider requests/new calls immediately. Heartbeats continue
  // during the drain so an in-flight business transaction can settle safely.
  const drained = new AbortController();
  try { await Promise.race([Promise.allSettled([...jobs]), delay(config.drainMs, undefined, { signal: drained.signal })]); }
  finally { drained.abort(); for (const renewal of renewals) renewal.abort(); }
  return { unfinished: jobs.size };
}
