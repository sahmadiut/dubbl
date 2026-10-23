import { outputTranslator } from "@/i18n/output";
import type { AppLocale } from "@/i18n/locale";
import {
  Section,
  Text,
  Button,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./layout";
import { toAppUrl } from "@/lib/public-url";

interface OrgCreatedEmailProps {
  locale?: AppLocale;
  userName: string;
  orgName: string;
  dashboardUrl?: string;
}

export function OrgCreatedEmail({
  locale = "en-US",
  userName,
  orgName,
  dashboardUrl = toAppUrl("/dashboard"),
}: OrgCreatedEmailProps) {
  const t = outputTranslator(locale);
  orgName ??= t("yourOrg");
  userName ??= t("there");
  return (
    <EmailLayout locale={locale} preview={t("orgPreview", { orgName })}>
      <Section style={content}>
        <Text style={heading}>{t("orgHeading", { orgName })}</Text>
        <Text style={subtext}>
          {t("orgIntro", { userName })}
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          {[
            {
              num: "1",
              title: t("setup"),
              desc: t("setupDesc"),
            },
            {
              num: "2",
              title: t("inviteTeam"),
              desc: t("inviteTeamDesc"),
            },
            {
              num: "3",
              title: t("connectBank"),
              desc: t("connectBankDesc"),
            },
          ].map((step) => (
            <tr key={step.num}>
              <td style={stepCell}>
                <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
                  <tr>
                    <td style={stepNumCell}>
                      <div style={stepNumBadge}>{step.num}</div>
                    </td>
                    <td style={stepContentCell}>
                      <Text style={stepTitle}>{step.title}</Text>
                      <Text style={stepDesc}>{step.desc}</Text>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          ))}
        </table>

        <Section style={buttonSection}>
          <Button style={button} href={dashboardUrl}>
            {t("openOrg")}
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default OrgCreatedEmail;

const content: React.CSSProperties = { padding: "24px 40px 32px" };
const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 8px",
};
const subtext: React.CSSProperties = {
  fontSize: "15px",
  color: "#4b5563",
  lineHeight: "24px",
  margin: "0 0 24px",
};
const stepCell: React.CSSProperties = {
  paddingBottom: "12px",
};
const stepNumCell: React.CSSProperties = {
  verticalAlign: "top",
  width: "36px",
  paddingTop: "2px",
};
const stepNumBadge: React.CSSProperties = {
  width: "24px",
  height: "24px",
  lineHeight: "24px",
  borderRadius: "50%",
  backgroundColor: "#059669",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 700,
  textAlign: "center" as const,
};
const stepContentCell: React.CSSProperties = {
  verticalAlign: "top",
};
const stepTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#111827",
  margin: "0 0 2px",
};
const stepDesc: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  lineHeight: "20px",
  margin: 0,
};
const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginTop: "24px",
};
const button: React.CSSProperties = {
  backgroundColor: "#059669",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
};
