"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { trashEntityLabel, trashEntityOptions } from "@/i18n/data-presentation";
import { TrashList, TrashDeleteDescription, TrashEmptyDescription, type TrashItem } from "@/components/settings/data-management-content";
import { toast } from "sonner";

export default function TrashPage() {
  const t = useTranslations("SettingsTrash");
  const ENTITY_TYPES = trashEntityOptions(t);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteItem, setDeleteItem] = useState<TrashItem | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchItems = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("entityType", typeFilter);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/v1/trash?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => setItems(data.data || []))
      .catch(() => toast.error(t("failedToLoadTrash")))
      .finally(() => setLoading(false));
  }, [typeFilter, search, t]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    return items;
  }, [items]);

  const handleRestore = async (item: TrashItem) => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch(`/api/v1/trash/${item.id}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ entityType: item.entityType }),
      });

      if (!res.ok) {
        toast.error(t("failedToRestoreItem"));
        return;
      }

      toast.success(t("restored", { entity: trashEntityLabel(t, item.entityType) }));
      fetchItems();
    } catch {
      toast.error(t("failedToRestoreItem"));
    }
  };

  const confirmDeletePermanently = async () => {
    if (!deleteItem) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    setActing(true);
    try {
      const res = await fetch(`/api/v1/trash/${deleteItem.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ entityType: deleteItem.entityType }),
      });

      if (!res.ok) {
        toast.error(t("failedToDeleteItem"));
        return;
      }

      toast.success(t("permanentlyDeleted", { entity: trashEntityLabel(t, deleteItem.entityType) }));
      setDeleteItem(null);
      fetchItems();
    } catch {
      toast.error(t("failedToDeleteItem"));
    } finally {
      setActing(false);
    }
  };

  const confirmEmptyTrash = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    setActing(true);
    try {
      const res = await fetch("/api/v1/trash/empty", {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });

      if (!res.ok) {
        toast.error(t("failedToEmptyTrash"));
        return;
      }

      toast.success(t("trashEmptied"));
      setEmptyOpen(false);
      fetchItems();
    } catch {
      toast.error(t("failedToEmptyTrash"));
    } finally {
      setActing(false);
    }
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("trash")}</h2>
            <p className="text-sm text-muted-foreground">{t("deletedItemsAreKeptFor30DaysBeforePermanentRemoval")}</p>
          </div>
          {filteredItems.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setEmptyOpen(true)}
            >
              <Trash2 className="size-3.5" />
              {t("emptyTrash")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={t("searchDeletedItems")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder={t("allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : <TrashList items={filteredItems} {...{ handleRestore, setDeleteItem }} />}
      </div>

      {/* Permanent delete confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deletePermanentlyQuestion")}</DialogTitle>
            <DialogDescription>
              <TrashDeleteDescription item={deleteItem} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={acting}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={confirmDeletePermanently} disabled={acting}>
              {acting ? t("deleting") : t("deletePermanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty trash confirmation */}
      <Dialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emptyTrashQuestion")}</DialogTitle>
            <DialogDescription>
              <TrashEmptyDescription count={filteredItems.length} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmptyOpen(false)} disabled={acting}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={confirmEmptyTrash} disabled={acting}>
              {acting ? t("emptying") : t("emptyTrashAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
