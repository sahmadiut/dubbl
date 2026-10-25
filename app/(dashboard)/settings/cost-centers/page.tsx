"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ContentReveal } from "@/components/ui/content-reveal";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { CostCenterDeleteDescription } from "@/components/settings/cost-center-delete-description";

interface CostCenter {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  parentId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface TreeNode extends CostCenter {
  children: TreeNode[];
}

function buildTree(items: CostCenter[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flattenTree(nodes: TreeNode[], depth = 0): { node: TreeNode; depth: number }[] {
  const result: { node: TreeNode; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ node: n, depth });
    if (n.children.length > 0) {
      result.push(...flattenTree(n.children, depth + 1));
    }
  }
  return result;
}

export default function CostCentersPage() {
  const st = useTranslations("SettingsCostCenters");

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [deleting, setDeleting] = useState<CostCenter | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState<string>("none");
  const [formIsActive, setFormIsActive] = useState(true);

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId") || ""
      : "";

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-organization-id": orgId,
    }),
    [orgId]
  );

  const fetchCostCenters = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch("/api/v1/cost-centers?limit=500", {
        headers: { "x-organization-id": orgId },
      });
      const json = await res.json();
      if (json.data) setCostCenters(json.data);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  function openCreate() {
    setEditing(null);
    setFormCode("");
    setFormName("");
    setFormParentId("none");
    setFormIsActive(true);
    setDrawerOpen(true);
  }

  function openEdit(cc: CostCenter) {
    setEditing(cc);
    setFormCode(cc.code);
    setFormName(cc.name);
    setFormParentId(cc.parentId || "none");
    setFormIsActive(cc.isActive);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);

    const payload = {
      code: formCode,
      name: formName,
      parentId: formParentId === "none" ? null : formParentId,
      ...(editing ? { isActive: formIsActive } : {}),
    };

    try {
      const url = editing
        ? `/api/v1/cost-centers/${editing.id}`
        : "/api/v1/cost-centers";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: headers(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(st("failed"));

      toast.success(editing ? st("costCenterUpdated") : st("costCenterCreated"));
      closeDrawer();
      await fetchCostCenters();
    } catch {
      toast.error(
        editing ? st("failedToUpdateCostCenter") : st("failedToCreateCostCenter")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting || !orgId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/cost-centers/${deleting.id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error(st("failed"));
      toast.success(st("costCenterDeleted"));
      setDeleting(null);
      await fetchCostCenters();
    } catch {
      toast.error(st("failedToDeleteCostCenter"));
    } finally {
      setSaving(false);
    }
  }

  const tree = buildTree(costCenters);
  const flatRows = flattenTree(tree);

  const parentName = (parentId: string | null) => {
    if (!parentId) return "-";
    const parent = costCenters.find((c) => c.id === parentId);
    return parent ? parent.name : "-";
  };

  // Filter out current item and its descendants for parent dropdown
  const availableParents = editing
    ? costCenters.filter((c) => {
        if (c.id === editing.id) return false;
        // Prevent circular: check if c is a descendant of editing
        let current: CostCenter | undefined = c;
        while (current?.parentId) {
          if (current.parentId === editing.id) return false;
          current = costCenters.find((p) => p.id === current!.parentId);
        }
        return true;
      })
    : costCenters;

  return (
    <ContentReveal className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <Network className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">
              {st("costCenters")}
            </h2>
            {!loading && costCenters.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {costCenters.length}
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">
            {st("manageDepartmentsAndCostCentersForTrackingExpensesAndRevenueByCategory")}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
          onClick={openCreate}
        >
          <Plus className="me-1.5 size-3.5" />
          {st("newCostCenter")}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < 4 ? "border-b" : ""}`}
            >
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse flex-1" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              <div className="h-5 w-14 rounded bg-muted animate-pulse" />
              <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : costCenters.length === 0 ? (
        <EmptyState
          icon={Network}
          title={st("noCostCenters")}
          description={st("createCostCentersToTrackExpensesAndRevenueByDepartmentOrCategory")}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">{st("code")}</TableHead>
                <TableHead>{st("name")}</TableHead>
                <TableHead className="w-[160px]">{st("parent")}</TableHead>
                <TableHead className="w-[100px]">{st("status")}</TableHead>
                <TableHead className="w-[100px] text-end">{st("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatRows.map(({ node, depth }) => (
                <TableRow key={node.id}>
                  <TableCell className="font-mono text-sm">
                    <div
                      className="flex items-center"
                      style={{ paddingInlineStart: `${depth * 24}px` }}
                    >
                      {depth > 0 && (
                        <span className="me-2 flex items-center text-muted-foreground/50">
                          <span className="inline-block h-px w-3 bg-border" />
                          <ChevronRight className="size-3 rtl:rotate-180" />
                        </span>
                      )}
                      <IdentifierText>{node.code}</IdentifierText>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      style={{ paddingInlineStart: `${depth * 24}px` }}
                      className="text-sm"
                    >
                      <BidiText>{node.name}</BidiText>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <BidiText>{parentName(node.parentId)}</BidiText>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={node.isActive ? "default" : "secondary"}
                      className={
                        node.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
                          : "text-[11px]"
                      }
                    >
                      {node.isActive ? st("active") : st("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(node)}
                        aria-label={st("editCostCenter")}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(node)}
                        aria-label={st("deleteCostCenter")}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Drawer (Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={(v) => { if (!v) closeDrawer(); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing ? st("editCostCenter") : st("newCostCenter")}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSave} className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="settings-cost-centers-1">{st("code")}</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder={st("eGDEPTENG")}
                required aria-label={st("code")} id="settings-cost-centers-1" dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-cost-centers-2">{st("name")}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={st("eGEngineering")}
                required aria-label={st("name")} id="settings-cost-centers-2" dir="auto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-cost-centers-3">{st("parentCostCenter")}</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={st("parentCostCenter")} id="settings-cost-centers-3">
                  <SelectValue placeholder={st("noneTopLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{st("noneTopLevel")}</SelectItem>
                  {availableParents.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      <IdentifierText>{cc.code}</IdentifierText> · <BidiText>{cc.name}</BidiText>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <Label className="text-sm font-normal" htmlFor="settings-cost-centers-4">{st("active")}</Label>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive} aria-label={st("active")} id="settings-cost-centers-4"
                />
              </div>
            )}
          </form>
          <SheetFooter>
            <Button variant="outline" onClick={closeDrawer} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {st("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formCode.trim() || !formName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            >
              {saving
                ? editing
                  ? st("saving")
                  : st("creating")
                : editing
                  ? st("saveChanges")
                  : st("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Sheet open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{st("deleteCostCenter")}</SheetTitle>
          </SheetHeader>
          <CostCenterDeleteDescription code={deleting?.code ?? ""} name={deleting?.name ?? ""}
            hasChildren={!!deleting && costCenters.some(c => c.parentId === deleting.id)} />
          <SheetFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {st("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            >
              {saving ? st("deleting") : st("delete")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
