"use client";

import { useTranslations } from "next-intl";
import { settingsErrorMessage, SettingsRequestError } from "@/i18n/settings-errors";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, MoreHorizontal, Loader2, Trash2, Pencil } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RolePermissionFields } from "@/components/settings/role-permission-fields";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentReveal } from "@/components/ui/content-reveal";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
  createdAt: string;
}

export default function RolesPage() {
  const t = useTranslations("SettingsRoles");
  const te = useTranslations("SettingsErrors");
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function fetchRoles() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    try {
      const res = await fetch("/api/v1/roles", {
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (data.roles) setRoles(data.roles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRoles();
  }, []);

  function openCreate() {
    setEditingRole(null);
    setName("");
    setDescription("");
    setSelectedPermissions([]);
    setSheetOpen(true);
  }

  function openEdit(role: CustomRole) {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description || "");
    setSelectedPermissions([...role.permissions]);
    setSheetOpen(true);
  }

  function togglePermission(perm: string) {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function toggleCategory(perms: string[]) {
    const allSelected = perms.every((p) => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      setSelectedPermissions((prev) => [...new Set([...prev, ...perms])]);
    }
  }

  async function save() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !name || selectedPermissions.length === 0) return;
    setSaving(true);
    try {
      const url = editingRole
        ? `/api/v1/roles/${editingRole.id}`
        : "/api/v1/roles";
      const res = await fetch(url, {
        method: editingRole ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ name, description: description || null, permissions: selectedPermissions }),
      });
      if (!res.ok) throw new SettingsRequestError(settingsErrorMessage(te, (await res.json()).error, "", res.status));
      setSheetOpen(false);
      await fetchRoles();
      toast.success(editingRole ? t("roleUpdated") : t("roleCreated"));
    } catch (err) {
      toast.error(err instanceof SettingsRequestError && err.message ? err.message : t("failedToSaveRole"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(id: string) {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/roles/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new SettingsRequestError(settingsErrorMessage(te, (await res.json()).error, "", res.status));
      await fetchRoles();
      toast.success(t("roleDeleted"));
    } catch (err) {
      toast.error(err instanceof SettingsRequestError && err.message ? err.message : t("failedToDeleteRole"));
    }
  }

  return (
    <ContentReveal className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("customRoles")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("buildYourOwnAccessLevelsByChoosingExactlyWhatEachPerson")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-1.5 size-3.5" />
          {t("createRole")}
        </Button>
      </div>

      {!loading && roles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("noCustomRoles")}
          description={t("createCustomRolesToAssignSpecificPermissionsToTeamMembers")}
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{role.name}</p>
                  {role.isSystem && (
                    <Badge variant="secondary" className="text-[10px]">{t("system")}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {t("members", { count: role.memberCount })}
                  </Badge>
                </div>
                {role.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("permissionCount", { count: role.permissions.length })}
                </p>
              </div>
              {!role.isSystem && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={t("roleActions")}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(role)}>
                      <Pencil className="mr-2 size-3.5" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteRole(role.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingRole ? t("editRole") : t("createRole")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("eGBookkeeper")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("optionalDescription")}
                rows={2}
              />
            </div>
            <RolePermissionFields selectedPermissions={selectedPermissions} onToggleCategory={toggleCategory} onTogglePermission={togglePermission} />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={save}
              disabled={!name || selectedPermissions.length === 0 || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editingRole ? t("update") : t("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
