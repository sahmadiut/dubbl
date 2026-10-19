/** Finite presentation labels; stored/API/MCP enum values remain canonical. */
export function taxPeriodTypeKey(value: string) {
  switch (value) {
    case "monthly": return "monthly";
    case "quarterly": return "quarterly";
    case "annual": return "annual";
    default: return "unknownType";
  }
}

export function taxPeriodStatusKey(value: string) {
  switch (value) {
    case "open": return "open";
    case "filed": return "filed";
    case "amended": return "amended";
    default: return "unknownStatus";
  }
}
