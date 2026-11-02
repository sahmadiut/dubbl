import { z } from "zod";

// Shared browser/REST/MCP input contracts. No DB or provider imports.
const id = z.string().uuid().describe("Opaque UUID, always checked against authenticated organization scope.");
const currency = z.string().regex(/^[A-Z]{3}$/).describe("Explicit three-letter billing currency; costs in different currencies are never added or converted.");
const decimal = (digits: number) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,${digits}})?$`)).describe(`Exact nonnegative major billing-currency decimal string, at most 12 whole and ${digits} fractional digits; not accounting cents.`);
const tokens = z.string().regex(/^(0|[1-9][0-9]{0,17})$/).describe("Nonnegative exact token-count integer string.");
const version = z.number().int().positive().describe("Current optimistic version; omit only when creating a policy.");
export const priceSchema = z.object({ providerId: id, model: z.string().min(1).max(120).describe("Exact currently approved provider model ID."), currency,
  inputPerMillion: decimal(6), outputPerMillion: decimal(6), cachedPerMillion: decimal(6), reasoningPerMillion: decimal(6),
  evidenceDate: z.iso.date().describe("Gregorian date administrator verified these prices; no rates are automatically invented or fetched."),
  source: z.string().regex(/^[A-Za-z0-9 ._:/-]{1,240}$/).describe("Content-free public pricing evidence reference; never credentials, prompts or invoice data."),
}).strict();
export const budgetSchema = z.object({ userId: id.nullable().describe("Null configures organization budget; a current member UUID configures that user's additional restriction."), currency,
  monthlyTokens: tokens, monthlyCost: decimal(12), runTokens: tokens, runCost: decimal(12),
  requestsPerMinute: z.number().int().min(0).max(10000).describe("Rolling 60-second attempt limit, counting retries and pre-dispatch cancellations."),
  concurrency: z.number().int().min(0).max(1000).describe("Maximum reserved, in-flight or unknown attempts; unknown usage retains its slot until reconciled."),
  expectedVersion: version.optional(),
}).strict();
