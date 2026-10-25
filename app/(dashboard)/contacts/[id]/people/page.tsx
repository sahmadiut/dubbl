"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  X,
  Mail,
  Phone,
  Briefcase,
  Star,
} from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useContactContext, getOrgId } from "../layout";

export default function ContactPeoplePage() {
  const t = useTranslations("ContactPeople");
  const { id } = useParams<{ id: string }>();
  const { contact, fetchContact } = useContactContext();

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: "",
    email: "",
    phone: "",
    jobTitle: "",
    isPrimary: false,
  });

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPerson.name.trim()) return;
    const orgId = getOrgId();
    if (!orgId) return;

    setAddingPerson(true);
    try {
      const res = await fetch(`/api/v1/contacts/${id}/people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: newPerson.name,
          email: newPerson.email || null,
          phone: newPerson.phone || null,
          jobTitle: newPerson.jobTitle || null,
          isPrimary: newPerson.isPrimary,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(t("added"));
      setNewPerson({ name: "", email: "", phone: "", jobTitle: "", isPrimary: false });
      setShowAddPerson(false);
      fetchContact();
    } catch {
      toast.error(t("addFailed"));
    } finally {
      setAddingPerson(false);
    }
  }

  return (
    <ContentReveal key="people">
      <div className="space-y-10">
        <Section title={t("title")} description={t("description")}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between">
              {(contact.people?.length ?? 0) > 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  {t("count", { count: contact.people?.length ?? 0 })}
                </p>
              ) : (
                <div />
              )}
              <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                variant="outline"
                size="sm"
                onClick={() => setShowAddPerson(!showAddPerson)}
              >
                {showAddPerson ? (
                  <>
                    <X className="me-2 size-3.5" />
                    {t("cancel")}
                  </>
                ) : (
                  <>
                    <UserPlus className="me-2 size-3.5" />
                    {t("addPerson")}
                  </>
                )}
              </Button>
            </div>

            {showAddPerson && (
              <form
                onSubmit={handleAddPerson}
                className="space-y-4 rounded-lg border border-dashed p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rtl018-contacts--id--people-page-tsx-1" className="text-xs">{t("nameRequired")}</Label>
                    <Input aria-label={t("nameRequired")} id="rtl018-contacts--id--people-page-tsx-1" dir="auto"
                      placeholder={t("fullName")}
                      value={newPerson.name}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rtl018-contacts--id--people-page-tsx-2" className="text-xs">{t("email")}</Label>
                    <Input aria-label={t("email")} id="rtl018-contacts--id--people-page-tsx-2" dir="ltr"
                      type="email"
                      placeholder={t("emailAddress")}
                      value={newPerson.email}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rtl018-contacts--id--people-page-tsx-3" className="text-xs">{t("phone")}</Label>
                    <Input aria-label={t("phone")} id="rtl018-contacts--id--people-page-tsx-3" dir="auto"
                      placeholder={t("phoneNumber")}
                      value={newPerson.phone}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rtl018-contacts--id--people-page-tsx-4" className="text-xs">{t("jobTitle")}</Label>
                    <Input aria-label={t("jobTitle")} id="rtl018-contacts--id--people-page-tsx-4" dir="auto"
                      placeholder={t("jobTitle")}
                      value={newPerson.jobTitle}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, jobTitle: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="personPrimary"
                      checked={newPerson.isPrimary}
                      onCheckedChange={(checked) =>
                        setNewPerson({ ...newPerson, isPrimary: checked === true })
                      }
                    />
                    <Label
                      htmlFor="personPrimary"
                      className="cursor-pointer text-sm font-normal"
                    >
                      {t("primaryContact")}
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    loading={addingPerson}
                    className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                  >
                    <UserPlus className="me-2 size-3.5" />
                    {t("add")}
                  </Button>
                </div>
              </form>
            )}

            {(contact.people?.length ?? 0) === 0 && !showAddPerson ? (
              <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
                <UserPlus className="mb-2 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {t("empty")}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t("emptyHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(contact.people ?? []).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          <BidiText className="min-w-0 max-w-full">{person.name}</BidiText>
                        </span>
                        {person.isPrimary && (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                          >
                            <Star className="me-1 size-3" />
                            {t("primary")}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {person.jobTitle && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="size-3" />
                            {person.jobTitle}
                          </span>
                        )}
                        {person.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            <IdentifierText className="min-w-0 max-w-full">{person.email}</IdentifierText>
                          </span>
                        )}
                        {person.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />
                            <IdentifierText className="min-w-0 max-w-full">{person.phone}</IdentifierText>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>
    </ContentReveal>
  );
}
