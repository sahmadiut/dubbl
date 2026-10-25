"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";
import { COUNTRIES as ALL_COUNTRIES } from "@/lib/countries";
import { PAYMENT_TERMS } from "@/lib/payment-terms";
import {
  COUNTRIES as BUSINESS_COUNTRIES,
  getBusinessTypesForCountry,
  getCountryByCode,
} from "@/lib/data/business-types";
import { Section } from "@/components/dashboard/section";
import { LocalePreferences } from "@/components/settings/locale-preferences";
import { useLocale, useTranslations } from "next-intl";
import { businessTypeName, countryName } from "@/i18n/onboarding-options";
import { addressCountryName, paymentTermLabel } from "@/i18n/settings-options";
import { settingsErrorMessage, requireSettingsResponse, settingsFailureMessage } from "@/i18n/settings-errors";
import { readSettingsLockDate } from "@/components/settings/period-lock-response";

interface OrgSettings {
  id: string;
  name: string;
  country: string | null;
  businessType: string | null;
  defaultCurrency: string;
  defaultLanguage: string | null;
  fiscalYearStartMonth: number;
  countryCode: string | null;
  taxId: string | null;
  businessRegistrationNumber: string | null;
  legalEntityType: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactWebsite: string | null;
  defaultPaymentTerms: string | null;
  industrySector: string | null;
}

