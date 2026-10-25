"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { richTextTags } from "@/i18n/rich-text";
import {
  ArrowLeft,
  FileText,
  BookOpen,
  Users,
  Activity,
  BarChart3,
  Paperclip,
  Target,
  ScrollText,
  CreditCard,
  Banknote,
  Receipt,
  Merge,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { displayJson, contactDetailUi, contactCreditDecimal } from "@/lib/money/contact-dashboard-ui";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface ContactPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  notes: string | null;
}

export interface ContactDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  type: "customer" | "supplier" | "both";
  paymentTermsDays: number;
  creditLimit: bigint | null;
  isTaxExempt: boolean;
  is1099Vendor: boolean;
  currencyCode: string | null;
  defaultRevenueAccountId: string | null;
  defaultExpenseAccountId: string | null;
  defaultTaxRateId: string | null;
  defaultRevenueAccount: { id: string; code: string; name: string } | null;
  defaultExpenseAccount: { id: string; code: string; name: string } | null;
  defaultTaxRate: { id: string; name: string; rate: number } | null;
  people: ContactPerson[];
  notes: string | null;
  createdAt: string;
}

export interface ContactFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  visibility: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

export interface ActivityItem {
  id: string;
  type: "invoice" | "quote" | "credit_note" | "payment" | "bill";
  number: string;
  status: string;
  amount: bigint;
  currencyCode: string;
  date: string;
  createdAt: string;
}

export const activityTypeConfig: Record<ActivityItem["type"], {
  labelKey: "typeInvoice" | "typeQuote" | "typeCreditNote" | "typePayment" | "typeBill";
  icon: typeof FileText;
  color: string;
  bg: string;
  href: (id: string) => string;
}> = {
  invoice: {
    labelKey: "typeInvoice",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    href: (id) => `/sales/${id}`,
  },
  quote: {
    labelKey: "typeQuote",
    icon: ScrollText,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    href: (id) => `/sales/quotes/${id}`,
  },
  credit_note: {
    labelKey: "typeCreditNote",
    icon: CreditCard,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    href: (id) => `/sales/credit-notes/${id}`,
  },
  payment: {
    labelKey: "typePayment",
    icon: Banknote,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    href: (id) => `/payments/${id}`,
  },
  bill: {
    labelKey: "typeBill",
    icon: Receipt,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    href: (id) => `/purchases/${id}`,
  },
};

