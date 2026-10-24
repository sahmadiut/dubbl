import { useTranslations } from "next-intl";

import type { Metadata } from "next";
import { Shield } from "lucide-react";
import {
  LegalPageLayout,
  Callout,
  type LegalSection,
} from "@/components/legal/legal-page-layout";

type LegalTranslator = ReturnType<typeof useTranslations<"PublicPricingLegal">>;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How dubbl (Mindroot Ltd) collects, uses, and protects your personal data under the UK GDPR.",
};

const getSections = (t: LegalTranslator): LegalSection[] => [
  {
    id: "data-controller",
    title: t("dataController"),
    content: (
      <>
        <p>{t("theDataControllerForPersonalDataProcessedThrough")}</p>
        <p>
          <strong>Mindroot Ltd</strong>
          <br />
          Company No. 16543299, registered in England and Wales
          <br />
          71-75 Shelton Street, London, England, WC2H 9JQ
          <br />
          ICO Registration: ZB958997
        </p>
        <p>{t.rich("forDataProtectionEnquiriesContactUsAtTeam", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: t("informationWeCollect"),
    content: (
      <>
        <p>{t("weCollectTheFollowingCategoriesOfPersonalData")}</p>
        <ul>
          <li>{t.rich("accountDataNameEmailAddressAndAuthenticationCredentials", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("usageDataPagesVisitedFeaturesUsedSessionDuration", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>
            <strong>Payment data</strong> ·processed securely by Stripe. We
            store only the last four digits of your card, billing address, and
            transaction history. We never have access to your full card number.
          </li>
          <li>{t.rich("communicationDataMessagesYouSendUsViaEmail", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("cookiesSimilarTechnologiesSeeSection10ForDetails", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "purposes-of-processing",
    title: t("purposesOfProcessing"),
    content: (
      <>
        <p>{t("weProcessYourPersonalDataForTheFollowing")}</p>
        <ul>
          <li>{t.rich("serviceDeliveryProvidingMaintainingAndImprovingTheDubbl", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>
            <strong>Payments</strong> ·processing subscriptions and invoices
            via Stripe.
          </li>
          <li>{t.rich("communicationRespondingToSupportRequestsSendingServiceUpdates", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("improvementUnderstandingHowTheServiceIsUsedTo", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("securityDetectingPreventingAndRespondingToFraudAbuse", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("legalComplianceMeetingOurObligationsUnderApplicableLaw", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "lawful-bases",
    title: t("lawfulBases"),
    content: (
      <>
        <p>{t("weRelyOnTheFollowingLawfulBasesUnder")}</p>
        <ul>
          <li>{t.rich("contractArt61BProcessingNecessaryTo", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("legitimateInterestsArt61FImprovingOur", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("consentArt61AWhereYouOpt", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("legalObligationArt61CWhereWe", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "data-sharing",
    title: t("dataSharing"),
    content: (
      <>
        <p>{t("weSharePersonalDataOnlyWithTheFollowing")}</p>
        <ul>
          <li>{t.rich("hostingProvidersInfrastructureAndCloudServicesThatStore", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>
            <strong>Stripe</strong> ·payment processing. Stripe acts as an
            independent controller for payment data.
          </li>
          <li>{t.rich("analyticsProvidersToUnderstandUsagePatternsAndImprove", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
        <p>{t.rich("weDoNotSellYourPersonalDataTo", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: t("internationalTransfers"),
    content: (
      <>
        <p>{t("someOfOurServiceProvidersMayProcessData")}</p>
        <ul>
          <li>{t("transfersToCountriesWithUKAdequacyRegulationsIncluding")}</li>
          <li>{t("standardContractualClausesSCCsAndOrTheInternational")}</li>
        </ul>
      </>
    ),
  },
  {
    id: "data-retention",
    title: t("dataRetention"),
    content: (
      <>
        <p>{t("weRetainPersonalDataOnlyAsLongAs")}</p>
        <ul>
          <li>{t.rich("accountDataRetainedWhileYourAccountIsActive", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("usageDataRetainedForUpTo26Months", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("paymentRecordsRetainedFor7YearsToComply", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
      </>
    ),
  },
  {
    id: "your-rights",
    title: t("yourRights"),
    content: (
      <>
        <p>{t("underTheUKGDPRYouHaveTheFollowing")}</p>
        <Callout icon={Shield} title={t("yourDataRights")}>
          <ul>
            <li>{t("rightOfAccessObtainACopyOfYour")}</li>
            <li>{t("rightToRectificationCorrectInaccurateData")}</li>
            <li>{t("rightToErasureRequestDeletionOfYourData")}</li>
            <li>{t("rightToRestrictProcessing")}</li>
            <li>{t("rightToDataPortabilityReceiveDataInA")}</li>
            <li>{t("rightToObjectObjectToProcessingBasedOn")}</li>
            <li>{t("rightsRelatedToAutomatedDecisionMakingAndProfiling")}</li>
            <li>{t("rightToWithdrawConsentAtAnyTime")}</li>
          </ul>
        </Callout>
        <p>{t.rich("toExerciseAnyOfTheseRightsContactUs", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "right-to-complain",
    title: t("rightToComplain"),
    content: (
      <>
        <p>{t("ifYouAreUnhappyWithHowWeHandle")}</p>
        <p>
          Information Commissioner&apos;s Office
          <br />
          Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF
          <br />
          Telephone: 0303 123 1113
          <br />
          Website:{" "}
          <a
            href="https://ico.org.uk"
            target="_blank"
            rel="noopener noreferrer"
          >
            ico.org.uk
          </a>
        </p>
        <p>{t.rich("weEncourageYouToContactUsFirstAt", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: t("cookies"),
    content: (
      <>
        <p>{t("weUseTheFollowingTypesOfCookies")}</p>
        <ul>
          <li>{t.rich("strictlyNecessaryCookiesEssentialForTheServiceTo", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("functionalCookiesRememberYourPreferencesSuchAsTheme", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
          <li>{t.rich("analyticsCookiesHelpUsUnderstandHowTheService", {strong: (chunks) => <strong>{chunks}</strong>})}</li>
        </ul>
        <p>{t("youCanManageCookiePreferencesThroughYourBrowser")}</p>
      </>
    ),
  },
  {
    id: "self-hosted-instances",
    title: t("selfHostedInstances"),
    content: (
      <>
        <p>{t.rich("thisPrivacyPolicyAppliesExclusivelyToTheHosted", {strong: (chunks) => <strong>{chunks}</strong>})}</p>
      </>
    ),
  },
  {
    id: "childrens-data",
    title: t("childrenSData"),
    content: (
      <>
        <p>{t.rich("dubblIsNotDirectedAtIndividualsUnderThe", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "security",
    title: t("security"),
    content: (
      <>
        <p>{t("weImplementAppropriateTechnicalAndOrganisationalMeasuresTo")}</p>
        <ul>
          <li>{t("tLSEncryptionForAllDataInTransit")}</li>
          <li>{t("encryptionAtRestForStoredData")}</li>
          <li>{t("accessControlsEnsuringOnlyAuthorisedPersonnelCanAccess")}</li>
          <li>{t("regularSecurityReviewsAndMonitoring")}</li>
        </ul>
        <p>{t.rich("noSystemIs100SecureIfYouDiscover", {em: (chunks) => <a href="mailto:team@dubbl.dev">{chunks}</a>})}</p>
      </>
    ),
  },
  {
    id: "changes",
    title: t("changesToThisPolicy"),
    content: (
      <>
        <p>{t("weMayUpdateThisPrivacyPolicyFromTime")}</p>
        <p>{t("weEncourageYouToReviewThisPagePeriodically")}</p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  const t = useTranslations("PublicPricingLegal");
  return (
    <LegalPageLayout
      badge={t("legal")}
      title={t("privacyPolicy")}
      subtitle={t("howWeCollectUseAndProtectYourPersonal")}
      lastUpdated="2 March 2026"
      sections={getSections(t)}
    />
  );
}
