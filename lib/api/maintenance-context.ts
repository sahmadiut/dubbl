import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import type { AuthContext } from "./auth-context";
import type { TaxTx } from "./tax-config-transaction";

/** Trusted schedulers use an actual uncustomized owner for domain permissions and audit attribution. */
export async function maintenanceContext(organizationId: string, exec: typeof db | TaxTx = db): Promise<AuthContext | null> {
  const [actor] = await exec.select({ userId: member.userId, role: member.role }).from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner"),
      isNull(member.customRoleId), isNull(organization.deletedAt))).orderBy(asc(member.id)).limit(1);
  return actor ? { organizationId, userId: actor.userId, role: actor.role } : null;
}
