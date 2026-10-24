/** Independent expected-character mapping for fixtures authored in ASCII.
 * Keep canonical hidden inputs and request values outside this display helper.
 */
export function displayNumberFixture(value: string, locale: "en-US" | "fa-IR") {
  if (locale === "en-US") return value;
  return value.replace(/[0-9.,]/g, character => character === "." ? "٫" : character === "," ? "٬" : "۰۱۲۳۴۵۶۷۸۹"[Number(character)]);
}

/** Independent approved currency label examples; no production formatter calls. */
export function currencyFixture(code: string, locale: "en-US" | "fa-IR") {
  const names: Record<string, string> = { USD: "دلار", EUR: "یورو", KWD: "دینار کویت", JPY: "ین ژاپن", IRR: "ریال" };
  return locale === "fa-IR" ? names[code] ?? code : code;
}
