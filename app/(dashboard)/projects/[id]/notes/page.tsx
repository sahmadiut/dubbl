"use client";

import { IdentifierText, BidiText } from "@/components/ui/bidi-text";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { formatInstant } from "@/i18n/dates";
import { projectCollaborationMutationJson } from "@/i18n/project-collaboration-presentation";
import { toast } from "sonner";
import {
  Trash2,
  StickyNote,
  Pin,
  PinOff,
  Loader2,
  Search,
  X,
  Pencil,
  Check,
  User,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject, type NoteData } from "../project-context";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

export default function NotesPage() {
  const t = useTranslations("ProjectNotes");
  const { project: proj, orgId, projectId, refresh } = useProject();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("all");
  const [filterPinned, setFilterPinned] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  useDocumentTitle(t("documentTitle"));

  if (!proj) return null;

  const notes = proj.notes;

  // Unique authors
  const uniqueAuthors = Array.from(
    new Map(notes.map(n => [n.author.email, n.author])).values()
  );

  // Apply filters
  const filteredNotes = notes.filter(n => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!n.content.toLowerCase().includes(q) && !(n.author.name || n.author.email).toLowerCase().includes(q)) return false;
    }
    if (filterAuthor !== "all" && n.author.email !== filterAuthor) return false;
    if (filterPinned === "pinned" && !n.isPinned) return false;
    if (filterPinned === "unpinned" && n.isPinned) return false;
    return true;
  });

  // Sort
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // Pinned always first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortBy === "newest" ? db - da : da - db;
  });

  const hasActiveFilters = searchQuery !== "" || filterAuthor !== "all" || filterPinned !== "all";

  function clearFilters() {
    setSearchQuery("");
    setFilterAuthor("all");
    setFilterPinned("all");
  }

  async function handleAdd() {
    if (!orgId || !content.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ content: content.trim() }),
      });
      await projectCollaborationMutationJson(res, "note");
      toast.success(t("added"));
      setContent("");
      refresh();
    } catch { toast.error(t("addFailed")); }
    finally { setSaving(false); }
  }

  async function deleteNote(noteId: string) {
    if (!orgId || deletingId) return;
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/notes?noteId=${noteId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectCollaborationMutationJson(res, "success");
      toast.success(t("deleted"));
      refresh();
    } catch { toast.error(t("deleteFailed")); }
    finally { setDeletingId(null); }
  }

  async function togglePin(note: NoteData) {
    if (!orgId || togglingPinId) return;
    setTogglingPinId(note.id);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/notes?noteId=${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ isPinned: !note.isPinned }),
      });
      await projectCollaborationMutationJson(res, "note", { field: "id", id: note.id });
      toast.success(note.isPinned ? t("unpinned") : t("pinned"));
      refresh();
    } catch { toast.error(t("updateFailed")); }
    finally { setTogglingPinId(null); }
  }

  function startEdit(note: NoteData) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
  }

  async function saveEdit() {
    if (!orgId || !editingId || !editContent.trim() || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/notes?noteId=${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      await projectCollaborationMutationJson(res, "note", { field: "id", id: editingId });
      toast.success(t("updated"));
      setEditingId(null);
      setEditContent("");
      refresh();
    } catch { toast.error(t("updateFailed")); }
    finally { setEditSaving(false); }
  }

  const pinnedCount = notes.filter(n => n.isPinned).length;

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="rounded-xl border bg-card p-4">
        <Textarea aria-label={t("writeNote")} dir="auto"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t("writeNote")}
          rows={3}
          className="resize-none border-0 p-0 focus-visible:ring-0 shadow-none text-[13px] bg-transparent dark:bg-transparent"
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && content.trim()) handleAdd();
          }}
        />
        <div className="flex flex-wrap items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">
            {t("submitShortcut")}
          </span>
          <Button size="sm" onClick={handleAdd} disabled={saving || !content.trim()} className="bg-emerald-600 hover:bg-emerald-700 h-auto text-xs min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full">
            {saving ? t("adding") : t("addNote")}
          </Button>
        </div>
      </div>

      {/* Stats + Filter bar */}
      {notes.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("notes")}
                {hasActiveFilters && (
                  <span className="ms-1.5 text-muted-foreground/60">
                    {t("filteredCount", { count: sortedNotes.length, total: notes.length })}
                  </span>
                )}
              </p>
              {pinnedCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600">
                  <Pin className="size-2.5" />{t("pinnedCount", { count: pinnedCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={v => setSortBy(v as "newest" | "oldest")}>
                <SelectTrigger aria-label={t("sortBy")} className="h-auto text-xs w-auto min-w-[100px] min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("newest")}</SelectItem>
                  <SelectItem value="oldest">{t("oldest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input aria-label={t("searchNotes")} dir="auto"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("searchNotes")}
                className="h-7 text-xs ps-8"
              />
            </div>

            {uniqueAuthors.length > 1 && (
              <Select value={filterAuthor} onValueChange={setFilterAuthor}>
                <SelectTrigger aria-label={t("author")} className={((cn("h-auto min-h-7 h-auto text-xs w-auto min-w-[120px]", filterAuthor !== "all" && "border-blue-300 bg-blue-50/50")) + " h-auto min-h-8 h-auto whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal") + " min-w-0 max-w-full"}>
                  <SelectValue placeholder={t("author")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allAuthors")}</SelectItem>
                  {uniqueAuthors.map(a => (
                    <SelectItem key={a.email} value={a.email}><BidiText className="min-w-0 max-w-full">{a.name || a.email}</BidiText></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filterPinned} onValueChange={setFilterPinned}>
              <SelectTrigger aria-label={t("pinStatus")} className={((cn("h-auto min-h-7 h-auto text-xs w-auto min-w-[110px]", filterPinned !== "all" && "border-blue-300 bg-blue-50/50")) + " h-auto min-h-8 h-auto whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal") + " min-w-0 max-w-full"}>
                <SelectValue placeholder={t("pinStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allNotes")}</SelectItem>
                <SelectItem value="pinned">{t("pinnedOnly")}</SelectItem>
                <SelectItem value="unpinned">{t("unpinnedOnly")}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-auto text-xs text-muted-foreground px-2 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={clearFilters}>
                <X className="size-3 me-1" />{t("clear")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center min-h-[30vh] flex flex-col items-center justify-center">
          <StickyNote className="mx-auto size-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">{t("noNotes")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("noNotesHint")}</p>
        </div>
      ) : sortedNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Search className="mx-auto size-6 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">{t("noMatches")}</p>
          <Button variant="ghost" size="sm" className="mt-2 text-xs h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={clearFilters}>{t("clearFilters")}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isEditing={editingId === note.id}
              editContent={editContent}
              editSaving={editSaving}
              onEditContentChange={setEditContent}
              onStartEdit={() => startEdit(note)}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={() => deleteNote(note.id)}
              onTogglePin={() => togglePin(note)}
              deleting={deletingId === note.id}
              togglingPin={togglingPinId === note.id}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  isEditing,
  editContent,
  editSaving,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onTogglePin,
  deleting,
  togglingPin,
  searchQuery,
}: {
  note: NoteData;
  isEditing: boolean;
  editContent: string;
  editSaving: boolean;
  onEditContentChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  deleting: boolean;
  togglingPin: boolean;
  searchQuery: string;
}) {
  const t = useTranslations("ProjectNotes");
  const presentation = usePresentation();
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 group transition-colors",
      note.isPinned && "border-amber-300 bg-amber-50/50 dark:border-amber-200/30 dark:bg-amber-950/20",
    )}>
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-2 gap-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {note.isPinned && <Pin className="size-3 text-amber-500" />}
          <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5">
            <User className="size-2.5 text-muted-foreground/60" />
            <span className="text-[11px] font-medium"><BidiText className="min-w-0 max-w-full">{note.author.name || note.author.email}</BidiText></span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-2.5" />
            <IdentifierText className="min-w-0 max-w-full">{formatInstant(new Date(note.createdAt), presentation, { month: "short", day: "numeric", year: "numeric" })}</IdentifierText>
            <span className="text-muted-foreground/50 ms-0.5">
              <IdentifierText className="min-w-0 max-w-full">{formatInstant(new Date(note.createdAt), presentation, { hour: "numeric", minute: "2-digit" })}</IdentifierText>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            disabled={togglingPin}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              note.isPinned
                ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50",
            )}
            title={note.isPinned ? t("unpin") : t("pin")}
            aria-label={note.isPinned ? t("unpin") : t("pin")}
          >
            {togglingPin ? <Loader2 className="size-3 animate-spin" /> : note.isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </button>
          {!isEditing && (
            <button
              onClick={onStartEdit}
              className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title={t("edit")} aria-label={t("edit")}
            >
              <Pencil className="size-3" />
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
            title={t("delete")} aria-label={t("delete")}
          >
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea aria-label={t("edit")} dir="auto"
            value={editContent}
            onChange={e => onEditContentChange(e.target.value)}
            rows={4}
            className="text-[13px] resize-none"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && editContent.trim()) onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
          />
          <div className="flex flex-wrap items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {t("editShortcut")}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-auto text-xs min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={onCancelEdit}>
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                className="h-auto text-xs bg-blue-600 hover:bg-blue-700 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                onClick={onSaveEdit}
                disabled={editSaving || !editContent.trim()}
              >
                {editSaving ? <Loader2 className="size-3 animate-spin me-1" /> : <Check className="size-3 me-1" />}
                {t("save")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-muted-foreground">
          <BidiText className="min-w-0 max-w-full">{searchQuery ? highlightText(note.content, searchQuery) : note.content}</BidiText>
        </p>
      )}
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200/60 text-foreground rounded-sm px-0.5">{part}</mark>
    ) : part
  );
}
