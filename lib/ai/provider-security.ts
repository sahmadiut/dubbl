import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { AuthError } from "@/lib/api/auth-context";

const fail = (message: string, status = 422): never => { throw new AuthError(message, status); };
function key(version: string): Buffer {
  try {
    const value: unknown = JSON.parse(process.env.AI_CREDENTIAL_KEYS ?? "{}")[version];
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return fail("AI credential encryption is not configured", 503);
    const result = Buffer.from(value, "base64");
    if (result.length !== 32) return fail("AI credential encryption is not configured", 503);
    return result;
  } catch { return fail("AI credential encryption is not configured", 503); }
}
export function sealCredential(secret: string, scope: string) {
  const version = process.env.AI_CREDENTIAL_ACTIVE_KEY ?? "";
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(version)) return fail("AI credential encryption is not configured", 503);
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(version), iv);
  cipher.setAAD(Buffer.from(scope));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { credential: [iv, cipher.getAuthTag(), encrypted].map(v => v.toString("base64")).join("."), keyVersion: version };
}
export function openCredential(credential: string, version: string, scope: string): string {
  const encryptionKey = key(version);
  try {
    const [iv, tag, body] = credential.split(".").map(v => Buffer.from(v, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch { return fail("AI credential unavailable", 503); }
}

/** Conservative public-unicast allowlist. Mapped IPv4, translation, multicast,
 * loopback, private, documentation and reserved networks cannot reach transport. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 2 && c === 0))) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113));
  }
  // Only 2000::/3 global-unicast; deny special 2001::/23 and documentation.
  if (isIP(address) !== 6 || !/^[23][0-9a-f]{3}:/i.test(address)) return false;
  // Canonicalize equivalent zero-padded/expanded spellings before range checks.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  if (normalized.startsWith("2002:") || normalized.startsWith("3fff:") || normalized.startsWith("2001:db8:")) return false;
  if (normalized.startsWith("2001:")) {
    const second = parseInt(normalized.split(":")[1] || "0", 16);
    if (second < 0x200) return false;
  }
  return true;
}
export function approvedEndpoint(endpoint: string): URL {
  let url: URL;
  try { url = new URL(endpoint); } catch { return fail("Provider endpoint is not approved"); }
  let approved: unknown;
  try { approved = JSON.parse(process.env.AI_APPROVED_PROVIDER_ENDPOINTS ?? "[]"); } catch { return fail("Provider endpoint policy unavailable", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) || !Array.isArray(approved) || !approved.includes(url.href) || endpoint !== url.href) {
    return fail("Provider endpoint is not approved");
  }
  return url;
}
export async function endpointAddress(endpoint: string): Promise<{ url: URL; address: string; family: number }> {
  const url = approvedEndpoint(endpoint);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([lookup(url.hostname, { all: true, verbatim: true }), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AuthError("Provider DNS timed out", 504)), 5000);
    })]);
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return fail("Provider endpoint resolves to a restricted network");
    return { url, ...addresses[0] };
  } catch (err) { if (err instanceof AuthError) throw err; return fail("Provider DNS unavailable", 503); }
  finally { clearTimeout(timer); }
}

/** Fixed POST, pinned DNS lookup, TLS hostname verification, no proxy/redirects,
 * total wall timeout (including DNS), bounded response; raw errors never escape. */
export async function providerPost(endpoint: string, secret: string, body: object, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const target = await Promise.race([endpointAddress(endpoint), new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new AuthError("Provider request cancelled or timed out", 504)), { once: true });
      if (controller.signal.aborted) reject(new AuthError("Provider request cancelled or timed out", 504));
    })]);
    const payload = JSON.stringify(body);
    if (Buffer.byteLength(payload) > 65536) return fail("Provider request exceeds limit");
    return await new Promise((resolve, reject) => {
      const req = request(target.url, { method: "POST", agent: false, family: target.family, signal: controller.signal,
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
        lookup: (_hostname, _options, done) => done(null, target.address, target.family),
      }, response => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new AuthError(status >= 300 && status < 400 ? "Provider redirects are forbidden" : status === 401 || status === 403 ? "Provider authentication failed" : status === 429 ? "Provider rate limited" : "Provider request failed", 502)); return;
        }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 65536) { response.destroy(); reject(new AuthError("Provider response exceeds limit", 502)); } else chunks.push(chunk); });
        response.on("error", () => reject(new AuthError("Provider response unavailable", 502)));
        response.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new AuthError("Invalid provider response", 502)); } });
      });
      req.on("error", () => reject(new AuthError(controller.signal.aborted ? "Provider request cancelled or timed out" : "Provider network unavailable", controller.signal.aborted ? 504 : 502)));
      req.end(payload);
    });
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
