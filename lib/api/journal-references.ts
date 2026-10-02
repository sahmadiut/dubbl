import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartAccount, costCenter, project, fiscalYear } from "@/lib/db/schema";
import { z } from "zod";
import { AuthError } from "./auth-context";

/** Corrupt historical FKs must not expose another tenant's account labels on detail reads. */
export function assertJournalAccountScope(organizationId: string, lines: { account: { organizationId: string } | null }[]) {
  if (lines.some(line => line.account && line.account.organizationId !== organizationId)) {
    throw new AuthError("Journal contains an account outside this organization", 422);
  }
}

/** Validate tenant-owned dimensions before any header or line mutation. */
export async function assertJournalReferences(organizationId: string,
  lines: { accountId?: string; costCenterId?: string | null; projectId?: string | null }[], fiscalYearId?: string | null, historical = false) {
  const accounts = [...new Set(lines.flatMap(line => line.accountId ? [line.accountId] : []))];
  const centers = [...new Set(lines.flatMap(line => line.costCenterId ? [line.costCenterId] : []))];
  const projects = [...new Set(lines.flatMap(line => line.projectId ? [line.projectId] : []))];
  const fail = () => { throw new z.ZodError([{ code: "custom", path: ["lines"], message: "Journal references must belong to this organization and be active" }]); };
  if (accounts.length) {
    const foundAccounts = await db.select({ id: chartAccount.id }).from(chartAccount).where(and(
      eq(chartAccount.organizationId, organizationId), inArray(chartAccount.id, accounts), historical ? undefined : eq(chartAccount.isActive, true), historical ? undefined : isNull(chartAccount.deletedAt)));
    if (foundAccounts.length !== accounts.length) fail();
  }
  if (centers.length) {
    const found = await db.select({ id: costCenter.id }).from(costCenter).where(and(
      eq(costCenter.organizationId, organizationId), inArray(costCenter.id, centers), historical ? undefined : eq(costCenter.isActive, true), historical ? undefined : isNull(costCenter.deletedAt)));
    if (found.length !== centers.length) fail();
  }
  if (projects.length) {
    const found = await db.select({ id: project.id }).from(project).where(and(
      eq(project.organizationId, organizationId), inArray(project.id, projects), historical ? undefined : isNull(project.deletedAt)));
    if (found.length !== projects.length) fail();
  }
  if (fiscalYearId) {
    const found = await db.query.fiscalYear.findFirst({ where: and(eq(fiscalYear.id, fiscalYearId), eq(fiscalYear.organizationId, organizationId), historical ? undefined : isNull(fiscalYear.deletedAt)) });
    if (!found) fail();
  }
}
