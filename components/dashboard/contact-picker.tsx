"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  type: "customer" | "supplier" | "both";
}

const typeBadge: Record<"customer" | "supplier" | "both", { class: string; label: "customer" | "supplier" | "bothShort" }> = {
  customer: {
    class: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
    label: "customer",
  },
  supplier: {
    class: "border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
    label: "supplier",
  },
  both: {
    class: "border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400",
    label: "bothShort",
  },
};

interface ContactPickerProps {
  value: string;
  onChange: (contactId: string) => void;
  type?: "customer" | "supplier";
  placeholder?: string;
}

export function ContactPicker({ value, onChange, type, placeholder }: ContactPickerProps) {
  const t = useTranslations("Contacts");
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const { open: openDrawer } = useCreateDrawer();

  // Fetch contacts when popover opens for the first time
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetchedRef.current = true;

    const params = new URLSearchParams({ limit: "200" });
    if (type) params.set("type", type);

    fetch(`/api/v1/contacts?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Contact read failed");
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data.data)) throw new Error("Missing contacts");
        setContacts(data.data);
      })
      .catch(() => { fetchedRef.current = false; toast.error(t("pickerReadFailed")); })
      .finally(() => setLoading(false));
  }, [open, type, t]);

  const selected = contacts.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={(value) => {
      setOpen(value);
      if (value && !fetchedRef.current) setLoading(true);
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selected.name}</span>
              {Object.hasOwn(typeBadge, selected.type) && (
                <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 py-0", typeBadge[selected.type].class)}>
                  {t(typeBadge[selected.type].label)}
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder ?? t("selectContact")}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder={t("search")} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-1.5 py-2">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("pickerEmpty")}</span>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {contacts.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.email || ""}`}
                      onSelect={() => {
                        onChange(c.id === value ? "" : c.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("size-4 shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm">{c.name}</span>
                          {Object.hasOwn(typeBadge, c.type) && (
                            <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 py-0", typeBadge[c.type].class)}>
                              {t(typeBadge[c.type].label)}
                            </Badge>
                          )}
                        </div>
                        {c.email && (
                          <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <CommandSeparator />
          <div className="p-1">
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => {
                setOpen(false);
                openDrawer("contact");
              }}
            >
              <Plus className="size-4 text-muted-foreground" />
              {t("createNew")}
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
