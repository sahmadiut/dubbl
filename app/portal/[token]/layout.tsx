"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BidiText } from "@/components/ui/bidi-text";
import { FileText, ScrollText, MessageSquare, CreditCard } from "lucide-react";

interface PortalInfo {
  contact: { id: string; name: string };
  organization: { name: string };
}

const tabs = [
  { href: "", label: "overview", icon: FileText },
  { href: "/invoices", label: "invoices", icon: FileText },
  { href: "/statements", label: "statements", icon: ScrollText },
  { href: "/quotes", label: "quotes", icon: MessageSquare },
  { href: "/payments", label: "payments", icon: CreditCard },
] as const;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("PublicPortal");
  const { token } = useParams<{ token: string }>();
  const pathname = usePathname();
  const [info, setInfo] = useState<PortalInfo | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(setInfo)
      .catch(() => {});
  }, [token]);

  const basePath = `/portal/${token}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h1 className="text-lg font-semibold text-gray-900">
              <BidiText>{info?.organization.name || t("loading")}</BidiText>
            </h1>
            <p className="text-sm text-gray-500">{t("portal")}</p>
          </div>
          <p className="min-w-0 text-sm text-gray-600"><BidiText>{info?.contact.name}</BidiText></p>
        </div>
      </header>

      <nav aria-label={t("portal")} className="border-b bg-white">
        <div className="mx-auto max-w-4xl flex min-w-0 flex-wrap gap-1 px-6">
          {tabs.map(tab => {
            const href = `${basePath}${tab.href}`;
            const isActive = tab.href === ""
              ? pathname === basePath
              : pathname.startsWith(href);
            return (
              <Link
                key={tab.href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 items-center gap-2 px-4 py-3 text-sm text-start whitespace-normal [overflow-wrap:anywhere] border-b-2 transition-colors",
                  isActive
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <tab.icon className="size-4 shrink-0" />
                {t(tab.label)}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto min-w-0 max-w-4xl px-6 py-8 [overflow-wrap:anywhere]">
        {children}
      </main>
    </div>
  );
}
