import { currencyCodeSchema } from "./zod";
import { assertFunctionalCurrencyEnabled } from "./rollout";

/** Shared server schema for REST/MCP functional-currency selection. */
export const functionalCurrencySchema = currencyCodeSchema.transform((code) => {
  assertFunctionalCurrencyEnabled(code);
  return code;
});
