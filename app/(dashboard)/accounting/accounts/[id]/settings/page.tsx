"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { accountDisplayName } from "@/i18n/account-names";
import { requireAccountResponse, accountFailureMessage, accountTypeLabel } from "@/i18n/account-presentation";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useAccountContext } from "../layout";

export default function AccountSettingsPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("Accounts");
  const names = useTranslations("AccountNames");
  const errors = useTranslations("AccountErrors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { account, setAccount, refetch } = useAccountContext();
  const [saving, setSaving] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("settingsTitle"));

  if (!account) return null;

  const cur = account.currencyCode || "USD";
  const isSystem = account.isSystem === true;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    // Built-in categories have their name/code locked (the inputs are disabled,
    // so they aren't in the form data) — only send the editable usage fields.
    const payload = isSystem
      ? {
          subType: fd.get("subType") || null,
          description: fd.get("description") || null,
          isActive: fd.get("isActive") === "true",
        }
      : {
          code: fd.get("code"),
          name: fd.get("name"),
          subType: fd.get("subType") || null,
          description: fd.get("description") || null,
          isActive: fd.get("isActive") === "true",
        };
    try {
      const res = await fetch(`/api/v1/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(payload),
      });
      await requireAccountResponse(res, errors, t("updateAccountFailed"));
      const data = await res.json();
      setAccount(() => data.account ? { ...account, ...data.account } : account);
      toast.success(t("accountUpdated"));
      window.dispatchEvent(new CustomEvent("accounts-changed"));
      refetch();
    } catch (err) {
      toast.error(accountFailureMessage(err, t("updateAccountFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!orgId || !account) return;
    const willDeactivate = account.isActive !== false;
    await confirm({
      title: willDeactivate ? t("deactivateTitle") : t("reactivateTitle"),
      description: willDeactivate
        ? t("deactivateDescription")
        : t("reactivateDescription"),
      confirmLabel: willDeactivate ? t("deactivate") : t("reactivate"),
      cancelLabel: t("cancel"),
      destructive: willDeactivate,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/accounts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-organization-id": orgId },
            body: JSON.stringify({ isActive: !willDeactivate }),
          });
          await requireAccountResponse(res, errors, t("updateAccountFailed"));
          toast.success(willDeactivate ? t("accountDeactivated") : t("accountReactivated"));
          window.dispatchEvent(new CustomEvent("accounts-changed"));
          refetch();
        } catch (err) {
          toast.error(accountFailureMessage(err, t("updateAccountFailed")));
          throw err;
        }
      },
    });
  }

  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("deleteAccountConfirm"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/accounts/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await requireAccountResponse(res, errors, t("deleteFailed"));
          toast.success(t("accountDeleted"));
          window.dispatchEvent(new CustomEvent("accounts-changed"));
          router.push("/accounting/accounts");
        } catch (err) {
          toast.error(accountFailureMessage(err, t("deleteFailed")));
          throw err;
        }
      },
    });
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-10">
        {isSystem && (
          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-4 py-3">
            <Lock className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t.rich("systemNotice", { strong: chunks => <span className="font-medium text-foreground">{chunks}</span> })}
            </p>
          </div>
        )}

        {/* General */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("general")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {isSystem ? t("systemGeneralDescription") : t("generalDescription")}
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("accountCode")}</Label>
                <Input name="code" required defaultValue={account.code} className="font-mono" readOnly={isSystem} disabled={isSystem} />
                <p className="text-[11px] text-muted-foreground">
                  {isSystem ? t("systemCodeNotice") : t("codeNotice")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("accountName")}</Label>
                <Input name="name" required defaultValue={accountDisplayName(names, account)} readOnly={isSystem} disabled={isSystem} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("subType")}</Label>
              <Input name="subType" defaultValue={account.subType || ""} placeholder={t("subTypePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("description")}</Label>
              <Textarea name="description" defaultValue={account.description || ""} placeholder={t("notesPlaceholder")} rows={3} />
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Status */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("status")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("statusDescription")}</p>
          </div>
          <div className="min-w-0">
            <Select name="isActive" defaultValue={account.isActive === false ? "false" : "true"} key={String(account.isActive)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("active")}</SelectItem>
                <SelectItem value="false">{t("inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Read-only info */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("info")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("infoDescription")}</p>
          </div>
          <div className="min-w-0 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] text-muted-foreground">{t("type")}</p>
              <p className="text-sm capitalize mt-0.5">{accountTypeLabel(t, account.type)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("currency")}</p>
              <p className="text-sm mt-0.5">{currencyLabel(cur, unitPresentation.locale)}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {t("saveChanges")}
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium text-red-600">{t("dangerZone")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("irreversible")}</p>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {account.isActive !== false ? t("deactivateAccount") : t("reactivateAccount")}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {account.isActive !== false
                    ? t("hideNotice")
                    : t("showNotice")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleDeactivate}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
              >
                {account.isActive !== false ? t("deactivate") : t("reactivate")}
              </Button>
            </div>

            {isSystem ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t("deleteAccount")}</p>
                  <p className="text-[12px] text-muted-foreground">{t("systemDeleteNotice")}</p>
                </div>
                <Button variant="outline" size="sm" type="button" disabled>{t("delete")}</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteAccount")}</p>
                  <p className="text-[12px] text-muted-foreground">{t("transactionsPreventDelete")}</p>
                </div>
                <Button variant="destructive" size="sm" type="button" onClick={handleDelete}>{t("delete")}</Button>
              </div>
            )}
          </div>
        </div>
      </form>

      {confirmDialog}
    </>
  );
}
