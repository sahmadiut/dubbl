"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  name: string;
  color: string;
  description: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function TagFields({ name, color, description, onNameChange, onColorChange, onDescriptionChange }: Props) {
  const st = useTranslations("SettingsTags");
  const id = useId();
  const TAG_COLORS = [
    { label: st("gray"), value: "#6b7280" },
    { label: st("red"), value: "#ef4444" },
    { label: st("orange"), value: "#f97316" },
    { label: st("amber"), value: "#f59e0b" },
    { label: st("green"), value: "#22c55e" },
    { label: st("teal"), value: "#14b8a6" },
    { label: st("blue"), value: "#3b82f6" },
    { label: st("indigo"), value: "#6366f1" },
    { label: st("purple"), value: "#a855f7" },
    { label: st("pink"), value: "#ec4899" },
  ];

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="space-y-2">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">{st("name")}</label>
        <Input
          id={`${id}-name`} dir="auto"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={st("eGQ12026MarketingRecurring")}
        />
      </div>
      <div className="space-y-2">
        <label id={`${id}-color`} className="text-sm font-medium">{st("color")}</label>
        <div role="group" aria-labelledby={`${id}-color`} className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`size-7 rounded-full transition-all ${
                color === c.value ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
              }`}
              style={{ backgroundColor: c.value }}
              onClick={() => onColorChange(c.value)}
              title={c.label}
              aria-label={c.label}
              aria-pressed={color === c.value}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">{st("description")}</label>
        <Input
          id={`${id}-description`} dir="auto"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={st("optionalDescription")}
        />
      </div>
    </div>
  );
}
