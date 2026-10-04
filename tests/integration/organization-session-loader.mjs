// Test-only session/email boundaries; loaded by organization-session-hook.mjs.
export async function load(url, context, nextLoad) {
  if (/\/lib\/auth\.(?:ts|js)$/.test(url))
    return { format: "module", shortCircuit: true, source: "export const auth = async () => globalThis.__organizationFixtureSession ?? null;" };
  if (/\/lib\/email\/resend-client\.(?:ts|js)$/.test(url))
    return { format: "module", shortCircuit: true, source: "export const sendPlatformEmail = async () => {};" };
  return nextLoad(url, context);
}
