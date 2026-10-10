import { z } from "zod";
import { parseOpaqueJson } from "./opaque-json";

export const signatureInvoiceId = z.string().uuid().describe("Organization-owned live invoice UUID");
export const signingToken = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).describe("Opaque signing link token; no organization override");
export const signatureRequestFields = {
  signerName: z.string().trim().min(1).max(1000).describe("Full name of the signer, 1-1000 characters"),
  signerEmail: z.string().email().max(320).describe("Email address of the signer"),
  expiresAt: z.iso.datetime({ offset: true }).optional().describe("Optional future ISO 8601 instant with UTC or explicit offset; omitted never expires"),
};
export const signatureRequestSchema = z.strictObject(signatureRequestFields);
export const signatureSubmitSchema = z.strictObject({
  signatureDataUrl: z.string().max(1048576).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
    .refine(value => {
      const encoded = value.slice("data:image/png;base64,".length);
      const bytes = Buffer.from(encoded, "base64");
      return bytes.toString("base64") === encoded && bytes.length >= 45
        && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
        && bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR"
        && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
        && bytes.readUInt32BE(bytes.length - 12) === 0
        && bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND";
    }, "Signature must contain a base64 PNG image")
    .describe("Canvas PNG data URL, at most 1 MiB of text; no monetary input"),
});

export async function signatureBody(request: Request) {
  const source = await request.text();
  if (source.length > 1049000) throw new z.ZodError([{ code: "custom", path: [], message: "Signature body is too large" }]);
  try { return parseOpaqueJson(source); }
  catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON body" }]);
  }
}
