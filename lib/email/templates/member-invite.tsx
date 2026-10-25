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

interface MemberInviteEmailProps {
  locale?: AppLocale;
  inviterName: string;
  orgName: string;
  role: string;
  loginUrl?: string;
}

export function MemberInviteEmail({
  locale = "en-US",
  inviterName,
  orgName,
  role = "member",
  loginUrl = toAppUrl("/sign-in"),
}: MemberInviteEmailProps) {
  const t = outputTranslator(locale);
  orgName ??= t("anOrg");
  inviterName ??= t("someone");
  return (
    <EmailLayout locale={locale} preview={t("invitePreview", { orgName })}>
      <Section style={content}>
        <Text style={heading}>{t.rich("inviteHeading", { orgName, ...emailRichText })}</Text>
        <Text style={subtext}>
          {t.rich("inviteIntro", { inviterName, orgName, role, ...emailRichText })}
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={infoTable}>
          <tr>
            <td style={infoRow}>
              <Text style={infoLabel}>{t("organization")}</Text>
              <Text style={infoValue}><EmailValue>{orgName}</EmailValue></Text>
            </td>
          </tr>
          <tr>
            <td style={infoRow}>
              <Text style={infoLabel}>{t("yourRole")}</Text>
              <Text style={infoValue}><EmailValue>{role}</EmailValue></Text>
            </td>
          </tr>
          <tr>
            <td style={{ ...infoRow, borderBottom: "none", paddingBottom: 0 }}>
              <Text style={infoLabel}>{t("invitedBy")}</Text>
              <Text style={infoValue}><EmailValue>{inviterName}</EmailValue></Text>
            </td>
          </tr>
        </table>

        <Section style={buttonSection}>
          <Button style={button} href={loginUrl}>
            {t("acceptInvite")}
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

export default MemberInviteEmail;

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
const infoTable: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
};
const infoRow: React.CSSProperties = {
  padding: "12px 18px",
  borderBottom: "1px solid #f3f4f6",
};
const infoLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#9ca3af",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 1px",
};
const infoValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#111827",
  fontWeight: 500,
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
