"use client";

import { useTranslations } from "next-intl";
import { authErrorMessage, AuthPresentationError } from "@/i18n/auth-errors";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Shield,
  Monitor,
  AlertTriangle,
  LogOut,
  User,
  Link2,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface LinkedAccount {
  id: string;
  provider: string;
  type: string;
}

interface LoginEntry {
  id: string;
  displayLabel: string | null;
  provider: string | null;
  alerted: boolean;
  createdAt: string;
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function formatProvider(provider: string | null, t: ReturnType<typeof useTranslations<"Account">>): string {
  const PROVIDER_LABELS: Record<string, string> = {
    google: "Google",
    apple: "Apple",
    credentials: t("emailPassword"),
  };

  return (provider && Object.hasOwn(PROVIDER_LABELS, provider) ? PROVIDER_LABELS[provider] : provider) || t("unknown");
}

export function timeAgo(date: string, t: ReturnType<typeof useTranslations<"Account">>, now = Date.now()): string {
  const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
  if (seconds < 60) return t("justNow");
  if (seconds < 3600) return t("minutesAgo", { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t("hoursAgo", { count: Math.floor(seconds / 3600) });
  if (seconds < 604800) return t("daysAgo", { count: Math.floor(seconds / 86400) });
  return new Date(date).toLocaleDateString();
}

type TabId = "profile" | "accounts" | "security";

export function AccountDialog({
  open,
  onOpenChange,
  user,
}: AccountDialogProps) {
  const t = useTranslations("Account");
  const te = useTranslations("AuthErrors");
  const TABS = [
    { id: "profile", label: t("profile"), icon: User },
    { id: "accounts", label: t("connections"), icon: Link2 },
    { id: "security", label: t("security"), icon: Fingerprint },
  ] as const;

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [logins, setLogins] = useState<LoginEntry[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [tab, setTab] = useState<TabId>("profile");

  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      fetchAccounts();
    } else {
      setTab("profile");
    }
  }, [open, user?.name]);

  const fetchLogins = useCallback(async () => {
    setLoginsLoading(true);
    try {
      const res = await fetch("/api/v1/sessions");
      const data = await res.json();
      if (data.sessions) setLogins(data.sessions);
    } catch {
      // ignore
    } finally {
      setLoginsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "security" && logins.length === 0) fetchLogins();
  }, [tab, logins.length, fetchLogins]);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/v1/user/accounts");
      const data = await res.json();
      if (data.accounts) {
        const oauthAccounts = data.accounts.filter(
          (a: LinkedAccount) => a.type !== "credentials"
        );
        setAccounts(oauthAccounts);
        setHasPassword(
          data.accounts.some((a: LinkedAccount) => a.type === "credentials")
        );
      }
    } catch {
      // ignore
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new AuthPresentationError(authErrorMessage(te, d.error, t("failedToUpdateProfile"), res.status));
      }
      toast.success(t("profileUpdated"));
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof AuthPresentationError ? err.message : t("failedToUpdate"));
    } finally {
      setSaving(false);
    }
  }

  async function unlinkAccount(id: string) {
    setUnlinking(id);
    try {
      const res = await fetch(`/api/v1/user/accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new AuthPresentationError(authErrorMessage(te, data.error, t("failedToUnlinkAccount"), res.status));
      }
      toast.success(t("accountUnlinked"));
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof AuthPresentationError ? err.message : t("failedToUnlink"));
    } finally {
      setUnlinking(null);
    }
  }

  async function revokeAll() {
    if (!confirm(t("thisWillSignYouOutOfAllDevicesYouWillNeedToSignInAgain"))) return;
    setRevoking(true);
    try {
      const res = await fetch("/api/v1/sessions/revoke-all", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(t("allSessionsRevoked"));
        setTimeout(() => {
          window.location.href = "/sign-in";
        }, 1000);
      } else {
        throw new AuthPresentationError(authErrorMessage(te, data.error, t("failedToRevokeSessions"), res.status));
      }
    } catch (err) {
      toast.error(err instanceof AuthPresentationError ? err.message : t("failedToRevokeSessions"));
      setRevoking(false);
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  const canUnlink = accounts.length > 1 || hasPassword;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">{t("accountSettings")}</DialogTitle>

        <div className="flex flex-col sm:flex-row sm:min-h-[420px]">
          {/* Sidebar nav */}
          <div className="shrink-0 border-b sm:border-b-0 sm:border-r sm:w-[180px] bg-muted/30">
            {/* User info */}
            <div className="px-4 pt-5 pb-4 sm:pb-5">
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-3">
                <Avatar className="size-9 sm:size-11 ring-1 ring-border">
                  <AvatarImage src={user?.image || undefined} />
                  <AvatarFallback className="text-xs sm:text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{user?.name || t("user")}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Tab buttons */}
            <nav className="flex sm:flex-col gap-0.5 px-2 pb-2 sm:pb-4 overflow-x-auto sm:overflow-x-visible">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    data-account-tab={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="account-tab-bg"
                        className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border/50"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <Icon className="relative size-4" />
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="p-6"
              >
                {tab === "profile" && (
                  <ProfileTab
                    name={name}
                    setName={setName}
                    email={user?.email || ""}
                    saving={saving}
                    onSave={saveName}
                  />
                )}
                {tab === "accounts" && (
                  <AccountsTab
                    accounts={accounts}
                    hasPassword={hasPassword}
                    canUnlink={canUnlink}
                    unlinking={unlinking}
                    email={user?.email || ""}
                    onUnlink={unlinkAccount}
                  />
                )}
                {tab === "security" && (
                  <SecurityTab
                    logins={logins}
                    loading={loginsLoading}
                    revoking={revoking}
                    onRevokeAll={revokeAll}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab content components                                             */
/* ------------------------------------------------------------------ */

export function ProfileTab({
  name,
  setName,
  email,
  saving,
  onSave,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("Account");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">{t("profile")}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {t("yourPersonalDetailsVisibleToTeamMembers")}
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("displayName")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("yourFullName")}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("email")}</Label>
          <Input
            value={email}
            disabled
            className="text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("contactSupportToChangeYourEmailAddress")}
          </p>
        </div>
      </div>
      <Button
        onClick={onSave}
        disabled={saving || !name}
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {saving ? t("saving") : t("saveChanges")}
      </Button>
    </div>
  );
}

export function AccountsTab({
  accounts,
  hasPassword,
  canUnlink,
  unlinking,
  email,
  onUnlink,
}: {
  accounts: LinkedAccount[];
  hasPassword: boolean;
  canUnlink: boolean;
  unlinking: string | null;
  email: string;
  onUnlink: (id: string) => void;
}) {
  const t = useTranslations("Account");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">{t("connections")}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {t("signInMethodsLinkedToYourAccount")}
        </p>
      </div>
      {accounts.length === 0 && !hasPassword ? (
        <div className="py-10 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noLinkedAccountsFound")}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {hasPassword && (
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                  <Shield className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">{t("emailPassword")}</p>
                  <p className="text-[11px] text-muted-foreground">{email}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                {t("active")}
              </span>
            </div>
          )}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border px-3.5 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {formatProvider(account.provider, t)[0]}
                  </span>
                </div>
                <div>
                  <p className="text-[13px] font-medium">
                    {formatProvider(account.provider, t)}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {account.type}
                  </p>
                </div>
              </div>
              <Button
                aria-label={t("unlinkAccount")}
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-red-600"
                disabled={!canUnlink || unlinking === account.id}
                onClick={() => onUnlink(account.id)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SecurityTab({
  logins,
  loading,
  revoking,
  onRevokeAll,
}: {
  logins: LoginEntry[];
  loading: boolean;
  revoking: boolean;
  onRevokeAll: () => void;
}) {
  const t = useTranslations("Account");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">{t("security")}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {t("manageActiveSessionsAndReviewSignInActivity")}
        </p>
      </div>

      {/* Revoke all */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <LogOut className="size-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{t("signOutEverywhere")}</p>
              <p className="text-[11px] text-muted-foreground">{t("invalidateAllActiveSessions")}</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 text-xs h-8"
            onClick={onRevokeAll}
            disabled={revoking}
          >
            {revoking ? t("revoking") : t("revokeAll")}
          </Button>
        </div>
      </div>

      {/* Recent sign-ins */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2.5">{t("recentSignIns")}</p>
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground animate-pulse">{t("loading")}</p>
          </div>
        ) : logins.length === 0 ? (
          <div className="py-8 text-center">
            <Monitor className="size-7 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">{t("noSignInHistoryYet")}</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {logins.map((login, i) => (
              <motion.div
                key={login.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
                  login.alerted
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20"
                    : "border-transparent hover:bg-muted/40"
                )}
              >
                <div className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  login.alerted
                    ? "bg-amber-100 dark:bg-amber-950"
                    : "bg-muted"
                )}>
                  {login.alerted ? (
                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Monitor className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">
                      {login.displayLabel || t("unknownDevice")}
                    </span>
                    {login.alerted && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-400 uppercase">
                        {t("newIP")}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatProvider(login.provider, t)} · {timeAgo(login.createdAt, t)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Keep backward-compat export
export { AccountDialog as EditProfileDialog };
