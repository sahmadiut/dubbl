import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist_Mono, Playfair_Display, Vazirmatn } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { getMessages, getNow, getTranslations } from "next-intl/server";
import { getPresentation } from "@/i18n/server";
import { PresentationProvider } from "@/i18n/provider";
import "fumadocs-ui/style.css";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Let missing Persian glyphs reach the selected site font before system fonts.
  adjustFontFallback: false,
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dubbl.dev";

export async function generateMetadata(): Promise<Metadata> {
  const [presentation, t] = await Promise.all([getPresentation(), getTranslations("PublicMetadata")]);
  return {
    title: {
      default: t("title"),
      template: "%s · dubbl",
    },
    description:
      t("description"),
    metadataBase: new URL(APP_URL),
    keywords: [
      t("keywordOpenSource"),
      t("keywordBookkeeping"),
      t("keywordInvoicing"),
      t("keywordPayable"),
      t("keywordReceivable"),
      t("keywordLedger"),
      "ERP",
      t("keywordPayroll"),
      t("keywordInventory"),
      t("keywordProjects"),
      "CRM",
      t("keywordSelfHosted"),
      t("keywordApiFirst"),
      t("keywordSmallBusiness"),
      t("keywordFree"),
    ],
    authors: [{ name: "dubbl", url: APP_URL }],
    creator: "dubbl",
    openGraph: {
      type: "website",
      locale: presentation.locale === "fa-IR" ? "fa_IR" : "en_US",
      url: APP_URL,
      siteName: "dubbl",
      title: t("socialTitle"),
      description:
        t("socialDescription"),
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: t("imageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("socialTitle"),
      description:
        t("socialDescription"),
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: t("imageAlt"),
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: "/logo.svg",
      apple: "/web-app-manifest-192x192.png",
    },
    manifest: "/manifest.json",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [presentation, messages, now, t] = await Promise.all([getPresentation(), getMessages(), getNow(), getTranslations("Docs")]);
  return (
    <html
      lang={presentation.locale}
      className={`${vazirmatn.variable} ${geistMono.variable} ${playfairDisplay.variable} scroll-smooth`}
      // Turbopack can retain its Arial fallback despite adjustFontFallback: false.
      // Keep only Geist Mono here; globals.css supplies the selected site font.
      style={{ "--font-geist-mono": geistMono.style.fontFamily.split(",")[0] } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="Dubbl" />
      </head>
      <body
        className={`${vazirmatn.className} antialiased${presentation.fontFamily !== "vazirmatn" ? ` font-${presentation.fontFamily}` : ""}`}
      >
        <PresentationProvider presentation={presentation} messages={messages} now={now}>
          <ThemeProvider>
            <RootProvider
              i18n={{
                locale: presentation.locale === "fa-IR" ? "fa" : "en",
                translations: {
                  search: t("search"),
                  searchNoResult: t("searchNoResult"),
                  toc: t("toc"),
                  tocNoHeadings: t("tocNoHeadings"),
                  lastUpdate: t("lastUpdate"),
                  chooseLanguage: t("chooseLanguage"),
                  nextPage: t("nextPage"),
                  previousPage: t("previousPage"),
                  chooseTheme: t("chooseTheme"),
                  editOnGithub: t("editOnGithub"),
                },
              }}
            >
              <SessionProvider>{children}</SessionProvider>
            </RootProvider>
            <Toaster richColors position="bottom-right" style={{ fontFamily: "inherit" }} />
          </ThemeProvider>
        </PresentationProvider>
      </body>
    </html>
  );
}
