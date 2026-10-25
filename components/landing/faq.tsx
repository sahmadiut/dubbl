import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";

type LandingTranslator = ReturnType<typeof useTranslations>;

const getFaqs = (t: LandingTranslator) => [
  {
    question: t("isDubblReallyFree"),
    answer:
      t("yesDubblIsOpenSourceUnderTheApache2"),
  },
  {
    question: t("canISelfHostDubbl"),
    answer:
      t("absolutelyDubblIsDesignedForSelfHostingWeProvide"),
  },
  {
    question: t("doesDubblSupportMultiCurrency"),
    answer:
      t("yesDubblSupportsTransactionsInAnyCurrencyWithAutomatic"),
  },
  {
    question: t("howDoesDoubleEntryBookkeepingWorkInDubbl"),
    answer:
      t("everyTransactionMustHaveBalancedDebitsAndCreditsThis"),
  },
  {
    question: t("canIMigrateFromQuickBooksOrXero"),
    answer:
      t("yesDubblSupportsCSVImportWithBuiltInColumn"),
  },
  {
    question: t("isThereAnAPI"),
    answer:
      t("dubblIsAPIFirstEveryFeatureAvailableInThe"),
  },
  {
    question: t("howDoIContributeToDubbl"),
    answer:
      t("weWelcomeContributionsCheckOutOurGitHubRepositoryFor"),
  },
  {
    question: t("isDubblSuitableForEnterpriseUse"),
    answer:
      t("yesDubblIncludesFeaturesLikeAuditTrailsRoleBased"),
  },
  {
    question: t("whatIsMCPSupport"),
    answer:
      t("mCPModelContextProtocolIsAnOpenStandardThat"),
  },
];

export function FAQ() {
  const t = useTranslations("LandingFeatures");
  return (
    <section className="py-16 md:py-20">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          {/* Left column */}
          <div>
            <SectionHeader
              badge={t("fAQs")}
              title={t("frequentlyAskedQuestions")}
              align="left"
              className="mb-6"
            />
            <p className="text-sm text-muted-foreground">
              {t.rich("contactHelp", {em: (chunks) => <a
                href="https://github.com/dubbl-org/dubbl/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline underline-offset-4 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {chunks}</a>})}
            </p>
          </div>

          {/* Right column */}
          <div>
            <Accordion type="single" collapsible className="w-full">
              {getFaqs(t).map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-border"
                >
                  <AccordionTrigger className="py-5 text-start text-base font-medium text-foreground hover:no-underline md:text-lg">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </Container>
    </section>
  );
}
