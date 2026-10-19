import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { Logo } from "@/components/shared/logo";
import { getPresentation } from "@/i18n/server";
import { getTranslations } from "next-intl/server";

export default async function Layout({ children }: { children: ReactNode }) {
  const [{ locale }, t] = await Promise.all([
    getPresentation(),
    getTranslations("Docs"),
  ]);
  const lang = locale === "fa-IR" ? "fa" : "en";

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      nav={{
        title: (
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-7" />
            <span className="font-semibold tracking-tight">dubbl</span>
          </div>
        ),
        url: "/",
      }}
      links={[
        { text: t("app"), url: "/dashboard" },
        {
          text: t("github"),
          url: "https://github.com/dubbl-org/dubbl",
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
