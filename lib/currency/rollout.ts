/** Server rollout policy. Never derive financial readiness from user input or env. */
export const IRR_FINANCIAL_GATE_PASSED: boolean = false;

export class CurrencyRolloutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrencyRolloutError";
  }
}

export function readCurrencyRollout(env: Record<string, string | undefined>) {
  const value = env.IRR_PRODUCTION_ENABLED;
  if (value !== undefined && value !== "true" && value !== "false") {
    throw new CurrencyRolloutError("IRR_PRODUCTION_ENABLED must be exactly true or false");
  }
  const requested = value === "true";
  if (requested && !IRR_FINANCIAL_GATE_PASSED) {
    throw new CurrencyRolloutError("IRR cannot be enabled before financial qualification passes");
  }
  return { irrEnabled: requested && IRR_FINANCIAL_GATE_PASSED };
}

export function assertFunctionalCurrencyEnabled(
  code: string,
  env: Record<string, string | undefined> = process.env
) {
  const rollout = readCurrencyRollout(env);
  if (code.trim().toUpperCase() === "IRR" && !rollout.irrEnabled) {
    throw new CurrencyRolloutError("IRR functional currency is disabled pending financial qualification");
  }
}