export default function SettingsPage() {
  const st = useTranslations("SettingsGeneral");
  const options = useTranslations("OnboardingOptions");
  const errors = useTranslations("SettingsErrors");
  const locale = useLocale();
  const MONTHS = [
    st("january"), st("february"), st("march"), st("april"), st("may"), st("june"),
    st("july"), st("august"), st("september"), st("october"), st("november"), st("december"),
  ];

  const t = useTranslations("LocalePreferences");
  const [, setOrg] = useState<OrgSettings | null>(null);
  const [irrEnabled, setIrrEnabled] = useState(false);
  const [form, setForm] = useState({
    name: "",
    country: "" as string,
    businessType: "" as string,
    defaultCurrency: "USD",
    defaultLanguage: "",
    fiscalYearStartMonth: "1",
    countryCode: "",
    taxId: "",
    businessRegistrationNumber: "",
    legalEntityType: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    addressCountry: "",
    contactPhone: "",
    contactEmail: "",
    contactWebsite: "",
    defaultPaymentTerms: "",
    industrySector: "",
  });
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [lockDate, setLockDate] = useState("");
  const [lockSaving, setLockSaving] = useState(false);
  const [peppolId, setPeppolId] = useState("");
  const [peppolScheme, setPeppolScheme] = useState("");

  useDocumentTitle(st("settingsGeneral"));

  const businessTypes = useMemo(
    () => (form.countryCode ? getBusinessTypesForCountry(form.countryCode) : []),
    [form.countryCode]
  );

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    // Fetch period lock
    fetch("/api/v1/period-lock", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => readSettingsLockDate(r, errors, st("failedToLoadLock")))
      .then(setLockDate)
      .catch((error) => toast.error(settingsFailureMessage(error, st("failedToLoadLock"))));

    fetch("/api/v1/organization", {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => (await requireSettingsResponse(r, errors, st("failedToLoad"))).json())
      .then((data) => {
        setIrrEnabled(data.currencyRollout?.irrEnabled === true);
        if (data.organization) {
          const o = data.organization;
          setOrg(o);
          setPeppolId(o.peppolId || "");
          setPeppolScheme(o.peppolScheme || "");
          setForm({
            name: o.name,
            country: o.country ?? "",
            businessType: o.businessType ?? "",
            defaultCurrency: o.defaultCurrency,
            defaultLanguage: o.defaultLanguage ?? "",
            fiscalYearStartMonth: String(o.fiscalYearStartMonth),
            countryCode: o.countryCode || "",
            taxId: o.taxId || "",
            businessRegistrationNumber: o.businessRegistrationNumber || "",
            legalEntityType: o.legalEntityType || "",
            addressStreet: o.addressStreet || "",
            addressCity: o.addressCity || "",
            addressState: o.addressState || "",
            addressPostalCode: o.addressPostalCode || "",
            addressCountry: o.addressCountry || "",
            contactPhone: o.contactPhone || "",
            contactEmail: o.contactEmail || "",
            contactWebsite: o.contactWebsite || "",
            defaultPaymentTerms: o.defaultPaymentTerms || "",
            industrySector: o.industrySector || "",
          });
        }
      })
      .catch((error) => toast.error(settingsFailureMessage(error, st("failedToLoad"))));
  }, [errors, st]);

  function handleCountryChange(countryCode: string) {
    const country = getCountryByCode(countryCode);
    setForm((prev) => ({
      ...prev,
      country: country?.name ?? countryCode,
      businessType: "",
      countryCode: countryCode,
      ...(country ? { defaultCurrency: country.defaultCurrency } : {}),
    }));
    setCountryOpen(false);
  }

  async function save() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/organization", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: form.name,
          defaultLanguage: form.defaultLanguage || null,
          country: form.country || null,
          businessType: form.businessType || null,
          defaultCurrency: form.defaultCurrency,
          fiscalYearStartMonth: parseInt(form.fiscalYearStartMonth),
          countryCode: form.countryCode || null,
          taxId: form.taxId || null,
          businessRegistrationNumber: form.businessRegistrationNumber || null,
          legalEntityType: form.legalEntityType || null,
          addressStreet: form.addressStreet || null,
          addressCity: form.addressCity || null,
          addressState: form.addressState || null,
          addressPostalCode: form.addressPostalCode || null,
          addressCountry: form.addressCountry || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          contactWebsite: form.contactWebsite || null,
          defaultPaymentTerms: form.defaultPaymentTerms || null,
          industrySector: form.industrySector || null,
          peppolId: peppolId || null,
          peppolScheme: peppolScheme || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(settingsErrorMessage(errors, data.error, st("failedToSave"), res.status));
        return;
      }
      toast.success(st("settingsSaved"));
      window.location.reload();
    } catch {
      toast.error(st("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  const selectedCountry = form.countryCode
    ? getCountryByCode(form.countryCode)
    : null;

  return (
    <div className="space-y-10">
      <LocalePreferences />

      <div className="h-px bg-border" />

      {/* Organization */}
      <Section title={st("organization")} description={st("basicDetailsAboutYourOrganization")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="organization-name" className="text-xs">{st("name")}</Label>
            <Input
              id="organization-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={st("acmeInc")} aria-label={st("name")} dir="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organization-language" className="text-xs">{t("organizationLanguage")}</Label>
            <select
              id="organization-language"
              className="h-auto min-h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.defaultLanguage}
              onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })} aria-label={t("organizationLanguage")}
            >
              <option value="">{t("inherit")}</option>
              <option value="en-US">{t("english")}</option>
              <option value="fa-IR">{t("persian")}</option>
            </select>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Legal */}
      <Section title={st("legal")} description={st("legalEntityInformationTaxIDsAndRegistrationDetails")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-country-trigger">{st("countrySetsYourTaxRules")}</Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  id="settings-country-trigger" aria-label={st("countrySetsYourTaxRules")}
                  aria-controls="settings-country-options"
                  aria-expanded={countryOpen}
                  className={cn(
                    "flex h-auto min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    !selectedCountry && "text-muted-foreground"
                  )}
                >
                  {selectedCountry
                    ? `${selectedCountry.flag} ${countryName(options, selectedCountry)}`
                    : st("selectCountry")}
                  <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder={st("searchCountry")} aria-label={st("searchCountry")} dir="auto" />
                  <CommandList id="settings-country-options">
                    <CommandEmpty>{st("noCountryFound")}</CommandEmpty>
                    <CommandGroup>
                      {BUSINESS_COUNTRIES.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={`${countryName(options, country)} ${country.name} ${country.code}`}
                          onSelect={() => handleCountryChange(country.code)}
                        >
                          <Check
                            className={cn(
                              "me-2 h-4 w-4",
                              form.countryCode === country.code
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {country.flag} {countryName(options, country)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              {st("picksTheRightTaxRulesAndFormsForWhereYourBusinessIs")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-business-type">{st("businessStructure")}</Label>
            {form.countryCode ? (
              <Select
                value={form.businessType}
                onValueChange={(v) => setForm({ ...form, businessType: v })}
              >
                <SelectTrigger id="settings-business-type" aria-label={st("businessStructure")} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                  <SelectValue placeholder={st("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((bt) => (
                    <SelectItem key={bt.code} value={bt.code}>
                      <span>{businessTypeName(options, bt)}</span>
                      {bt.localName !== bt.englishName && (
                        <span className="ms-1 text-muted-foreground">
                          (<BidiText>{bt.englishName}</BidiText>)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex min-h-9 items-center rounded-md border border-input px-3 text-xs text-muted-foreground">
                {st("selectACountryFirst")}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-2">{st("taxIDVAT")}</Label>
            <Input
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder={st("taxIdExample")} aria-label={st("taxIDVAT")} id="settings-page-2" dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-3">{st("registrationNumber")}</Label>
            <Input
              value={form.businessRegistrationNumber}
              onChange={(e) =>
                setForm({ ...form, businessRegistrationNumber: e.target.value })
              }
              placeholder={st("registrationExample")} aria-label={st("registrationNumber")} id="settings-page-3" dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-4">{st("industry")}</Label>
            <Input
              value={form.industrySector}
              onChange={(e) =>
                setForm({ ...form, industrySector: e.target.value })
              }
              placeholder={st("eGTechnology")} aria-label={st("industry")} id="settings-page-4" dir="auto"
            />
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Address */}
      <Section title={st("address")} description={st("yourOrganizationSRegisteredAddress")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-5">{st("street")}</Label>
            <Input
              value={form.addressStreet}
              onChange={(e) =>
                setForm({ ...form, addressStreet: e.target.value })
              }
              placeholder={st("streetExample")} aria-label={st("street")} id="settings-page-5" dir="auto"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="settings-page-6">{st("city")}</Label>
              <Input
                value={form.addressCity}
                onChange={(e) =>
                  setForm({ ...form, addressCity: e.target.value })
                }
                placeholder={st("sanFrancisco")} aria-label={st("city")} id="settings-page-6" dir="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="settings-page-7">{st("stateProvince")}</Label>
              <Input
                value={form.addressState}
                onChange={(e) =>
                  setForm({ ...form, addressState: e.target.value })
                }
                placeholder={st("california")} aria-label={st("stateProvince")} id="settings-page-7" dir="auto"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="settings-page-8">{st("postalCode")}</Label>
              <Input
                value={form.addressPostalCode}
                onChange={(e) =>
                  setForm({ ...form, addressPostalCode: e.target.value })
                }
                placeholder={st("postalCodeExample")} aria-label={st("postalCode")} id="settings-page-8" dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="settings-page-9">{st("country")}</Label>
              <Select
                value={form.addressCountry}
                onValueChange={(v) => setForm({ ...form, addressCountry: v })}
              >
                <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={st("country")} id="settings-page-9">
                  <SelectValue placeholder={st("selectAddressCountry")} />
                </SelectTrigger>
                <SelectContent>
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {addressCountryName(locale, c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Contact */}
      <Section title={st("contact")} description={st("howCustomersAndPartnersCanReachYourOrganization")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-10">{st("phone")}</Label>
            <Input
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
              placeholder={st("phoneExample")} aria-label={st("phone")} id="settings-page-10" dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-11">{st("email")}</Label>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
              placeholder={st("emailExample")} aria-label={st("email")} id="settings-page-11" dir="ltr"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs" htmlFor="settings-page-12">{st("website")}</Label>
            <Input
              value={form.contactWebsite}
              onChange={(e) =>
                setForm({ ...form, contactWebsite: e.target.value })
              }
              placeholder={st("websiteExample")} aria-label={st("website")} id="settings-page-12" dir="ltr"
            />
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Financials */}
      <Section title={st("financials")} description={st("currencyFiscalYearAndDefaultPaymentTerms")}>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div role="group" aria-label={st("defaultCurrency")} className="space-y-1.5">
            <Label className="text-xs">{st("defaultCurrency")}</Label>
            <CurrencySelect
              value={form.defaultCurrency}
              disabledCodes={irrEnabled ? [] : ["IRR"]}
              aria-describedby={irrEnabled ? undefined : "functional-currency-policy"}
              onValueChange={(v) =>
                setForm({ ...form, defaultCurrency: v })
              }
            />
            {!irrEnabled && (
              <p id="functional-currency-policy" className="text-xs text-muted-foreground">
                {errors("irrUnavailable")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-13">{st("fiscalYearStart")}</Label>
            <Select
              value={form.fiscalYearStartMonth}
              onValueChange={(v) =>
                setForm({ ...form, fiscalYearStartMonth: v })
              }
            >
              <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={st("fiscalYearStart")} id="settings-page-13">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-14">{st("paymentTerms")}</Label>
            <Select
              value={form.defaultPaymentTerms}
              onValueChange={(v) =>
                setForm({ ...form, defaultPaymentTerms: v })
              }
            >
              <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={st("paymentTerms")} id="settings-page-14">
                <SelectValue placeholder={st("selectTerms")} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {paymentTermLabel(st, t.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
        >
          {saving ? st("saving") : st("saveChanges")}
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* E-Invoicing / PEPPOL */}
      <Section title={st("sendInvoicesElectronically")} description={st("yourBusinessIDOnThePEPPOLNetworkWhichLetsYouSendInvoices")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-15">{st("peppolParticipantId")}</Label>
            <Input
              value={peppolId}
              onChange={(e) => setPeppolId(e.target.value)}
              placeholder={st("peppolIdExample")} aria-label={st("peppolParticipantId")} id="settings-page-15" dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="settings-page-16">{st("peppolScheme")}</Label>
            <Select
              value={peppolScheme}
              onValueChange={setPeppolScheme}
            >
              <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={st("peppolScheme")} id="settings-page-16">
                <SelectValue placeholder={st("selectScheme")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0088">{st("scheme0088EANGLN")}</SelectItem>
                <SelectItem value="0007">{st("scheme0007SEOrgNr")}</SelectItem>
                <SelectItem value="0009">{st("scheme0009FRSIRET")}</SelectItem>
                <SelectItem value="0088">{st("scheme0088GLN")}</SelectItem>
                <SelectItem value="9925">{st("scheme9925ITVAT")}</SelectItem>
                <SelectItem value="9930">{st("scheme9930DEVAT")}</SelectItem>
                <SelectItem value="9944">{st("scheme9944GBVAT")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {st("onceConfiguredYouCanDownloadUBLXMLInvoicesFromEachInvoiceDetail")}
        </p>
      </Section>

      <div className="h-px bg-border" />

      {/* Period Lock */}
      <Section title={st("lockPastDates")} description={st("lockPastDatesSoTheyCanTBeChangedOnceSetNothing")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs" htmlFor="settings-page-17">{st("lockEverythingUpToAndIncluding")}</Label>
            <Input
              type="date"
              value={lockDate}
              onChange={(e) => setLockDate(e.target.value)} aria-label={st("lockEverythingUpToAndIncluding")} id="settings-page-17" dir="ltr"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            disabled={lockSaving}
            onClick={async () => {
              const orgId = localStorage.getItem("activeOrgId");
              if (!orgId || !lockDate) return;
              setLockSaving(true);
              try {
                const res = await fetch("/api/v1/period-lock", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "x-organization-id": orgId },
                  body: JSON.stringify({ lockDate }),
                });
                if (!res.ok) {
                  const data = await res.json();
                  toast.error(settingsErrorMessage(errors, data.error, st("failedToSetLock"), res.status));
                  return;
                }
                toast.success(st("periodLocked"));
              } catch {
                toast.error(st("failedToSetLock"));
              } finally {
                setLockSaving(false);
              }
            }}
          >
            <Lock className="size-3.5" />
            {lockSaving ? st("saving") : st("lockDates")}
          </Button>
        </div>
        {lockDate && (
          <p className="text-xs text-amber-600 mt-2">
            {st.rich("lockNotice", { date: lockDate , code: children => <IdentifierText>{children}</IdentifierText>})}
          </p>
        )}
      </Section>

      <div className="h-px bg-border" />

      {/* Danger zone */}
      <Section title={st("dangerZone")} description={st("irreversibleActionsForThisOrganization")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{st("deleteOrganization")}</p>
            <p className="text-[12px] text-muted-foreground">
              {st("permanentlyDeleteThisOrganizationAndAllItsData")}
            </p>
          </div>
          <Button variant="destructive" size="sm" className="w-fit h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
            {st("delete")}
          </Button>
        </div>
      </Section>
    </div>
  );
}
