/** Text expectations omit reviewed structural tags; production still renders the real catalog. */
export function catalogText<T>(catalog: T): T {
  return JSON.parse(JSON.stringify(catalog).replace(/<\/?(?:strong|em|code)>/g, "")) as T;
}

/** Keep HTML entities escaped while comparing visible text across isolation boundaries. */
export function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
