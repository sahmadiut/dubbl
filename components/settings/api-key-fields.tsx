"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IdentifierText } from "@/components/ui/bidi-text";

export function ApiKeyFields({ newKey, name, onNameChange, onCopy }: {
  newKey: string | null; name: string; onNameChange: (name: string) => void; onCopy: () => void;
}) {
  const t = useTranslations("SettingsApiKeys");
  const nameId = useId();
  return newKey ? (
    <div className="space-y-3 px-4 py-4">
      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted p-3">
        <code className="min-w-0 flex-1 text-xs"><IdentifierText>{newKey}</IdentifierText></code>
        <Button variant="ghost" size="icon" className="shrink-0 size-8" aria-label={t("copyKey")} onClick={onCopy}>
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-4 px-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>{t("name")}</Label>
        <Input id={nameId} dir="auto" value={name} onChange={e => onNameChange(e.target.value)} placeholder={t("eGProductionAPI")} />
      </div>
    </div>
  );
}
