"use client";

import { hasOrganizationCookie, setActiveOrganization } from "@/i18n/organization-client";

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/logo";

export function OrgLoader({ children }: { children: React.ReactNode }) {
  const FADE_DURATION_MS = 400;
  const [state, setState] = useState<"loading" | "ready" | "fading">("loading");

  useEffect(() => {
    let isMounted = true;
    let readyTimer: number | null = null;

    const startFadeOut = () => {
      requestAnimationFrame(() => {
        if (!isMounted) return;
        setState("fading");
        readyTimer = window.setTimeout(() => {
          if (isMounted) setState("ready");
        }, FADE_DURATION_MS);
      });
    };

    const orgId = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = {};
    if (orgId) headers["x-organization-id"] = orgId;

    fetch("/api/v1/organization", { headers })
      .then((r) => r.json())
      .then((data) => {
        // Single org response (header was sent)
        const org = data.organization
          // List response (no header) - pick the first org
          ?? data.organizations?.[0];

        if (org) {
          // Migrate the existing localStorage selection once, then let the server
          // and client consume the same organization default on the next request.
          if (org.id && !hasOrganizationCookie(org.id)) {
            setActiveOrganization(org.id);
            if (hasOrganizationCookie(org.id)) {
              window.location.reload();
              return;
            }
          }
          // Persist resolved org for OAuth users who don't have it set yet
          if (!orgId && org.id) {
            setActiveOrganization(org.id);
          }
          if (org.country === null) {
            window.location.href = "/onboarding";
            return;
          }
        } else {
          // User has no orgs at all, redirect to onboarding
          window.location.href = "/onboarding";
          return;
        }
        startFadeOut();
      })
      .catch(() => {
        startFadeOut();
      });

    return () => {
      isMounted = false;
      if (readyTimer) window.clearTimeout(readyTimer);
    };
  }, []);

  return (
    <>
      {state !== "ready" && (
        <div
          className={`org-loader-overlay ${state === "fading" ? "org-loader-fade-out" : ""}`}
        >
          <div className="flex flex-col items-center gap-4">
            <Logo className="org-loader-logo h-10 w-auto" />
            <span className="text-sm font-medium tracking-tight text-muted-foreground/60">
              dubbl
            </span>
          </div>
        </div>
      )}
      {state === "ready" && children}
    </>
  );
}
