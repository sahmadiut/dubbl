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

interface WelcomeEmailProps {
  locale?: AppLocale;
  userName: string;
  loginUrl?: string;
}

export function WelcomeEmail({
  locale = "en-US",
  userName,
  loginUrl = toAppUrl("/sign-in"),
}: WelcomeEmailProps) {
  const t = outputTranslator(locale);
  userName ??= t("there");
  return (
    <EmailLayout locale={locale} preview={t("welcomePreview")}>
      <Section style={content}>
        <Text style={heading}>{t("welcomeHeading", { userName })}</Text>
        <Text style={subtext}>
          {t("welcomeIntro")}
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={featureCell}>
              <div style={featureCard}>
                <Text style={featureTitle}>{t("invoicing")}</Text>
                <Text style={featureDesc}>
                  {t("featureInvoices")}
                </Text>
              </div>
            </td>
          </tr>
          <tr>
            <td style={featureCell}>
              <div style={featureCard}>
                <Text style={featureTitle}>{t("accounting")}</Text>
                <Text style={featureDesc}>
                  {t("featureAccounting")}
                </Text>
              </div>
            </td>
          </tr>
          <tr>
            <td style={featureCell}>
              <div style={featureCard}>
                <Text style={featureTitle}>{t("team")}</Text>
                <Text style={featureDesc}>
                  {t("featureTeam")}
                </Text>
              </div>
            </td>
          </tr>
        </table>

        <Section style={buttonSection}>
          <Button style={button} href={loginUrl}>
            {t("dashboard")}
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default WelcomeEmail;

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
const featureCell: React.CSSProperties = {
  paddingBottom: "8px",
};
const featureCard: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "14px 18px",
};
const featureTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#111827",
  margin: "0 0 2px",
};
const featureDesc: React.CSSProperties = {
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
