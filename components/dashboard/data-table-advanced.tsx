"use client";

import { useTranslations } from "next-intl";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdvancedColumn<T> {
  key: string;
  header: string;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  render: (row: T) => React.ReactNode;
  getValue?: (row: T) => string | number;
}

interface DataTableAdvancedProps<T> {
  columns: AdvancedColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  bulkActions?: React.ReactNode;
  searchPlaceholder?: string;
}

type SortDir = "asc" | "desc" | null;

export function DataTableAdvanced<T>({
  columns,
  data,
  loading,
  emptyMessage: suppliedEmptyMessage,
  onRowClick,
  pageSize = 25,
  selectable,
  onSelectionChange,
  bulkActions,
  searchPlaceholder: suppliedSearchPlaceholder,
}: DataTableAdvancedProps<T>) {
  const t = useTranslations("SharedUI");
  const emptyMessage = suppliedEmptyMessage ?? t("noDataFound");
  const searchPlaceholder = suppliedSearchPlaceholder ?? t("search");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(columns.map((c) => c.key))
  );

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        if (!col.getValue) return false;
        return String(col.getValue(row)).toLowerCase().includes(lower);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.getValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.getValue!(a);
      const bv = col.getValue!(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const activeCols = columns.filter((c) => visibleCols.has(c.key));

  function toggleSelect(index: number) {
    const next = new Set(selectedIds);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIds(next);
    onSelectionChange?.(
      Array.from(next).map((i) => sorted[i])
    );
  }

  function toggleAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(sorted.map((_, i) => i));
      setSelectedIds(all);
      onSelectionChange?.([...sorted]);
    }
  }

  if (loading) {
    return (
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-10 bg-muted/50 hover:bg-muted/50">
                {activeCols.map((col) => (
                  <TableHead key={col.key} scope="col" className={cn("min-h-10 h-auto py-2 whitespace-normal [overflow-wrap:anywhere] text-xs font-medium text-muted-foreground", col.className)}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="h-10">
                  {activeCols.map((col, ci) => (
                    <TableCell key={col.key} className="py-1.5">
                      <Skeleton className={`h-4 ${["w-24", "w-32", "w-20", "w-28", "w-16"][ci % 5]}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            dir="auto"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="h-8 w-64 max-w-full min-w-0 text-sm"
          />
          {selectable && selectedIds.size > 0 && bulkActions}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings2 aria-hidden="true" className="me-1.5 size-3.5 shrink-0" />
              {t("columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleCols.has(col.key)}
                onCheckedChange={(checked) => {
                  const next = new Set(visibleCols);
                  if (checked) next.add(col.key);
                  else next.delete(col.key);
                  setVisibleCols(next);
                }}
              >
                {col.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-10 bg-muted/50 hover:bg-muted/50">
              {selectable && (
                <TableHead scope="col" className="w-10 h-10">
                  <input
                    aria-label={t("selectAll")}
                    type="checkbox"
                    checked={selectedIds.size === sorted.length && sorted.length > 0}
                    onChange={toggleAll}
                    className="size-3.5 rounded border-muted-foreground/30"
                  />
                </TableHead>
              )}
              {activeCols.map((col) => (
                <TableHead
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable ? sortKey === col.key ? sortDir === "desc" ? "descending" : "ascending" : "none" : undefined}
                  className={cn(
                    "min-h-10 h-auto py-2 whitespace-normal [overflow-wrap:anywhere] text-xs font-medium text-muted-foreground",
                    col.className
                  )}
                >
                  {col.sortable ? <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex min-w-0 items-center gap-1 whitespace-normal text-start [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {col.header}
                    {(
                      sortKey === col.key ? (
                        sortDir === "asc" ? <ChevronUp aria-hidden="true" className="size-3 shrink-0" /> : <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
                      ) : (
                        <ChevronsUpDown aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/40" />
                      )
                    )}
                  </button> : col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={activeCols.length + (selectable ? 1 : 0)}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, i) => {
                const globalIdx = page * pageSize + i;
                return (
                  <TableRow
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "h-10 transition-colors",
                      onRowClick && "cursor-pointer",
                      selectedIds.has(globalIdx) && "bg-muted/50"
                    )}
                  >
                    {selectable && (
                      <TableCell className="py-1.5 w-10">
                        <input
                          aria-label={t("selectRow", { row: globalIdx + 1 })}
                          type="checkbox"
                          checked={selectedIds.has(globalIdx)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(globalIdx);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="size-3.5 rounded border-muted-foreground/30"
                        />
                      </TableCell>
                    )}
                    {activeCols.map((col) => (
                      <TableCell key={col.key} className={cn("py-1.5", col.className)}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="min-w-0 [overflow-wrap:anywhere] text-xs text-muted-foreground tabular-nums">
            {search ? t("resultsFor", { count: sorted.length, search }) : t("results", { count: sorted.length })}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              aria-label={t("previousPage")}
              variant="outline"
              size="icon"
              className="size-7 rounded-md"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-3.5 rtl:rotate-180" />
            </Button>
            <span dir="ltr" className="[unicode-bidi:isolate] px-2 text-xs text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              aria-label={t("nextPage")}
              variant="outline"
              size="icon"
              className="size-7 rounded-md"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
