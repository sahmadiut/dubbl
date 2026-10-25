import { useTranslations } from "next-intl";
import Link from "next/link";
import { Github, Twitter, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Separator } from "@/components/ui/separator";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function Footer() {
  const t = useTranslations("LandingShell");
  const footerLinks: Record<string, FooterLink[]> = {
    [t("footerProduct")]: [
      { label: t("navPricing"), href: "/pricing" },
      { label: t("navFeatures"), href: "/#features" },
      { label: t("integrations"), href: "/#integrations" },
      { label: t("selfHosting"), href: "/docs/self-hosting" },
      { label: t("changelog"), href: "https://github.com/dubbl-org/dubbl/releases", external: true },
    ],
    [t("footerResources")]: [
      { label: t("documentation"), href: "/docs" },
      { label: t("gettingStarted"), href: "/docs/getting-started" },
      { label: t("migrationGuide"), href: "/docs/guides/import-export" },
      { label: t("jurisdictionGuide"), href: "/docs/guides/jurisdictions" },
      { label: t("apiReference"), href: "/docs/api-reference" },
    ],
    [t("footerGuides")]: [
      { label: t("multiCurrency"), href: "/docs/guides/multi-currency" },
      { label: "Stripe Integration", href: "/docs/guides/stripe-integration" },
      { label: t("taxFilingPrep"), href: "/docs/guides/tax-filing-prep" },
      { label: t("backupsRecovery"), href: "/docs/settings/backups" },
      { label: t("mcpAgents"), href: "/docs/guides/mcp" },
    ],
    [t("footerDevelopers")]: [
      { label: "GitHub", href: "https://github.com/dubbl-org/dubbl", external: true },
      { label: t("contributing"), href: "/docs/contributing" },
      { label: t("developerGuide"), href: "/docs/guides/developer-guide" },
      { label: t("apiKeys"), href: "/docs/settings/api-keys" },
      { label: t("status"), href: "https://status.dubbl.dev", external: true },
    ],
    [t("footerCompany")]: [
      { label: t("privacyPolicy"), href: "/privacy" },
      { label: t("termsService"), href: "/terms" },
      { label: t("auditLog"), href: "/docs/settings/audit-log" },
      { label: t("security"), href: "/docs/self-hosting" },
    ],
  };

  const socialLinks = [
    { icon: Github, href: "https://github.com/dubbl-org/dubbl", label: "GitHub" },
    { icon: Twitter, href: "https://x.com/DubblHQ", label: "X" },
  ];

  return (
    <footer className="bg-[#0a0a0a] pt-16 pb-8 text-white">
      <Container>
        {/* Top section */}
        <div className="grid min-w-0 grid-cols-2 [overflow-wrap:anywhere] gap-10 md:grid-cols-6 md:gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-bold tracking-tight text-white">
                dubbl
              </span>
            </div>
            <p className="mt-3 max-w-[220px] text-sm leading-relaxed text-white/50">
              {t("footerDescription")}
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                  aria-label={link.label}
                >
                  <link.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/70">
                {title}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/40 transition-colors hover:text-white/70"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/40 transition-colors hover:text-white/70"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom separator */}
        <Separator className="my-8 bg-white/10" />

        {/* Bottom row */}
        <div className="flex min-w-0 flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-white/40">
              {t("copyright", { year: "2026" })}
            </p>
            <p className="text-[11px] text-white/25">
              {t("companyDetails")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-white/60">
              {t("openSelfHostable")}
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
