"use client";

import { useTranslations } from "next-intl";
import { warehouseJson, type WarehouseView } from "@/i18n/warehouse-presentation";
import { useState, useRef } from "react";
import { Check, ChevronsUpDown, Loader2, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/command";
import { useDebounce } from "@/lib/hooks/use-debounce";

type WarehouseOption = WarehouseView;

interface WarehousePickerProps {
  value: string;
  onChange: (warehouseId: string) => void;
  placeholder?: string;
}

export function WarehousePicker({ value, onChange, placeholder }: WarehousePickerProps) {
  const t = useTranslations("Warehouses");
  const [readFailed, setReadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const fetchIdRef = useRef(0);
  const [fetchCount, setFetchCount] = useState(0);
  const isSearching = search !== debouncedSearch;
  const loading = fetchCount > 0 || isSearching;

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) { ++fetchIdRef.current; return; }
    if (!orgId) { setReadFailed(true); return; }
    if (nextOpen) {
      setReadFailed(false);
      const id = ++fetchIdRef.current;
      setFetchCount((c) => c + 1);
      fetch("/api/v1/warehouses", {
        headers: { "x-organization-id": orgId },
      })
        .then((r) => warehouseJson(r, "list"))
        .then((data) => {
          if (id === fetchIdRef.current) setWarehouses(data.data);
        })
        .catch(() => { if (id === fetchIdRef.current) setReadFailed(true); })
        .finally(() => setFetchCount((c) => c - 1));
    }
  }

  const selected = warehouses.find((w) => w.id === value);

  // Client-side filter since warehouse lists are small
  const filtered = debouncedSearch
    ? warehouses.filter((w) =>
        w.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        w.code.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : warehouses;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          {selected ? (
            <span className="truncate">
              {selected.name} <span className="text-muted-foreground">({selected.code})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder ?? t("selectWarehouse")}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchWarehouses")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {readFailed ? (
              <CommandEmpty role="alert">{t("readFailed")}</CommandEmpty>
            ) : loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <Warehouse className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {t(search ? "noSearchMatches" : "noWarehouses")}
                  </span>
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((wh) => (
                  <CommandItem
                    key={wh.id}
                    value={wh.id}
                    onSelect={() => {
                      onChange(wh.id === value ? "" : wh.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check className={cn("size-4 shrink-0", value === wh.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{wh.name}</span>
                        {wh.isDefault && (
                          <span className="text-[10px] text-muted-foreground">{t("defaultMarker")}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{wh.code}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
