"use client";

import { useTranslations } from "next-intl";
import { authErrorMessage, AuthPresentationError } from "@/i18n/auth-errors";

import { setActiveOrganization } from "@/i18n/organization-client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrgDialog({ open, onOpenChange }: CreateOrgDialogProps) {
  const t = useTranslations("CreateOrganization");
  const te = useTranslations("AuthErrors");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
    );
  }

  async function handleCreate() {
    if (!name || !slug) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new AuthPresentationError(authErrorMessage(te, data.error, t("failedToCreateOrganization"), res.status));
      }
      const data = await res.json();
      setActiveOrganization(data.organization.id);
      toast.success(t("organizationCreated"));
      onOpenChange(false);
      window.location.href = "/onboarding";
    } catch (err) {
      toast.error(err instanceof AuthPresentationError ? err.message : t("failedToCreate"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createOrganization")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("organizationName")}</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t("myCompany")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("slug")}</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-company"
            />
            <p className="text-xs text-muted-foreground">
              {t("usedInURLsOnlyLowercaseLettersNumbersAndHyphens")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name || !slug || saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
