// After authentication, a document navigation also refreshes the root server
// locale. Keep the existing same-origin callback pathname/query/hash intact.
export function authDestination(callbackUrl: string, origin: string) {
  try {
    const destination = new URL(callbackUrl, origin);
    return destination.origin === origin ? destination.href : `${origin}/dashboard`;
  } catch { return `${origin}/dashboard`; }
}
