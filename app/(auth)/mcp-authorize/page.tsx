"use client";

import { useTranslations } from "next-intl";
import { BidiText } from "@/components/ui/bidi-text";
import { authErrorMessage, AuthPresentationError } from "@/i18n/auth-errors";
import { richTextTags } from "@/i18n/rich-text";

const consentRichTextTags = {
  ...richTextTags,
  strong: (chunks: React.ReactNode) => <BidiText><strong>{chunks}</strong></BidiText>,
};

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, X } from "lucide-react";

export default function McpAuthorizePage() {
  return (
    <Suspense>
      <McpAuthorizeContent />
    </Suspense>
  );
}

interface OrgOption {
  id: string;
  name: string;
}

function McpAuthorizeContent() {
  const t = useTranslations("Consent");
  const te = useTranslations("AuthErrors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientName = searchParams.get("client_name") || t("client");
  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "mcp";

  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/organization")
      .then((res) => res.json())
      .then((data) => {
        const orgs = data.organizations || [];
        setOrganizations(orgs);
        if (orgs.length === 1) {
          setSelectedOrg(orgs[0].id);
        }
      })
      .catch(() => setError(t("loadFailed")));
  }, [t]);

  async function handleApprove() {
    if (!selectedOrg) {
      setError(t("selectRequired"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/mcp/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          state,
          scope,
          organization_id: selectedOrg,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new AuthPresentationError(authErrorMessage(te, data.error, t("failed"), res.status));
      }

      const data = await res.json();
      router.push(data.redirect_url);
    } catch (err) {
      setError(err instanceof AuthPresentationError ? err.message : t("failed"));
      setLoading(false);
    }
  }

  function handleDeny() {
    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "User denied the request",
      state,
    });
    router.push(`${redirectUri}?${params.toString()}`);
  }

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <motion.div
        className="mb-7"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <Shield className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t.rich("request", { ...consentRichTextTags, client: clientName })}
        </p>
      </motion.div>

      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <BidiText>{error}</BidiText>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("permissions")}
          </p>
          <ul className="space-y-1.5 text-sm">
            <li>{t("accounts")}</li>
            <li>{t("journals")}</li>
            <li>{t("documents")}</li>
            <li>{t("reports")}</li>
          </ul>
        </div>

        {organizations.length > 1 && (
          <div className="space-y-2">
            <label htmlFor="consent-organization" className="text-xs font-medium">{t("selectOrg")}</label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger id="consent-organization" className="h-auto data-[size=default]:h-auto min-h-11 w-full min-w-0 rounded-lg whitespace-normal *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:whitespace-normal *:data-[slot=select-value]:line-clamp-none">
                <SelectValue placeholder={t("chooseOrg")}>
                  {selectedOrg && <BidiText>{organizations.find((org) => org.id === selectedOrg)?.name}</BidiText>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <BidiText>{org.name}</BidiText>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {organizations.length === 1 && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            {t.rich("organization", { ...consentRichTextTags, name: organizations[0].name })}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="h-auto min-h-11 min-w-0 whitespace-normal py-2 flex-1 rounded-lg"
            onClick={handleDeny}
            disabled={loading}
          >
            <X className="me-1.5 size-4 shrink-0" />
            {t("deny")}
          </Button>
          <Button
            className="h-auto min-h-11 min-w-0 whitespace-normal py-2 flex-1 rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/15 transition-all hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-600/20 active:scale-[0.98]"
            onClick={handleApprove}
            disabled={loading || !selectedOrg}
          >
            {loading ? t("authorizing") : t("authorize")}
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60">
          {t("planNotice")}
        </p>
      </motion.div>
    </div>
  );
}
