"use client";

import { useTranslations } from "next-intl";
import { FileStack, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useBankAccountContext } from "../layout";
import { ImportRow } from "../../_components";

export default function BankImportsPage() {
  const t = useTranslations("BankImports");
  const { imports, openImport } = useBankAccountContext();

  useDocumentTitle(t("documentTitle"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openImport} className="bg-emerald-600 hover:bg-emerald-700">
          <Upload className="mr-2 size-3.5" />{t("title")}
        </Button>
      </div>

      {imports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <FileStack className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t("noImports")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("emptyHint")}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border">
          {imports.map((imp, i) => (
            <ImportRow key={imp.id} imp={imp} isLast={i === imports.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
