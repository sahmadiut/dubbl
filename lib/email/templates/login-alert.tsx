import { outputTranslator } from "@/i18n/output";
import type { AppLocale } from "@/i18n/locale";
import {
  Section,
  Text,
  Button,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailValue, emailRichText } from "./layout";
import { toAppUrl } from "@/lib/public-url";

interface LoginAlertEmailProps {
  locale?: AppLocale;
  userName: string;
  ipAddress: string;
  userAgent?: string;
  provider: string;
  timestamp: string;
  securityUrl?: string;
}

export function LoginAlertEmail({
  locale = "en-US",
  userName,
  ipAddress,
  userAgent,
  provider = "credentials",
  timestamp = new Date().toLocaleString(),
  securityUrl = toAppUrl("/settings"),
}: LoginAlertEmailProps) {
  const t = outputTranslator(locale);
  userAgent ??= t("unknownBrowser");
  ipAddress ??= t("unknown");
  userName ??= t("there");
  return (
    <EmailLayout locale={locale} preview={t("loginPreview", { ipAddress })}>
      <Section style={content}>
        <Text style={heading}>{t("loginHeading")}</Text>
        <Text style={subtext}>
          {t.rich("loginIntro", { userName, ...emailRichText })}
        </Text>

        <div style={detailsCard}>
          <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
            <tr>
              <td style={{ ...detailLabel, ...(locale === "fa-IR" ? { paddingLeft: "16px" } : { paddingRight: "16px" }) }}>{t("ip")}</td>
              <td style={detailValue}><EmailValue dir="ltr">{ipAddress}</EmailValue></td>
            </tr>
            <tr>
              <td style={{ ...detailLabel, ...(locale === "fa-IR" ? { paddingLeft: "16px" } : { paddingRight: "16px" }) }}>{t("browser")}</td>
              <td style={detailValue}><EmailValue>{userAgent}</EmailValue></td>
            </tr>
            <tr>
              <td style={{ ...detailLabel, ...(locale === "fa-IR" ? { paddingLeft: "16px" } : { paddingRight: "16px" }) }}>{t("method")}</td>
              <td style={detailValue}><EmailValue dir="ltr">{provider}</EmailValue></td>
            </tr>
            <tr>
              <td style={{ ...detailLabel, ...(locale === "fa-IR" ? { paddingLeft: "16px" } : { paddingRight: "16px" }) }}>{t("time")}</td>
              <td style={detailValue}><EmailValue>{timestamp}</EmailValue></td>
            </tr>
          </table>
        </div>

        <Text style={warningText}>
          {t("loginWarning")}
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={securityUrl}>
            {t("reviewAccount")}
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default LoginAlertEmail;

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
const detailsCard: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "20px",
  border: "1px solid #fecaca",
};
const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#6b7280",
  padding: "4px 0",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};
const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: "#111827",
  padding: "4px 0",
  verticalAlign: "top",
  overflowWrap: "anywhere",
};
const warningText: React.CSSProperties = {
  fontSize: "14px",
  color: "#dc2626",
  lineHeight: "22px",
  margin: "0 0 16px",
  fontWeight: 500,
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
