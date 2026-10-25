"use client";

import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";
import { BidiText } from "@/components/ui/bidi-text";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { authErrorMessage, AuthPresentationError } from "@/i18n/auth-errors";
import { businessTypeName, countryName, industryName, referralName } from "@/i18n/onboarding-options";

import { setActiveOrganization } from "@/i18n/organization-client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GrainGradient } from "@paper-design/shaders-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  Building2,
  Globe,
  Briefcase,
  Factory,
  Megaphone,
  ClipboardCheck,
  ArrowUpRight,
  Info,
} from "lucide-react";
import {
  COUNTRIES,
  getBusinessTypesForCountry,
  type Country,
  type BusinessType,
} from "@/lib/data/business-types";
import { INDUSTRIES, type Industry } from "@/lib/data/industries";
import { REFERRAL_SOURCES, type ReferralSource } from "@/lib/data/referral-sources";

interface OrgData {
  id: string;
  name: string;
  country: string | null;
  countryCode: string | null;
  businessType: string | null;
  industrySector: string | null;
}

export function OnboardingWizard() {
  const readingDirection = localeDirection(usePresentation().locale);
  const t = useTranslations("Onboarding");
  const te = useTranslations("AuthErrors");
  const STEPS = [
    { label: t("organization"), icon: Building2 },
    { label: t("country"), icon: Globe },
    { label: t("businessType"), icon: Briefcase },
    { label: t("industry"), icon: Factory },
    { label: t("referral"), icon: Megaphone },
    { label: t("review"), icon: ClipboardCheck },
  ];

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [countryCode, setCountryCode] = useState("IR");
  const [businessType, setBusinessType] = useState("");
  const [industry, setIndustry] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralOther, setReferralOther] = useState("");

  // Escape hatch: user has other completed orgs
  const [hasOtherOrgs, setHasOtherOrgs] = useState(false);
  const [otherOrgId, setOtherOrgId] = useState("");

  // Load existing org data + check for other completed orgs
  useEffect(() => {
    const activeOrgId = localStorage.getItem("activeOrgId");

    // Fetch all orgs (no org header) to check for completed orgs
    const fetchAllOrgs = fetch("/api/v1/organization")
      .then((r) => r.json())
      .then((data) => {
        const orgs = data.organizations as Array<OrgData & { role: string }> | undefined;
        if (orgs) {
          const completedOrg = orgs.find((o) => o.country !== null);
          if (completedOrg) {
            setHasOtherOrgs(true);
            setOtherOrgId(completedOrg.id);
          }
        }
      })
      .catch(() => {});

    // Fetch active org data if set
    const fetchActiveOrg = activeOrgId
      ? fetch("/api/v1/organization", {
          headers: { "x-organization-id": activeOrgId },
        })
          .then((r) => r.json())
          .then((data) => {
            const org = data.organization as OrgData | undefined;
            if (org) {
              setOrgId(org.id);
              setOrgName(org.name);
              if (org.countryCode) setCountryCode(org.countryCode);
              if (org.businessType) setBusinessType(org.businessType);
              if (org.industrySector) setIndustry(org.industrySector);
            }
          })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([fetchAllOrgs, fetchActiveOrg]).finally(() => setLoading(false));
  }, []);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(value: string) {
    setOrgName(value);
  }

  function goNext() {
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return orgName.trim().length > 0;
      case 1:
        return countryCode.length > 0;
      case 2:
        return businessType.length > 0;
      case 3: // optional
      case 4: // optional
        return true;
      default:
        return true;
    }
  }

  function isOptionalStep(): boolean {
    return step === 3 || step === 4;
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      let currentOrgId = orgId;

      // If no org exists yet, create one first
      if (!currentOrgId) {
        const createRes = await fetch("/api/v1/organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: orgName, slug: generateSlug(orgName) }),
        });

        if (!createRes.ok) {
          const data = await createRes.json();
          throw new AuthPresentationError(authErrorMessage(te, data.error, t("createFailed"), createRes.status));
        }

        const createData = await createRes.json();
        currentOrgId = createData.organization.id;
        setActiveOrganization(currentOrgId);
      }

      const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);
      const finalReferral =
        referralSource === "other" && referralOther.trim()
          ? `other: ${referralOther.trim()}`
          : referralSource;

      const patchHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (currentOrgId) {
        patchHeaders["x-organization-id"] = currentOrgId;
      }

      const res = await fetch("/api/v1/organization", {
        method: "PATCH",
        headers: patchHeaders,
        body: JSON.stringify({
          name: orgName,
          country: selectedCountry?.name ?? null,
          countryCode: countryCode || null,
          defaultCurrency: selectedCountry?.defaultCurrency ?? "USD",
          businessType: businessType || null,
          industrySector: industry || null,
          referralSource: finalReferral || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new AuthPresentationError(authErrorMessage(te, data.error, t("updateFailed"), res.status));
      }

      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof AuthPresentationError ? err.message : t("failed"));
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-lg">
      {hasOtherOrgs && (
        <button
          onClick={() => {
            setActiveOrganization(otherOrgId);
            window.location.href = "/dashboard";
          }}
          className="mb-4 flex min-w-0 items-center gap-1.5 text-start text-sm font-medium whitespace-normal text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowUpRight className="size-3.5 shrink-0 [&:dir(rtl)]:-rotate-90" />
          {t("dashboard")}
        </button>
      )}
      {/* Step content */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/5 dark:shadow-black/40">
        {/* Grain gradient banner */}
        <div className="relative overflow-hidden">
          <GrainGradient
            className="pointer-events-none !absolute !inset-0 !rounded-none"
            width="100%"
            height="100%"
            colors={["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#34d399", "#a7f3d0"]}
            colorBack="#34d399"
            softness={1}
            intensity={0.8}
            noise={0.9}
            shape="wave"
            scale={3.5}
            speed={0.2}
          />
          <div className="relative flex min-w-0 items-center justify-center gap-3 px-3 py-5">
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={i}
                    className={`flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-300 ${
                      i === step
                        ? "border border-white/25 bg-white/20 text-white backdrop-blur-sm"
                        : i < step
                          ? "text-white/70"
                          : "text-white/30"
                    }`}
                  >
                    <Icon className="size-3 shrink-0" />
                    {i === step && (
                      <span className="[overflow-wrap:anywhere]">{s.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * (readingDirection === "rtl" ? -40 : 40) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * (readingDirection === "rtl" ? 40 : -40) }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {step === 0 && (
                <StepOrgName
                  name={orgName}
                  onNameChange={handleNameChange}
                />
              )}
              {step === 1 && (
                <StepCountry
                  selected={countryCode}
                  onSelect={(code) => {
                    setCountryCode(code);
                    setBusinessType("");
                  }}
                />
              )}
              {step === 2 && (
                <StepBusinessType
                  countryCode={countryCode}
                  selected={businessType}
                  onSelect={setBusinessType}
                />
              )}
              {step === 3 && (
                <StepIndustry selected={industry} onSelect={setIndustry} />
              )}
              {step === 4 && (
                <StepReferral
                  selected={referralSource}
                  other={referralOther}
                  onSelect={setReferralSource}
                  onOtherChange={setReferralOther}
                />
              )}
              {step === 5 && (
                <StepReview
                  orgName={orgName}
                  countryCode={countryCode}
                  businessType={businessType}
                  industry={industry}
                  referralSource={referralSource}
                  referralOther={referralOther}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-10">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
            className="h-auto min-h-9 min-w-0 gap-1.5 whitespace-normal text-start"
          >
            <ArrowLeft className="size-4 [&:dir(rtl)]:rotate-180" />
            {t("back")}
          </Button>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {isOptionalStep() && (
              <Button variant="ghost" onClick={goNext} className="h-auto min-h-9 min-w-0 whitespace-normal text-start text-muted-foreground">
                {t("skip")}
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                onClick={goNext}
                disabled={!canProceed()}
                className="h-auto min-h-9 min-w-0 gap-1.5 whitespace-normal text-start bg-emerald-600 shadow-md shadow-emerald-600/15 hover:bg-emerald-500"
              >
                {t("next")}
                <ArrowRight className="size-4 [&:dir(rtl)]:rotate-180" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={submitting}
                className="h-auto min-h-9 min-w-0 gap-1.5 whitespace-normal text-start bg-emerald-600 shadow-md shadow-emerald-600/15 hover:bg-emerald-500"
              >
                {submitting ? t("settingUp") : t("complete")}
                {!submitting && <Check className="size-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Organization Name ──

export function StepOrgName({
  name,
  onNameChange,
}: {
  name: string;
  onNameChange: (v: string) => void;
}) {
  const t = useTranslations("Onboarding");
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("nameTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("nameDescription")}
      </p>
      <div className="mt-6">
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-xs font-medium">
            {t("name")}
          </Label>
          <Input
            id="org-name"
            dir="auto"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("nameExample")}
            autoFocus
            className="h-11 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Country ──

export function StepCountry({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (code: string) => void;
}) {
  const presentation = usePresentation();
  const t = useTranslations("Onboarding");
  const options = useTranslations("OnboardingOptions");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) => countryName(options, c).toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search, options]);

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("countryTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("countryDescription")}
      </p>
      <div className="relative mt-5">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          dir="auto"
          aria-label={t("searchCountries")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchCountries")}
          className="h-10 rounded-lg ps-9"
          autoFocus
        />
      </div>
      <div className="mt-3 max-h-[280px] space-y-1 overflow-y-auto rounded-lg">
        {filtered.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={selected === c.code}
            onClick={() => onSelect(c.code)}
            className={`flex min-w-0 w-full flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
              selected === c.code
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "hover:bg-muted/60"
            }`}
          >
            <span className="text-lg">{c.flag}</span>
            <BidiText className="min-w-0 font-medium">{countryName(options, c)}</BidiText>
            <BidiText className="ms-auto min-w-0 text-xs text-muted-foreground">
              {currencyLabel(c.defaultCurrency, presentation.locale)}
            </BidiText>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("noCountries")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Business Type ──

export function StepBusinessType({
  countryCode,
  selected,
  onSelect,
}: {
  countryCode: string;
  selected: string;
  onSelect: (code: string) => void;
}) {
  const t = useTranslations("Onboarding");
  const options = useTranslations("OnboardingOptions");
  const types = useMemo(
    () => getBusinessTypesForCountry(countryCode),
    [countryCode]
  );

  const country = COUNTRIES.find((c) => c.code === countryCode);

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("typeTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("availableTypes", { country: country ? countryName(options, country) : t("yourCountry") })}
      </p>
      <div className="mt-5 max-h-[320px] space-y-1 overflow-y-auto rounded-lg">
        {types.map((t) => (
          <button
            key={t.code}
            type="button"
            aria-pressed={selected === t.code}
            onClick={() => onSelect(t.code)}
            className={`flex min-w-0 w-full flex-col rounded-lg px-3 py-2.5 text-start transition-colors ${
              selected === t.code
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "hover:bg-muted/60"
            }`}
          >
            <BidiText className="min-w-0 text-sm font-medium">{businessTypeName(options, t)}</BidiText>
            {t.localName !== t.englishName && (
              <BidiText dir="ltr" className="min-w-0 text-xs text-muted-foreground">
                {t.englishName}
              </BidiText>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 4: Industry ──

export function StepIndustry({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (code: string) => void;
}) {
  const t = useTranslations("Onboarding");
  const options = useTranslations("OnboardingOptions");
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("industryTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("industryDescription")}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {INDUSTRIES.map((ind) => (
          <button
            key={ind.code}
            type="button"
            aria-pressed={selected === ind.code}
            onClick={() => onSelect(selected === ind.code ? "" : ind.code)}
            className={`min-w-0 rounded-lg px-3 py-2.5 text-start text-sm font-medium [overflow-wrap:anywhere] transition-colors ${
              selected === ind.code
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "hover:bg-muted/60"
            }`}
          >
            {industryName(options, ind)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 5: Referral ──

export function StepReferral({
  selected,
  other,
  onSelect,
  onOtherChange,
}: {
  selected: string;
  other: string;
  onSelect: (code: string) => void;
  onOtherChange: (v: string) => void;
}) {
  const t = useTranslations("Onboarding");
  const options = useTranslations("OnboardingOptions");
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("referralTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("referralDescription")}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REFERRAL_SOURCES.map((src) => (
          <button
            key={src.code}
            type="button"
            aria-pressed={selected === src.code}
            onClick={() => onSelect(selected === src.code ? "" : src.code)}
            className={`min-w-0 rounded-lg px-3 py-2.5 text-start text-sm font-medium [overflow-wrap:anywhere] transition-colors ${
              selected === src.code
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "hover:bg-muted/60"
            }`}
          >
            {referralName(options, src)}
          </button>
        ))}
      </div>
      {selected === "other" && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="referral-other" className="text-xs font-medium">
            {t("specify")}
          </Label>
          <Input
            id="referral-other"
            dir="auto"
            value={other}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder={t("more")}
            className="h-10 rounded-lg"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// ── Step 6: Review ──

export function StepReview({
  orgName,
  countryCode,
  businessType,
  industry,
  referralSource,
  referralOther,
}: {
  orgName: string;
  countryCode: string;
  businessType: string;
  industry: string;
  referralSource: string;
  referralOther: string;
}) {
  const presentation = usePresentation();
  const t = useTranslations("Onboarding");
  const options = useTranslations("OnboardingOptions");
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const types = getBusinessTypesForCountry(countryCode);
  const bt = types.find((t) => t.code === businessType);
  const ind = INDUSTRIES.find((i) => i.code === industry);
  const ref = REFERRAL_SOURCES.find((r) => r.code === referralSource);

  const items: { label: string; value: string }[] = [
    { label: t("organization"), value: orgName },
    {
      label: t("country"),
      value: country ? `${country.flag} ${countryName(options, country)}` : "-",
    },
    { label: t("currency"), value: country ? currencyLabel(country.defaultCurrency, presentation.locale) : "-" },
    { label: t("businessType"), value: bt ? businessTypeName(options, bt) : "-" },
    { label: t("industry"), value: ind ? industryName(options, ind) : "-" },
    {
      label: t("referral"),
      value:
        referralSource === "other" && referralOther
          ? referralOther
          : ref ? referralName(options, ref) : "-",
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {t("ready")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("reviewDescription")}
      </p>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/40 px-4 py-3"
          >
            <span className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.label}</span>
            <BidiText className="min-w-0 text-sm font-medium text-foreground">
              {item.value}
            </BidiText>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 dark:bg-amber-950/30">
        <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t("chartNotice")}
        </p>
      </div>
    </div>
  );
}
