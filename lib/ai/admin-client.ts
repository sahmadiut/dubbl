import { z } from "zod";

// Browser DTOs deliberately omit ciphertext, key material and credential references.
export const modelDto = z.object({ id: z.string(), contextTokens: z.number(), outputTokens: z.number(), functionCalls: z.boolean(), strictSchemas: z.boolean(), streaming: z.boolean(), usage: z.boolean(), evidenceDate: z.string() });
export const providerDto = z.object({ id: z.string().uuid(), name: z.string(), adapter: z.literal("responses"), endpoint: z.string(), enabled: z.boolean(), models: z.array(modelDto), defaultModel: z.string(), timeoutMs: z.number(), version: z.number().int().positive(), delegatedOrganizations: z.array(z.string()).optional() });
export const configDto = z.object({ id: z.string().uuid(), providerId: z.string().uuid(), model: z.string(), enabled: z.boolean(), isDefault: z.boolean(), timeoutMs: z.number(), version: z.number().int().positive(), credentialConfigured: z.boolean() });
export const policyDto = z.object({ subject: z.string(), enabled: z.boolean(), allowedTools: z.array(z.string()), version: z.number().int().positive() });
export type Provider = z.infer<typeof providerDto>;
export type ProviderConfig = z.infer<typeof configDto>;
export type ToolPolicy = z.infer<typeof policyDto>;
export type Model = z.infer<typeof modelDto>;

export type AdminErrorKey = "denied" | "conflict" | "invalid" | "unavailable" | "network" | "failed" | "notQualified" | "disabled" | "credentialRequired" | "endpointRejected" | "missingOrganization";
export class AiAdminError extends Error {
  constructor(public key: AdminErrorKey) { super(key); }
}
export function adminErrorKey(status: number, message: unknown): AdminErrorKey {
  if (status === 401 || status === 403) return message === "Live provider requests are not qualified or enabled" ? "notQualified" : "denied";
  if (message === "Provider credential required") return "credentialRequired";
  if (message === "Provider configuration is disabled" || message === "Provider is disabled") return "disabled";
  if (message === "Provider endpoint is not approved" || message === "Provider endpoint resolves to a restricted network") return "endpointRejected";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "invalid";
  if (status === 503) return "unavailable";
  return "failed";
}

/** Never display raw request, server or provider diagnostics in a sensitive form. */
export async function adminRequest<T>(organizationId: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
  if (!organizationId) throw new AiAdminError("missingOrganization");
  let response: Response;
  try {
    response = await fetch(`/api/v1/ai/${path}`, { method, cache: "no-store", headers: { "x-organization-id": organizationId, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch { throw new AiAdminError("network"); }
  let data: unknown;
  try { data = await response.json(); } catch { throw new AiAdminError("failed"); }
  if (!response.ok) throw new AiAdminError(adminErrorKey(response.status, data && typeof data === "object" && "error" in data ? data.error : undefined));
  const result = schema.safeParse(data);
  if (!result.success) throw new AiAdminError("failed");
  return result.data;
}
