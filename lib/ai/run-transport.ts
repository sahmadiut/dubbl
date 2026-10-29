import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiProvider, aiProviderConfig } from "@/lib/db/schema";
import { AuthError } from "@/lib/api/auth-context";
import { assertRunLease } from "./run-lifecycle";
import { openCredential, providerPostRaw } from "./provider-security";
import { ProviderTransportError, type ProviderTransport } from "./provider-attempts";

/** Server-only fixed-endpoint adapter. Default-off live-call gate is unchanged;
 * fixtures inject a transport instead. No entitlement/hosting qualification is
 * inferred from enabling configuration. No credential leaves this closure. */
export function createRunTransport(runId: string, lease: string): ProviderTransport {
  return async (request, signal, validateHistory) => {
    if (process.env.AI_PROVIDER_CALLS_ENABLED !== "true") throw new AuthError("Live provider requests are not qualified or enabled", 403);
    const { run } = await assertRunLease(runId, lease);
    const [config] = await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, run.config.providerConfigId));
    const [provider] = await db.select().from(aiProvider).where(eq(aiProvider.id, config.providerId));
    if (!config.credential || !config.keyVersion || provider.adapter !== "responses" || request.model !== config.model) throw new AuthError("Approved provider required", 409);
    const secret = openCredential(config.credential, config.keyVersion, `${run.organizationId}:${config.id}`);
    try {
      return await providerPostRaw(provider.endpoint, secret, request, Math.min(config.timeoutMs, provider.timeoutMs), signal, async () => {
        if (process.env.AI_PROVIDER_CALLS_ENABLED !== "true") throw new AuthError("Live provider requests disabled", 403);
        await assertRunLease(runId, lease);
        await validateHistory?.();
      });
    } catch (error) {
      const codes = { "Provider rate limited": "RATE_LIMIT", "Provider network unavailable": "NETWORK", "Provider temporarily unavailable": "UNAVAILABLE", "Provider authentication failed": "AUTH" } as const;
      const code = error instanceof AuthError ? codes[error.message as keyof typeof codes] : undefined;
      if (code) throw new ProviderTransportError(code);
      throw new ProviderTransportError("INVALID_SCHEMA");
    }
  };
}
