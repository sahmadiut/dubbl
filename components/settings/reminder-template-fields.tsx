"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const REMINDER_VARIABLES = [
  { label: "contactName", value: "{{contactName}}" },
  { label: "document", value: "{{documentNumber}}" },
  { label: "amountDue", value: "{{amountDue}}" },
  { label: "dueDate", value: "{{dueDate}}" },
  { label: "organization", value: "{{organizationName}}" },
  { label: "daysOverdue", value: "{{daysOverdue}}" },
] as const;

type TemplateField = "subjectTemplate" | "bodyTemplate";

export function ReminderTemplateFields({ subjectTemplate, bodyTemplate, onChange, onInsert }: {
  subjectTemplate: string;
  bodyTemplate: string;
  onChange: (field: TemplateField, value: string) => void;
  onInsert: (variable: string, field: TemplateField) => void;
}) {
  const t = useTranslations("SettingsReminders");
  return (<>
    {(["subjectTemplate", "bodyTemplate"] as const).map((field) => (
      <div key={field} className="space-y-1.5">
        <Label className="text-xs">{t(field)}</Label>
        {field === "subjectTemplate" ? (
          <Input
            placeholder={t("paymentReminderForDocumentNumber")}
            value={subjectTemplate}
            onChange={(e) => onChange(field, e.target.value)}
            className="h-8 text-sm"
          />
        ) : (
          <Textarea
            placeholder={t("dearContactNameThisIsAReminder")}
            value={bodyTemplate}
            onChange={(e) => onChange(field, e.target.value)}
            className="text-sm min-h-[120px]"
          />
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {REMINDER_VARIABLES.map((variable) => (
            <Button
              key={variable.value}
              type="button"
              variant="outline"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => onInsert(variable.value, field)}
            >
              {t(variable.label)}
            </Button>
          ))}
        </div>
      </div>
    ))}
  </>);
}
