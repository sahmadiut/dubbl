"use client";

import { richTextTags } from "@/i18n/rich-text";
import { useTranslations } from "next-intl";
import { settingsErrorMessage, SettingsRequestError } from "@/i18n/settings-errors";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Key, Copy, Trash2, Loader2, Calendar, Clock, Lock, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { ApiKeyFields } from "@/components/settings/api-key-fields";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { ContentReveal } from "@/components/ui/content-reveal";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const t = useTranslations("SettingsApiKeys");
  const te = useTranslations("SettingsErrors");
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [apiAccess, setApiAccess] = useState(true);
  const [maxKeys, setMaxKeys] = useState(20);

  function fetchKeys() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch("/api/v1/api-keys", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.keys) setKeys(data.keys);
        if (data.apiAccess !== undefined) setApiAccess(data.apiAccess);
        if (data.maxKeys) setMaxKeys(data.maxKeys);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function createKey() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new SettingsRequestError(settingsErrorMessage(te, data.error, t("failedToCreateKey"), res.status));
      setNewKey(data.plainKey);
      setName("");
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof SettingsRequestError && err.message ? err.message : t("failedToCreateKey"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new SettingsRequestError(settingsErrorMessage(te, (await res.json()).error, "", res.status));
      toast.success(t("apiKeyRevoked"));
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof SettingsRequestError && err.message ? err.message : t("failedToDeleteKey"));
    } finally { setDeletingId(null); }
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://dubbl.dev";
  const curlExample = `curl -X GET ${baseUrl}/api/v1/invoices \\
  -H "Authorization: Bearer dk_live_..."`;

  return (
    <ContentReveal className="space-y-8">
      {/* Pro required banner */}
      {!apiAccess && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("proFeature")}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {t("apiKeysRequireAProPlan")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs border-amber-200 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
            onClick={() => router.push("/settings/billing")}
          >
            {t("upgrade")}<ArrowUpRight className="ml-1 size-3" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("apiKeys")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("createAndManageKeysForProgrammaticAccessToTheDubblAPI")}{keys.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {keys.length}/{maxKeys}
              </span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setNewKey(null);
            setCreateOpen(true);
          }}
          disabled={!apiAccess || keys.length >= maxKeys}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="mr-1.5 size-3.5" />
          {t("newKey")}
        </Button>
      </div>

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={Key}
          title={t("noAPIKeysYet")}
          description={t("createYourFirstAPIKeyToStartIntegratingWithTheDubbl")}
        >
          <Button
            size="sm"
            onClick={() => {
              setNewKey(null);
              setCreateOpen(true);
            }}
            disabled={!apiAccess}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="mr-1.5 size-3.5" />
            {t("createYourFirstKey")}
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-xl border">
          {keys.map((k, i) => (
            <div
              key={k.id}
              className={`flex items-center gap-4 px-5 py-4 ${
                i !== keys.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Key icon */}
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <Key className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Name + prefix */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{k.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                  {k.keyPrefix}...
                </p>
              </div>

              {/* Metadata */}
              <div className="hidden items-center gap-6 sm:flex">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{k.lastUsedAt ? t("used", { date: k.lastUsedAt }) : t("neverUsed")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>{t("created", { date: k.createdAt })}</span>
                </div>
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                aria-label={t("revokeKey")}
                onClick={() => deleteKey(k.id)}
                disabled={deletingId === k.id}
              >
                {deletingId === k.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Authentication / Usage */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("authentication")}</h3>
        <div className="overflow-hidden rounded-xl border bg-zinc-950 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-xs font-medium text-zinc-400">{t("exampleRequest")}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              aria-label={t("copyExample")}
              onClick={() => {
                navigator.clipboard.writeText(curlExample);
                toast.success(t("copiedToClipboard"));
              }}
            >
              <Copy className="size-3" />
            </Button>
          </div>
          <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono text-emerald-400">
            <code>{curlExample}</code>
          </pre>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.rich("authenticationHelp", {
            ...richTextTags,
            code: text => <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{text}</code>,
          })}
        </p>
      </div>

      {/* Create / reveal dialog */}
      <Sheet
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setNewKey(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {newKey ? t("apiKeyCreated") : t("newAPIKey")}
            </SheetTitle>
            {newKey && (
              <SheetDescription>
                {t("copyThisKeyNowYouWonTBeAbleToSee")}
              </SheetDescription>
            )}
          </SheetHeader>
          <ApiKeyFields newKey={newKey} name={name} onNameChange={setName} onCopy={() => {
            if (newKey) {
              navigator.clipboard.writeText(newKey);
              toast.success(t("copiedToClipboard"));
            }
          }} />
          <SheetFooter>
            {newKey ? (
              <Button onClick={() => setCreateOpen(false)}>{t("done")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={createKey}
                  disabled={!name || saving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? t("creating") : t("createKey")}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
