import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { getPresentation } from "@/i18n/server";
import { getTranslations } from "next-intl/server";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const { locale } = await getPresentation();
  const lang = locale === "fa-IR" ? "fa" : "en";
  const page = source.getPage(params.slug, lang);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{ style: "clerk" }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const pages = source.getPages();
  return pages.map((page) => ({ slug: page.slugs }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const [{ locale }, t] = await Promise.all([getPresentation(), getTranslations("Docs")]);
  const lang = locale === "fa-IR" ? "fa" : "en";
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  return {
    title: t("pageTitle", { title: page.data.title }),
    description: page.data.description,
  };
}
