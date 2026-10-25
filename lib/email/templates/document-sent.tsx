import { outputDocumentKind, outputTranslator } from "@/i18n/output";
import type { AppLocale } from "@/i18n/locale";
import {
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailValue, emailRichText } from "./layout";

export interface DocumentSentEmailProps {
  locale?: AppLocale;
  organizationName: string;
  contactName: string;
  documentType: string;
  documentNumber: string;
  personalMessage?: string;
  amountFormatted?: string;
  dueDateFormatted?: string;
  issueDateFormatted?: string;
  viewUrl?: string;
  buttonLabel?: string;
}

export function DocumentSentEmail({
  locale = "en-US",
  organizationName,
  documentType = "invoice",
  documentNumber = "",
  personalMessage,
  amountFormatted,
  dueDateFormatted,
  issueDateFormatted,
  viewUrl,
  buttonLabel,
}: DocumentSentEmailProps) {
  const t = outputTranslator(locale);
  organizationName ??= t("yourCompany");
  const kind = outputDocumentKind(documentType);
  const preview = t(`${kind}Preview`, { documentNumber, organizationName });
  const amountLabel = documentType === "quote" ? t("total") : t("amountDue");
  const dateLabel = documentType === "quote" ? t("validUntil") : t("dueDate");

  return (
    <EmailLayout locale={locale} preview={preview}>
      <Section style={content}>
        {/* Heading */}
        <Text style={heading}>
          {t.rich(`${kind}Heading`, { organizationName, ...emailRichText })}
        </Text>

        {/* Document number */}
        <Text style={docNumber}><EmailValue dir="ltr">{documentNumber}</EmailValue></Text>

        {personalMessage && (
          <Text style={message}><EmailValue>{personalMessage}</EmailValue></Text>
        )}

        {/* Amount block */}
        {amountFormatted && (
          <Section style={amountBlock}>
            <Text style={amountLabelStyle}>{amountLabel}</Text>
            <Text style={amountValue}><EmailValue dir="ltr">{amountFormatted}</EmailValue></Text>
          </Section>
        )}

        {/* Meta row */}
        {(issueDateFormatted || dueDateFormatted) && (
          <table cellPadding="0" cellSpacing="0" role="presentation" style={metaTable}>
            <tr>
              {issueDateFormatted && (
                <td style={{ ...metaCell, ...(locale === "fa-IR" ? { paddingLeft: "24px" } : { paddingRight: "24px" }) }}>
                  <Text style={metaLabel}>{t("issued")}</Text>
                  <Text style={metaValue}><EmailValue>{issueDateFormatted}</EmailValue></Text>
                </td>
              )}
              {dueDateFormatted && (
                <td style={{ ...metaCell, ...(locale === "fa-IR" ? { paddingLeft: "24px" } : { paddingRight: "24px" }) }}>
                  <Text style={metaLabel}>{dateLabel}</Text>
                  <Text style={metaValue}><EmailValue>{dueDateFormatted}</EmailValue></Text>
                </td>
              )}
            </tr>
          </table>
        )}

        {/* CTA button */}
        {viewUrl && (
          <Section style={buttonWrap}>
            <Button style={button} href={viewUrl}>
              {buttonLabel ? <EmailValue>{buttonLabel}</EmailValue> : t(`${kind}Button`)}
            </Button>
          </Section>
        )}

        <Hr style={hr} />

        <Text style={footer}>
          <EmailValue>{organizationName}</EmailValue>
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default DocumentSentEmail;

const content: React.CSSProperties = {
  padding: "32px 40px 36px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  color: "#1a1a1a",
  lineHeight: "28px",
  margin: "0 0 4px",
  fontWeight: 500,
};

const docNumber: React.CSSProperties = {
  fontSize: "14px",
  color: "#8898aa",
  margin: "0 0 24px",
  fontWeight: 400,
};

const message: React.CSSProperties = {
  fontSize: "14px",
  color: "#525f7f",
  lineHeight: "22px",
  margin: "0 0 24px",
  whiteSpace: "pre-wrap",
};

const amountBlock: React.CSSProperties = {
  backgroundColor: "#f8f9fb",
  borderRadius: "8px",
  padding: "20px 24px",
  marginBottom: "4px",
};

const amountLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  margin: "0 0 4px",
  fontWeight: 400,
};

const amountValue: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: 0,
  letterSpacing: "-0.5px",
};

const metaTable: React.CSSProperties = {
  width: "100%",
  marginTop: "20px",
};

const metaCell: React.CSSProperties = {
  verticalAlign: "top",
};

const metaLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  margin: "0 0 2px",
  fontWeight: 400,
};

const metaValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#1a1a1a",
  margin: 0,
  fontWeight: 500,
};

const buttonWrap: React.CSSProperties = {
  marginTop: "28px",
  marginBottom: "4px",
};

const button: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 500,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "28px 0 16px",
};

const footer: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  margin: 0,
};
