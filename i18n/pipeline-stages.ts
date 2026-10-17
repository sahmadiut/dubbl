import type { useTranslations } from "next-intl";
import type { Announcements } from "@dnd-kit/core";

type Translate = ReturnType<typeof useTranslations<"SettingsPipelines">>;

export function pipelineAnnouncements(t: Translate, stages: { id: string; name: string }[]): Announcements {
  const name = (id: string | number) => stages.find(stage => stage.id === id)?.name ?? String(id);
  return {
    onDragStart: ({ active }) => t("dragStart", { name: name(active.id) }),
    onDragOver: ({ active, over }) => over
      ? t("dragOver", { name: name(active.id), target: name(over.id) })
      : t("dragOutside", { name: name(active.id) }),
    onDragEnd: ({ active, over }) => over
      ? t("dragEnd", { name: name(active.id), target: name(over.id) })
      : t("dragOutside", { name: name(active.id) }),
    onDragCancel: ({ active }) => t("dragCancel", { name: name(active.id) }),
  };
}

export function createPipelineStages(t: ReturnType<typeof useTranslations<"SettingsPipelines">>): { id: string; name: string; color: string }[] {
  return [
    { id: "lead", name: t("lead"), color: "#94a3b8" },
    { id: "qualified", name: t("qualified"), color: "#3b82f6" },
    { id: "proposal", name: t("proposal"), color: "#8b5cf6" },
    { id: "negotiation", name: t("negotiation"), color: "#f59e0b" },
    { id: "closed_won", name: t("won"), color: "#10b981" },
    { id: "closed_lost", name: t("lost"), color: "#ef4444" },
  ];
}
