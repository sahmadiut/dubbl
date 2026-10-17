"use client";

import { useTranslations } from "next-intl";
import { richTextTags } from "@/i18n/rich-text";

export function CostCenterDeleteDescription({ code, name, hasChildren }: { code: string; name: string; hasChildren: boolean }) {
  const st = useTranslations("SettingsCostCenters");
  return <div className="space-y-4 px-4 py-4">
    <p className="text-sm text-muted-foreground">
      {st.rich("deleteConfirmation", {
        ...richTextTags,
        strong: children => <span className="font-medium text-foreground">{children}</span>,
        name: `${code} · ${name}`,
      })}
    </p>
    {hasChildren && <p className="text-sm text-amber-600">
      {st("warningThisCostCenterHasChildrenDeletingItWillOrphanItsChild")}
    </p>}
  </div>;
}
