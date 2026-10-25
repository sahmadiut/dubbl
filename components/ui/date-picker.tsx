"use client";

import { useTranslations } from "next-intl";

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { usePresentation } from "@/i18n/provider"
import { dateOnlyToDate, dateToDateOnly, formatDateOnly } from "@/i18n/dates"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder: suppliedPlaceholder,
  className,
}: DatePickerProps) {
  const t = useTranslations("SharedUI");
  const presentation = usePresentation();
  const placeholder = suppliedPlaceholder ?? t("pickADate");
  const [open, setOpen] = React.useState(false)

  const date = value ? dateOnlyToDate(value) : undefined

  function handleSelect(day: Date | undefined) {
    if (day) {
      const iso = dateToDateOnly(day)
      onChange?.(iso)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          dir={presentation.locale === "fa-IR" ? "rtl" : "ltr"}
          className={cn(
            "w-full justify-start text-start font-normal h-9 bg-transparent",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          <bdi className="min-w-0 truncate">{date ? formatDateOnly(value!, presentation) : placeholder}</bdi>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
          timeZone="UTC"
        />
      </PopoverContent>
    </Popover>
  )
}
