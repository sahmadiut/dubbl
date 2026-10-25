"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";
import { settingsErrorMessage } from "@/i18n/settings-errors";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, UserCheck, XCircle, Shield } from "lucide-react";
import { toast } from "sonner";

interface Advisor {
  id: string;
  role: string;
  isActive: boolean;
  inviteEmail: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  advisor: { id: string; name: string | null; email: string } | null;
  grantedBy: { id: string; name: string | null } | null;
}

export default function AdvisorsPage() {
  const t = useTranslations("SettingsAdvisors");
  const te = useTranslations("SettingsErrors");
  const roleLabels: Record<string, string> = {
    accountant: t("accountant"),
    auditor: t("auditor"),
    tax_advisor: t("taxAdvisor"),
    bookkeeper: t("bookkeeper"),
  };

  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [saving, setSaving] = useState(false);

  const fetchAdvisors = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/advisors", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => setAdvisors(data.advisors || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAdvisors();
  }, [fetchAdvisors]);

  const handleInvite = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !email.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/v1/advisors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(settingsErrorMessage(te, data.error, t("failedToInviteAdvisor"), res.status));
        return;
      }

      toast.success(t("advisorInvited"));
      setSheetOpen(false);
      setEmail("");
      fetchAdvisors();
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const res = await fetch(`/api/v1/advisors?id=${id}`, {
      method: "DELETE",
      headers: { "x-organization-id": orgId },
    });

    if (res.ok) {
      toast.success(t("accessRevoked"));
      fetchAdvisors();
    } else {
      toast.error(t("failedToRevokeAccess"));
    }
  };

  const getStatusBadge = (advisor: Advisor) => {
    if (advisor.revokedAt) return <Badge variant="destructive" className="text-[10px]">{t("revoked")}</Badge>;
    if (advisor.acceptedAt && advisor.isActive) return <Badge variant="default" className="text-[10px] bg-emerald-600">{t("active")}</Badge>;
    return <Badge variant="outline" className="text-[10px]">{t("pending")}</Badge>;
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("advisors")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("grantYourAccountantOrBookkeeperReadAccessToYourOrganization")}
            </p>
          </div>
          <Button
            size="sm"
            className="text-xs gap-1.5 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            onClick={() => {
              setEmail("");
              setRole("accountant");
              setSheetOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            {t("inviteAdvisor")}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : advisors.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={t("noAdvisors")}
            description={t("inviteYourAccountantOrBookkeeperToGiveThemAccessToYour")}
          >
            <Button size="sm" className="text-xs gap-1.5 mt-3 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5" onClick={() => setSheetOpen(true)}>
              <Plus className="size-3.5" />
              {t("inviteAdvisor")}
            </Button>
          </EmptyState>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("invited")}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <IdentifierText>{a.advisor?.email || a.inviteEmail || "-"}</IdentifierText>
                    </TableCell>
                    <TableCell><BidiText>{roleLabels[a.role] || a.role}</BidiText></TableCell>
                    <TableCell>{getStatusBadge(a)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <IdentifierText>{new Date(a.invitedAt).toLocaleDateString()}</IdentifierText>
                    </TableCell>
                    <TableCell>
                      {!a.revokedAt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600"
                          aria-label={t("revokeAccess")}
                          onClick={() => handleRevoke(a.id)}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("inviteAdvisor")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="settings-advisors-1">{t("email")}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("accountantExampleCom")} aria-label={t("email")} id="settings-advisors-1" dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {t("theAdvisorMustHaveAnExistingAccount")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="settings-advisors-2">{t("role")}</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("role")} id="settings-advisors-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">{t("accountant")}</SelectItem>
                  <SelectItem value="auditor">{t("auditor")}</SelectItem>
                  <SelectItem value="tax_advisor">{t("taxAdvisor")}</SelectItem>
                  <SelectItem value="bookkeeper">{t("bookkeeper")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">{t("advisorPermissions")}</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>{t("readAccessToAllFinancialData")}</li>
                <li>{t("viewAndExportAllReports")}</li>
                <li>{t("createAndEditJournalEntries")}</li>
                <li>{t("managePeriodLocks")}</li>
              </ul>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {t("cancel")}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={saving || !email.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            >
              {saving ? t("inviting") : t("sendInvitation")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