export function getOrgId() {
  return localStorage.getItem("activeOrgId");
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { value: "details", labelKey: "tabsDetails", icon: FileText },
  { value: "activity", labelKey: "tabsActivity", icon: Activity },
  { value: "statement", labelKey: "tabsStatement", icon: BarChart3 },
  { value: "bookkeeping", labelKey: "tabsBookkeeping", icon: BookOpen },
  { value: "people", labelKey: "tabsPeople", icon: Users },
  { value: "files", labelKey: "tabsFiles", icon: Paperclip },
] as const;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ContactContextValue {
  contact: ContactDetail;
  setContact: React.Dispatch<React.SetStateAction<ContactDetail | null>>;
  fetchContact: () => Promise<void>;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  confirmDialog: ReturnType<typeof useConfirm>["dialog"];
  // Form state shared between details and bookkeeping
  formType: string;
  setFormType: (v: string) => void;
  formRevenueAccountId: string;
  setFormRevenueAccountId: (v: string) => void;
  formExpenseAccountId: string;
  setFormExpenseAccountId: (v: string) => void;
  formTaxRateId: string;
  setFormTaxRateId: (v: string) => void;
  formTaxExempt: boolean;
  setFormTaxExempt: (v: boolean) => void;
  form1099Vendor: boolean;
  setForm1099Vendor: (v: boolean) => void;
  formCreditLimit: string;
  setFormCreditLimit: (v: string) => void;
  formCurrencyCode: string;
  setFormCurrencyCode: (v: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}

const ContactContext = createContext<ContactContextValue | null>(null);

export function useContactContext() {
  const ctx = useContext(ContactContext);
  if (!ctx) throw new Error("useContactContext must be used within ContactDetailLayout");
  return ctx;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function ContactDetailLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("ContactDetails");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { open: openDrawer } = useCreateDrawer();

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared form state
  const [formType, setFormType] = useState<string>("customer");
  const [formRevenueAccountId, setFormRevenueAccountId] = useState<string>("none");
  const [formExpenseAccountId, setFormExpenseAccountId] = useState<string>("none");
  const [formTaxRateId, setFormTaxRateId] = useState<string>("none");
  const [formTaxExempt, setFormTaxExempt] = useState(false);
  const [form1099Vendor, setForm1099Vendor] = useState(false);
  const [formCreditLimit, setFormCreditLimit] = useState("");
  const [formCurrencyCode, setFormCurrencyCode] = useState("");
  const [saving, setSaving] = useState(false);

  // "Merge duplicates" dialog: combine another contact's records into this one.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState<
    { id: string; name: string; email: string | null }[]
  >([]);
  const [merging, setMerging] = useState(false);

  useEntityTitle(contact?.name ?? undefined);

  // Search other contacts to pick the duplicate to fold into this one.
  useEffect(() => {
    if (!mergeOpen) return;
    const orgId = getOrgId();
    if (!orgId) return;
    const params = new URLSearchParams();
    if (mergeSearch) params.set("search", mergeSearch);
    params.set("limit", "20");
    const handle = setTimeout(() => {
      fetch(`/api/v1/contacts?${params}`, {
        headers: { "x-organization-id": orgId },
      })
        .then((r) => {
          if (!r.ok) throw new Error("Contact search failed");
          return r.json();
        })
        .then((data) => {
          if (!Array.isArray(data.data) || !data.data.every((c: { id?: unknown; name?: unknown; email?: unknown }) =>
            typeof c?.id === "string" && typeof c?.name === "string" && (c.email == null || typeof c.email === "string"))) {
            throw new Error("Invalid contact search response");
          }
          setMergeResults(data.data.filter((c: { id: string }) => c.id !== id));
        })
        .catch(() => {
          setMergeResults([]);
          toast.error(t("searchFailed"));
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [mergeOpen, mergeSearch, id, t]);

  // Fold the picked duplicate INTO the contact being viewed (this one survives).
  async function handleMerge(duplicateId: string, duplicateName: string) {
    const orgId = getOrgId();
    if (!orgId || !contact) return;
    const confirmed = await confirm({
      title: t("mergeConfirmTitle", { source: duplicateName, target: contact.name }),
      description:
        t("mergeConfirmDescription"),
      confirmLabel: t("mergeConfirm"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    setMerging(true);
    try {
      // The route merges the [id] in the URL (source) into targetContactId
      // (survivor). We want THIS contact to survive, so the duplicate is the
      // source and this contact is the target.
      const res = await fetch(`/api/v1/contacts/${duplicateId}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ targetContactId: contact.id }),
      });
      if (res.ok) {
        toast.success(t("merged"));
        setMergeOpen(false);
        setMergeSearch("");
        fetchContact();
      } else {
        toast.error(t("mergeFailed"));
      }
    } catch {
      toast.error(t("mergeFailed"));
    } finally {
      setMerging(false);
    }
  }

  const fetchContact = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/contacts/${id}`, {
        headers: { "x-organization-id": orgId },
      });
      const data = await displayJson(res, body => ({ contact: contactDetailUi((body as { contact: ContactDetail }).contact) }));
      if (data.contact) {
        const c = data.contact as ContactDetail;
        setContact(c);
        setFormType(c.type);
        setFormRevenueAccountId(c.defaultRevenueAccountId || "none");
        setFormExpenseAccountId(c.defaultExpenseAccountId || "none");
        setFormTaxRateId(c.defaultTaxRateId || "none");
        setFormTaxExempt(c.isTaxExempt);
        setForm1099Vendor(c.is1099Vendor ?? false);
        setFormCreditLimit(c.creditLimit != null ? contactCreditDecimal(c.creditLimit, c.currencyCode) : "");
        setFormCurrencyCode(c.currencyCode || "");
      }
    } catch {
      setContact(null);
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const activeTab = pathname.endsWith("/activity") ? "activity"
    : pathname.endsWith("/statement") ? "statement"
    : pathname.endsWith("/bookkeeping") ? "bookkeeping"
    : pathname.endsWith("/people") ? "people"
    : pathname.endsWith("/files") ? "files"
    : "details";

  if (loading) return <BrandLoader />;

  if (!contact) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("missing")}
        </p>
        <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" variant="outline" size="sm" onClick={() => router.push("/contacts")}>
          {t("backMissing")}
        </Button>
      </div>
    );
  }

  const peopleCount = contact.people?.length ?? 0;

  return (
    <ContactContext.Provider
      value={{
        contact,
        setContact,
        fetchContact,
        confirm,
        confirmDialog,
        formType,
        setFormType,
        formRevenueAccountId,
        setFormRevenueAccountId,
        formExpenseAccountId,
        setFormExpenseAccountId,
        formTaxRateId,
        setFormTaxRateId,
        formTaxExempt,
        setFormTaxExempt,
        form1099Vendor,
        setForm1099Vendor,
        formCreditLimit,
        setFormCreditLimit,
        formCurrencyCode,
        setFormCurrencyCode,
        saving,
        setSaving,
      }}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between mb-6">
          <button
            onClick={() => router.push("/contacts")}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            {t("back")}
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-auto text-xs gap-1.5 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              onClick={() => setMergeOpen(true)}
              title={t("mergeHint")}
            >
              <Merge className="size-3" />
              {t("merge")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto text-xs gap-1.5 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              onClick={() => openDrawer("deal", { contactId: contact.id, contactName: contact.name })}
              title={t("opportunityHint")}
            >
              <Target className="size-3" />
              {t("opportunity")}
            </Button>
          </div>
        </div>

        {/* Merge duplicates */}
        <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("mergeTitle")}</DialogTitle>
              <DialogDescription>
                {t.rich("mergeDescription", {
                  ...richTextTags,
                  strong: chunks => <strong><BidiText className="min-w-0 max-w-full">{chunks}</BidiText></strong>,
                  name: contact.name,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input aria-label={t("mergeSearch")} dir="auto"
                  autoFocus
                  placeholder={t("mergeSearch")}
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {mergeResults.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    {t("mergeEmpty")}
                  </p>
                ) : (
                  mergeResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={merging}
                      onClick={() => handleMerge(c.id, c.name)}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-start transition-colors hover:bg-muted disabled:opacity-50 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]"
                    >
                      <span className="min-w-0">
                        <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere] text-sm font-medium">
                          <BidiText className="min-w-0 max-w-full">{c.name}</BidiText>
                        </span>
                        {c.email && (
                          <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere] text-xs text-muted-foreground">
                            <IdentifierText className="min-w-0 max-w-full">{c.email}</IdentifierText>
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-emerald-600">
                        {t("mergeIn")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tab nav */}
        <nav className="-mt-2 mb-8 flex items-center gap-1 overflow-x-auto border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const tabHref = tab.value === "details" ? `/contacts/${id}` : `/contacts/${id}/${tab.value}`;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => router.push(tabHref)}
                className={(cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}
              >
                <Icon className="size-3.5" />
                {t(tab.labelKey)}
                {tab.value === "people" && peopleCount > 0 && (
                  <span className="ms-1 text-[11px] tabular-nums text-muted-foreground">
                    {peopleCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <ContentReveal key={pathname}>
          {children}
        </ContentReveal>

        {confirmDialog}
      </div>
    </ContactContext.Provider>
  );
}
