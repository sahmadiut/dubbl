"use client";

import { useTranslations } from "next-intl";

import { ContentReveal } from "@/components/ui/content-reveal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Building2, CreditCard } from "lucide-react";

interface SiteSettings {
  registration_mode: string;
  allowed_email_domains: string;
  allow_user_org_creation: string;
  self_hosted_unlimited: string;
}

export function SiteSettingsForm({ settings, stripeConfigured, saving, save, onSettingsChange }: {
  settings: SiteSettings; stripeConfigured: boolean; saving: boolean;
  save: (updates: Partial<SiteSettings>) => Promise<void>;
  onSettingsChange: (settings: SiteSettings) => void;
}) {
  const t = useTranslations("Admin");
  return (
    <ContentReveal>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("siteSettings")}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("configureRegistrationOrganizationCreationAndPlanSettingsForThisInstance")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Registration */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("registration")}</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("registrationMode")}</Label>
              <Select
                value={settings.registration_mode}
                onValueChange={(v) =>
                  save({ registration_mode: v })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("open")}</SelectItem>
                  <SelectItem value="invite_only">{t("inviteOnly")}</SelectItem>
                  <SelectItem value="disabled">{t("disabled")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {t("controlsWhoCanRegisterTheFirstUserCanAlwaysRegisterRegardlessOfThisSetti")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {t("allowedEmailDomains")}
              </Label>
              <Textarea
                value={settings.allowed_email_domains}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    allowed_email_domains: e.target.value,
                  })
                }
                onBlur={() =>
                  save({
                    allowed_email_domains: settings.allowed_email_domains,
                  })
                }
                placeholder="acme.com, example.com"
                rows={2}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("commaSeparatedListOfAllowedEmailDomainsLeaveEmptyToAllowAllDomains")}
              </p>
            </div>
          </div>
        </div>

        {/* Organizations */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("organizations")}</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">
                {t("allowUsersToCreateOrganizations")}
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("whenDisabledOnlySiteAdminsCanCreateNewOrganizations")}
              </p>
            </div>
            <Switch
              aria-label={t("allowUsersToCreateOrganizations")}
              checked={settings.allow_user_org_creation === "true"}
              onCheckedChange={(checked) =>
                save({
                  allow_user_org_creation: checked ? "true" : "false",
                })
              }
            />
          </div>
        </div>

        {/* Plans */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("plans")}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">
                  {t("stripeStatus")}
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {stripeConfigured
                    ? t("stripeIsConfiguredBillingFeaturesAreActive")
                    : t("stripeIsNotConfiguredAllOrganizationsGetUnlimitedFeatures")}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  stripeConfigured
                    ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                    : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                }
              >
                {stripeConfigured ? t("connected") : t("notConfigured")}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {t("selfHostedUnlimitedMode")}
              </Label>
              <Select
                value={settings.self_hosted_unlimited}
                onValueChange={(v) =>
                  save({ self_hosted_unlimited: v })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t("autoBasedOnStripeConfig")}
                  </SelectItem>
                  <SelectItem value="true">{t("alwaysOn")}</SelectItem>
                  <SelectItem value="false">{t("alwaysOff")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {t("whenEnabledAllOrganizationsGetUnlimitedProFeaturesWithoutNeedingStripe")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg border bg-card px-4 py-2 text-xs text-muted-foreground shadow-lg">
          {t("saving")}
        </div>
      )}
    </ContentReveal>
  );
}
