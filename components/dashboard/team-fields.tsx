"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const TEAM_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

export function TeamFields({ name, description, color, editing = false, onNameChange, onDescriptionChange, onColorChange }: {
  name: string; description: string; color: string; editing?: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
}) {
  const t = useTranslations("Teams");
  const id = useId();
  return <div className="space-y-4 px-4">
    <div className="space-y-2">
      <Label htmlFor={`${id}-name`}>{t("name")}</Label>
      <Input id={`${id}-name`} value={name} onChange={event => onNameChange(event.target.value)}
        placeholder={editing ? t("teamName") : t("eGEngineeringMarketing")} />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${id}-description`}>{t("description")}</Label>
      <Textarea id={`${id}-description`} value={description} onChange={event => onDescriptionChange(event.target.value)}
        placeholder={t("optionalDescription")} rows={3} />
    </div>
    <div className="space-y-2">
      <Label>{t("color")}</Label>
      <div className="flex flex-wrap gap-2">
        {TEAM_COLORS.map(value => <button key={value} type="button" aria-label={t("colorChoice", { color: value })}
          aria-pressed={color === value}
          className={`size-7 rounded-full transition-all ${color === value ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"}`}
          style={{ backgroundColor: value }} onClick={() => onColorChange(value)} />)}
      </div>
    </div>
  </div>;
}
