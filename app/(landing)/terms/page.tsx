import { useTranslations } from "next-intl";

import type { Metadata } from "next";
import { Scale, Clock, BookOpen } from "lucide-react";
import {
  LegalPageLayout,
  Callout,
  type LegalSection,
} from "@/components/legal/legal-page-layout";

type LegalTranslator = ReturnType<typeof useTranslations<"PublicPricingLegal">>;

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of the dubbl hosted service, operated by Mindroot Ltd.",
};

const getSections = (t: LegalTranslator): LegalSection[] => [
  {
    id: "company-details",
    title: t("companyDetails"),
    content: (
      <>
        <p>{t("theDubblHostedServiceAtDubblDevIs")}</p>
        <p>
          <strong>Mindroot Ltd</strong>
          <br />
          Company No. 16543299, registered in England and Wales
          <br />
          Registered office: 71-75 Shelton Street, London, England, WC2H 9JQ
          <br />
          Contact: <a href="mailto:team@dubbl.dev">team@dubbl.dev</a>
        </p>
        <p>{t("thisInformationIsProvidedInComplianceWithThe")}</p>
      </>
    ),
  },
  {
    id: "service-description",
    title: t("serviceDescription"),
    content: (
      <>
        <p>{t.rich("dubblIsADoubleEntryBookkeepingPlatformAvailable", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        <p>{t("theServiceAllowsYouToRecordFinancialTransactions")}</p>
      </>
    ),
  },
  {
    id: "account-terms",
    title: t("accountTerms"),
    content: (
      <>
        <p>{t("toUseTheServiceYouMust")}</p>
        <ul>
          <li>{t("beAtLeast16YearsOfAge")}</li>
          <li>{t("provideAccurateAndCompleteRegistrationInformation")}</li>
          <li>{t("keepYourAccountCredentialsSecureYouAreResponsible")}</li>
        </ul>
        <p>{t.rich("youMustNotifyUsImmediatelyAtTeamDubbl", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "subscription-payment",
    title: t("subscriptionPayment"),
    content: (
      <>
        <p>{t("dubblOffersAFreeTierAndPaidSubscription")}</p>
        <ul>
          <li>{t("paidSubscriptionsAreBilledInAdvanceOnA")}</li>
          <li>
            Payments are processed securely by <strong>Stripe</strong>. By
            subscribing, you also agree to{" "}
            <a
              href="https://stripe.com/legal"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe&apos;s terms of service
            </a>
            .
          </li>
          <li>{t.rich("weWillGiveAtLeast30DaysNotice", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "open-source-vs-hosted",
    title: t("openSourceVsHostedService"),
    content: (
      <>
        <Callout icon={BookOpen} title={t("openSourceDistinction")}>
          <p>{t.rich("theDubblSourceCodeIsLicensedUnderThe", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
          <p>{t.rich("theseTermsOfServiceApplyOnlyToThe", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        </Callout>
      </>
    ),
  },
  {
    id: "cancellation-cooling-off",
    title: t("cancellationCoolingOff"),
    content: (
      <>
        <Callout icon={Clock} title={t("legal14DayCoolingOffPeriod")}>
          <p>{t.rich("underTheConsumerContractsInformationCancellationAndAdditional", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        </Callout>
        <p>{t("ifYouCancelDuringTheCoolingOffPeriod")}</p>
        <ul>
          <li>{t("youMayBeChargedProportionallyForTheService")}</li>
          <li>{t("anyRefundDueWillBeProcessedWithin14")}</li>
        </ul>
        <p>{t("afterTheCoolingOffPeriodYouMayCancel")}</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: t("acceptableUse"),
    content: (
      <>
        <p>{t("youAgreeNotToUseTheServiceTo")}</p>
        <ul>
          <li>{t("engageInAnyUnlawfulActivityOrProcessData")}</li>
          <li>{t("attemptToGainUnauthorisedAccessToTheService")}</li>
          <li>{t("deliberatelyOverloadDisruptOrInterfereWithTheService")}</li>
          <li>{t("transmitMalwareVirusesOrOtherHarmfulCode")}</li>
        </ul>
        <p>{t("weReserveTheRightToSuspendOrTerminate")}</p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: t("intellectualProperty"),
    content: (
      <>
        <ul>
          <li>{t.rich("theDubblSourceCodeIsLicensedUnderThe2", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("theDubblBrandLogosServiceDesignAndHosted", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("yourDataYouRetainFullOwnershipOfAll", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "data-protection",
    title: t("dataProtection"),
    content: (
      <>
        <p>{t.rich("ourProcessingOfYourPersonalDataIsGoverned", {em: (chunks) => <a href="/privacy">{chunks}</a>})}</p>
        <p>{t.rich("forBookkeepingDataYouEnterIntoTheService", {strong: (chunks) => <strong>{chunks}</strong>, em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "limitation-of-liability",
    title: t("limitationOfLiability"),
    content: (
      <>
        <p>{t.rich("toTheMaximumExtentPermittedByLawMindroot", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        <Callout icon={Scale} title={t("yourStatutoryRightsAreNotAffected")}>
          <p>{t("nothingInTheseTermsExcludesOrLimitsLiability")}</p>
          <ul>
            <li>{t("deathOrPersonalInjuryCausedByNegligence")}</li>
            <li>{t("fraudOrFraudulentMisrepresentation")}</li>
            <li>{t("anyLiabilityThatCannotBeExcludedUnderThe")}</li>
          </ul>
        </Callout>
        <p>{t("weAreNotLiableForIndirectIncidentalSpecial")}</p>
      </>
    ),
  },
  {
    id: "digital-content-quality",
    title: t("digitalContentQuality"),
    content: (
      <>
        <p>{t.rich("underChapter3OfTheConsumerRightsAct", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        <ul>
          <li>{t("ofSatisfactoryQuality")}</li>
          <li>{t("fitForAParticularPurpose")}</li>
          <li>{t("asDescribed")}</li>
        </ul>
        <p>{t.rich("ifTheDigitalContentIsFaultyOrDoes", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "termination",
    title: t("termination"),
    content: (
      <>
        <ul>
          <li>{t.rich("byYouYouMayCloseYourAccountAt", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("byUsForBreachWeMaySuspendOr", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("byUsWithoutCauseWeMayTerminateYour", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
        <p>{t.rich("uponTerminationYouWillHaveA30Day", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
      </>
    ),
  },
  {
    id: "dispute-resolution",
    title: t("disputeResolution"),
    content: (
      <>
        <p>{t.rich("ifADisputeArisesWeEncourageYouTo", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
        <p>{t("ifInformalResolutionIsUnsuccessfulEitherPartyMay")}</p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: t("governingLaw"),
    content: (
      <>
        <p>{t.rich("theseTermsAreGovernedByTheLawsOf", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        <p>{t("ifYouAreAConsumerResidentInThe")}</p>
      </>
    ),
  },
  {
    id: "changes-to-terms",
    title: t("changesToTerms"),
    content: (
      <>
        <p>{t.rich("weMayUpdateTheseTermsFromTimeTo", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
        <p>{t("continuedUseOfTheServiceAfterTheEffective")}</p>
      </>
    ),
  },
  {
    id: "severability",
    title: t("severabilityGeneral"),
    content: (
      <>
        <ul>
          <li>{t.rich("severabilityIfAnyProvisionOfTheseTermsIs", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("noWaiverFailureToEnforceAnyProvisionDoes", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("entireAgreementTheseTermsTogetherWithOurPrivacy", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("noAssignmentYouMayNotAssignOrTransfer", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
];

export default function TermsPage() {
  const t = useTranslations("PublicPricingLegal");
  return (
    <LegalPageLayout
      badge={t("legal")}
      title={t("termsOfService")}
      subtitle={t("theTermsGoverningYourUseOfTheDubbl")}
      lastUpdated="2 March 2026"
      sections={getSections(t)}
    />
  );
}
