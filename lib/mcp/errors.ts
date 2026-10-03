import { z } from "zod";
import { AuthError } from "@/lib/api/auth-context";
import type { AuthContext } from "@/lib/api/auth-context";
import { LimitExceededError } from "@/lib/api/check-limit";
import { PeriodLockedError } from "@/lib/api/period-lock";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { CurrencyRolloutError } from "@/lib/currency/rollout";
import { stringifyWire, WireCompatibilityError, type WireRepresentation } from "@/lib/money/wire";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function wrapTool<T>(
  ctx: AuthContext,
  handler: (ctx: AuthContext) => Promise<T>,
  representation: WireRepresentation = "legacy",
): Promise<ToolResult> {
  return Promise.resolve().then(() => handler(ctx))
    .then((result) => ({
      content: [{ type: "text" as const, text: stringifyWire(result, representation) }],
    }))
    .catch((err) => {
      if (err instanceof WireCompatibilityError) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message, code: err.code, status: err.status }) }],
          isError: true,
        };
      }
      if (err instanceof CurrencyRolloutError) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message, status: 403 }) }],
          isError: true,
        };
      }
      if (err instanceof AuthError) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: err.message, status: err.status }),
            },
          ],
          isError: true,
        };
      }
      if (err instanceof z.ZodError) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Validation error",
                details: err.issues.map((i) => i.message),
              }),
            },
          ],
          isError: true,
        };
      }
      if (err instanceof LimitExceededError) {
        // Surface plan-limit messages (e.g. multi-currency) to the agent
        // instead of masking them as a generic internal error.
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: err.message, status: 403 }),
            },
          ],
          isError: true,
        };
      }
      if (err instanceof PeriodLockedError || err instanceof MissingExchangeRateError) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message, status: 422 }) }],
          isError: true,
        };
      }
      console.error("MCP tool error:", err);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Internal error" }) },
        ],
        isError: true,
      };
    });
}
