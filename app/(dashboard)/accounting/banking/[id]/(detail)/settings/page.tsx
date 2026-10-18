"use client";
import { useTranslations } from "next-intl";
import { bankAccountTypeLabel, BANK_ACCOUNT_TYPES, requireBankAccountResponse, bankAccountFailureMessage } from "@/i18n/bank-account-presentation";
import { bankUiAccount } from "@/lib/money/bank-ui";
import type { BankAccountDetail } from "../../_components";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencySelect } from "@/components/ui/currency-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useBankAccountContext } from "../layout";
import { ACCOUNT_COLORS } from "../../_components";

export default function BankSettingsPage() {
  const t = useTranslations("BankAccounts");
  const errors = useTranslations("BankAccountErrors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { account, setAccount, refetch } = useBankAccountContext();
  const [saving, setSaving] = useState(false);
  const [bankCurrency, setBankCurrency] = useState(account?.currencyCode || "USD");
  // Which ledger account this bank account is recorded under. Defaults to the
  // one connected automatically; the picker lets the user point it elsewhere.
  const [chartAccountId, setChartAccountId] = useState(account?.chartAccountId ?? "");

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("settingsTitle"));

  async function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/bank-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          accountName: fd.get("accountName"),
          bankName: fd.get("bankName") || null,
          accountNumber: fd.get("accountNumber") || null,
          currencyCode: bankCurrency || undefined,
          countryCode: fd.get("countryCode") || null,
          accountType: fd.get("accountType") || undefined,
          color: fd.get("color") || undefined,
          // Only send a connection when one is chosen — never actively unlink
          // (an empty value just falls back to the automatic connection).
          ...(chartAccountId ? { chartAccountId } : {}),
        }),
      });
      await requireBankAccountResponse(res, errors, t("updateFailed"));
      const data = await res.json();
      const updatedAccount = bankUiAccount(data.bankAccount) as unknown as BankAccountDetail;
      setAccount(() => updatedAccount);
      toast.success(t("updated"));
      refetch();
    } catch (err) {
      toast.error(bankAccountFailureMessage(err, t("updateFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!orgId) return;
    await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("deleteConfirm"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/bank-accounts/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await requireBankAccountResponse(res, errors, t("deleteFailed"));
          toast.success(t("deleted"));
          router.push("/accounting/banking");
        } catch (err) {
          const message = bankAccountFailureMessage(err, t("deleteFailed"));
          toast.error(message);
          throw new Error(message);
        }
      },
    });
  }

  return (
    <>
      <form onSubmit={handleSaveSettings} className="space-y-10">
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("general")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("generalHint")}</p>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("accountName")}</Label>
              <Input name="accountName" required defaultValue={account.accountName} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("bankName")}</Label>
                <Input name="bankName" defaultValue={account.bankName || ""} placeholder={t("bankExample")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("accountType")}</Label>
                <Select name="accountType" defaultValue={account.accountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>{bankAccountTypeLabel(t, v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("accountNumber")}</Label>
              <Input name="accountNumber" defaultValue={account.accountNumber || ""} placeholder={t("numberPlaceholder")} />
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("region")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("regionHint")}</p>
          </div>
          <div className="min-w-0 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("currency")}</Label>
              <CurrencySelect value={bankCurrency} onValueChange={setBankCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("country")}</Label>
              <Input name="countryCode" defaultValue={account.countryCode || ""} placeholder="US" maxLength={2} />
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("booksConnection")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {t("booksHint")}</p>
          </div>
          <div className="min-w-0 space-y-1.5">
            <AccountPicker
              value={chartAccountId}
              onChange={setChartAccountId}
              typeFilter={["asset", "liability"]}
              placeholder={t("connectPlaceholder")}
              allowCreate
            />
            <p className="text-[11px] text-muted-foreground">
              {t("changeHint")}</p>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium">{t("accentColor")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("colorHint")}</p>
          </div>
          <div className="min-w-0">
            <input type="hidden" name="color" value={account.color} />
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccount((prev) => prev ? { ...prev, color: c } : prev)}
                  className={cn(
                    "size-6 rounded-full ring-2 ring-transparent transition-all",
                    account.color === c && "ring-offset-2 ring-gray-400"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={t("chooseColor", { color: c })}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {t("saveChanges")}</Button>
        </div>

        <div className="h-px bg-border" />

        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-10">
          <div className="shrink-0">
            <p className="text-sm font-medium text-red-600">{t("dangerZone")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("dangerHint")}</p>
          </div>
          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteAccount")}</p>
                <p className="text-[12px] text-muted-foreground">{t("deleteHint")}</p>
              </div>
              <Button variant="destructive" size="sm" type="button" onClick={handleDelete}>{t("delete")}</Button>
            </div>
          </div>
        </div>
      </form>

      {confirmDialog}
    </>
  );
}
