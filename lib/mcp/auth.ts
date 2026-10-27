import { createHash } from "crypto";
import { db } from "@/lib/db";
import { mcpAccessToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AuthContext } from "@/lib/api/auth-context";
import { AuthError } from "@/lib/api/auth-context";
import { resolveExecutionIdentity } from "@/lib/api/execution-identity";

export async function resolveToken(bearerToken: string): Promise<AuthContext> {
  const hash = createHash("sha256").update(bearerToken).digest("hex");

  const token = await db.query.mcpAccessToken.findFirst({
    where: eq(mcpAccessToken.tokenHash, hash),
  });

  if (!token) {
    throw new AuthError("Invalid access token", 401);
  }

  if (token.expiresAt <= new Date()) {
    throw new AuthError("Access token expired", 401);
  }

  return resolveExecutionIdentity({ kind: "mcp", userId: token.userId,
    organizationId: token.organizationId, credentialId: token.id });
}
