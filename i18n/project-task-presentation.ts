"use client";

import { useTranslations } from "next-intl";
import { useProjectPresentation } from "./project-overview-presentation";
import { formatInstant } from "./dates";
import { projectCrmJson } from "@/lib/money/project-crm-ui";

export function useProjectTaskPresentation() {
  const shared = useProjectPresentation();
  const t = useTranslations("ProjectTasks");
  return {
    ...shared, t,
    formatCreated: (value: string, short = false) => formatInstant(new Date(value), shared.presentation,
      short ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }),
  };
}

/** Validate the established operation envelope before clearing forms or refreshing.
 * Server error prose is private; callers choose a reviewed localized fallback.
 */
export async function projectTaskMutationJson(response: Response, kind: "task" | "item" | "comment" | "success", expectedId?: string) {
  if (!response.ok) throw new Error("Project task mutation failed");
  const body: unknown = await projectCrmJson(response);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid project task response");
  const value = (body as Record<string, unknown>)[kind];
  if (kind === "success") {
    if (value !== true) throw new Error("Invalid project task acknowledgement");
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value) ||
      typeof value.id !== "string" || !value.id.trim() || (expectedId !== undefined && value.id !== expectedId)) throw new Error("Invalid project task identity");
  }
  return body;
}
