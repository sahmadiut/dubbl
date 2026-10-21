/** Financial readiness stays code-owned; an explicit test override is separate. */
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
  const testing = env.IRR_TESTING_ENABLED;
  if (testing !== undefined && testing !== "true" && testing !== "false") {
    throw new CurrencyRolloutError("IRR_TESTING_ENABLED must be exactly true or false");
  }
  if (testing === "true" && env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    throw new CurrencyRolloutError("IRR testing override requires a development or test runtime");
  }
  if (requested && !IRR_FINANCIAL_GATE_PASSED) {
    throw new CurrencyRolloutError("IRR cannot be enabled before financial qualification passes");
  }
  // Owner-authorized temporary local testing, separate from financial readiness.
  return { irrEnabled: testing === "true" || requested && IRR_FINANCIAL_GATE_PASSED };
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
