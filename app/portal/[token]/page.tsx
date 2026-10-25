"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { BidiText } from "@/components/ui/bidi-text";

interface PortalInfo {
  contact: { id: string; name: string; email: string | null };
  organization: { name: string };
}

export default function PortalPage() {
  const t = useTranslations("PublicPortal");
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("portal-unavailable");
        return r.json();
      })
      .then(setInfo)
      .catch(() => setError(t("invalidLink")));
  }, [token, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">{t("unavailable")}</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h1 className="text-lg font-semibold text-gray-900"><BidiText>{info.organization.name}</BidiText></h1>
            <p className="text-sm text-gray-500">{t("portal")}</p>
          </div>
          <p className="min-w-0 text-sm text-gray-600"><BidiText>{info.contact.name}</BidiText></p>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-3xl px-6 py-8 [overflow-wrap:anywhere]">
        <h2 className="text-base font-medium text-gray-900">{t.rich("welcome", { name: info.contact.name, em: chunks => <BidiText>{chunks}</BidiText> })}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {t.rich("intro", { organization: info.organization.name, em: chunks => <BidiText>{chunks}</BidiText> })}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => router.push(`/portal/${token}/invoices`)}
            className="flex min-w-0 items-center gap-3 rounded-lg border bg-white p-4 text-start whitespace-normal [overflow-wrap:anywhere] transition-colors hover:bg-gray-50"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <FileText className="size-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{t("invoices")}</p>
              <p className="text-xs text-gray-500">{t("invoiceHint")}</p>
            </div>
            <ExternalLink className="ms-auto size-4 shrink-0 text-gray-400" />
          </button>
        </div>
      </main>
    </div>
  );
}
