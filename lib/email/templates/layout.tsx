import { outputTranslator } from "@/i18n/output";
import type { AppLocale } from "@/i18n/locale";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import * as React from "react";
import { getPublicAppUrl, toSiteUrl } from "@/lib/public-url";

interface LayoutProps {
  locale?: AppLocale;
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

const APP_URL = getPublicAppUrl();

/** Inline styles travel with the email; web-app utility classes do not. */
export function EmailValue({ children, dir = "auto" }: { children: React.ReactNode; dir?: "auto" | "ltr" }) {
  return <span dir={dir} style={{ unicodeBidi: "isolate", overflowWrap: "anywhere" }}>{children}</span>;
}

export const emailRichText = {
  em: (chunks: React.ReactNode) => <EmailValue>{chunks}</EmailValue>,
  strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
};

export function EmailLayout({ preview, children, unsubscribeUrl, locale = "en-US" }: LayoutProps) {
  const t = outputTranslator(locale);
  return (
    <Html lang={locale} dir={locale === "fa-IR" ? "rtl" : "ltr"}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ ...body, textAlign: locale === "fa-IR" ? "right" : "left", overflowWrap: "anywhere" }}>
        <Container style={container}>
          {/* Logo header */}
          <Section style={logoSection}>
            <table cellPadding="0" cellSpacing="0" role="presentation">
              <tr>
                <td style={{ verticalAlign: "middle", ...(locale === "fa-IR" ? { paddingLeft: "10px" } : { paddingRight: "10px" }) }}>
                  <Img
                    src={`${APP_URL}/logo.png`}
                    width="32"
                    height="26"
                    alt="dubbl"
                    style={{ display: "block" }}
                  />
                </td>
                <td style={{ verticalAlign: "middle" }}>
                  <Text dir="ltr" style={logoText}>dubbl</Text>
                </td>
              </tr>
            </table>
          </Section>

          {children}

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerLinks}>
              <Link href={toSiteUrl("/terms")} style={footerLink}>
                {t("terms")}
              </Link>
              {" · "}
              <Link href={toSiteUrl("/privacy")} style={footerLink}>
                {t("privacy")}
              </Link>
              {unsubscribeUrl && (
                <>
                  {" · "}
                  <Link href={unsubscribeUrl} style={footerLink}>
                    {t("unsubscribe")}
                  </Link>
                </>
              )}
            </Text>
            <Text dir="ltr" style={companyText}>
              Mindroot Ltd · Company No. 16543299
            </Text>
            <Text dir="ltr" style={companyText}>
              Registered in England and Wales · 71-75 Shelton Street, London, WC2H 9JQ
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f4f7fa",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "12px",
  overflow: "hidden",
  marginTop: "48px",
  marginBottom: "48px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
};

const logoSection: React.CSSProperties = {
  padding: "28px 40px 0",
};

const logoText: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#059669",
  margin: 0,
  letterSpacing: "-0.5px",
  lineHeight: "26px",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 40px",
};

const footer: React.CSSProperties = {
  padding: "20px 40px 28px",
};

const footerLinks: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0 0 10px",
  color: "#9ca3af",
};

const footerLink: React.CSSProperties = {
  color: "#9ca3af",
  textDecoration: "underline",
};

const companyText: React.CSSProperties = {
  color: "#b0b8c4",
  fontSize: "11px",
  lineHeight: "16px",
  margin: 0,
};
