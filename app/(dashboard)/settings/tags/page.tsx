"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { TagFields } from "@/components/settings/tag-fields";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";
import { settingsErrorMessage } from "@/i18n/settings-errors";

interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
}

export default function TagsPage() {
  const st = useTranslations("SettingsTags");
  const errors = useTranslations("SettingsErrors");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  useDocumentTitle(st("settingsTags"));

  const fetchTags = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/tags", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => setTags(data.tags || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const openCreate = () => {
    setEditingTag(null);
    setName("");
    setColor("#6b7280");
    setDescription("");
    setSheetOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setDescription(tag.description || "");
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !name.trim()) return;
    setSaving(true);

    const url = editingTag ? `/api/v1/tags/${editingTag.id}` : "/api/v1/tags";
    const method = editingTag ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ name: name.trim(), color, description: description.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(settingsErrorMessage(errors, data.error, st("failedToSaveTag"), res.status));
        return;
      }

      toast.success(editingTag ? st("tagUpdated") : st("tagCreated"));
      setSheetOpen(false);
      fetchTags();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const res = await fetch(`/api/v1/tags/${id}`, {
      method: "DELETE",
      headers: { "x-organization-id": orgId },
    });

    if (res.ok) {
      toast.success(st("tagDeleted"));
      fetchTags();
    } else {
      toast.error(st("failedToDeleteTag"));
    }
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{st("tags")}</h2>
            <p className="text-sm text-muted-foreground">
              {st("createTagsToCategorizeTransactionsInvoicesBillsAndContacts")}
            </p>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
            <Plus className="size-3.5" />
            {st("addTag")}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={st("noTagsYet")}
            description={st("tagsHelpYouCategorizeAndFilterTransactionsAcrossYourOrganization")}
          >
            <Button size="sm" className="h-8 text-xs gap-1.5 mt-3" onClick={openCreate}>
              <Plus className="size-3.5" />
              {st("createTag")}
            </Button>
          </EmptyState>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{st("color")}</TableHead>
                  <TableHead>{st("name")}</TableHead>
                  <TableHead>{st("description")}</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div
                        className="size-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tag.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(tag)}
                          aria-label={st("editTag")}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600"
                          onClick={() => handleDelete(tag.id)}
                          aria-label={st("deleteTag")}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingTag ? st("editTag") : st("newTag")}</SheetTitle>
          </SheetHeader>
          <TagFields name={name} color={color} description={description}
            onNameChange={setName} onColorChange={setColor} onDescriptionChange={setDescription} />
          <SheetFooter>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? st("saving") : editingTag ? st("update") : st("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
