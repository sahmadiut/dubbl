"use client";
import { requireBankAccountResponse, bankAccountFailureMessage } from "@/i18n/bank-account-presentation";

import { requirePaymentResponse, paymentFailure } from "@/i18n/bank-payment-presentation";

import { useTranslations } from "next-intl";
import { journalPreviewMessage, requireJournalResponse, journalFailureMessage } from "@/i18n/journal-presentation";
import { requireAccountResponse, accountFailureMessage } from "@/i18n/account-presentation";

import { assetLoanJson } from "@/lib/money/asset-loan-ui";
import { currencyMetadata } from "@/lib/money/exact";
import { bankUiTransfer, bankUiAccount, bankUiMoney } from "@/lib/money/bank-ui";

import { projectCentsInput, projectHoursInput } from "@/lib/money/project-display";

import { assetCentsInput, assetLifeInput, assetRateInput } from "@/lib/money/asset-display";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  FolderKanban,
  FileText,
  ShoppingCart,
  BookOpen,
  Package,
  Receipt,
  Building2,
  Target,
  Trash2,
  Plus,
  CreditCard,
  RefreshCw,
  Landmark,
  Warehouse,
  ClipboardList,
  Tag,
  ArrowLeftRight,
  Briefcase,
  Banknote,
  Undo2,
  Wallet,
  CalendarClock,
  Scale,
  TrendingUp,
  Repeat,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { LineItemsEditor, type LineItem } from "@/components/dashboard/line-items-editor";
import { billLineInputs, billEditorCurrency } from "@/lib/money/bill-editor";
import { documentLineInputs, invoiceEditorCurrency } from "@/lib/money/document-editor";
import { journalEditorPreview, journalDecimal } from "@/lib/money/journal-display";
import { quoteEditorLines } from "@/lib/money/quote-ui";
import { procurementEditorLines } from "@/lib/money/procurement-ui";
import { debitNoteEditorLines } from "@/lib/money/debit-note-ui";
import { expenseEditorItems, expenseEditorPreview, expenseUiMoney, expenseUiMileageSetting } from "@/lib/money/expense-ui";
import { ExpenseAmountInput } from "@/components/dashboard/expense-amount-input";
import { salesReceiptEditorLines, salesReceiptEditorCurrency } from "@/lib/money/sales-receipt-ui";
import { recurringInvoiceEditorLines, recurringInvoiceEditorCurrency } from "@/lib/money/recurring-invoice-ui";
import { customerPrepaymentCurrency, customerPrepaymentAmount, customerPrepaymentMoney } from "@/lib/money/customer-prepayment-ui";
import { InvoiceAmountInput } from "@/components/dashboard/invoice-amount-input";
import { creditNoteEditorLines } from "@/lib/money/credit-note-ui";
import { OpeningBalanceForm } from "@/components/dashboard/opening-balance-form";
import type { OpeningBalanceWrite } from "@/lib/money/opening-balance-ui";
import { EntryForm } from "@/components/dashboard/entry-form";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { FileUploader } from "@/components/dashboard/file-uploader";
import { CurrencySelect } from "@/components/ui/currency-select";
import { InventoryItemPicker } from "@/components/dashboard/inventory-item-picker";
import { WarehousePicker } from "@/components/dashboard/warehouse-picker";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { payrollJson } from "@/lib/money/payroll-ui";
import { payrollCentsInput, payrollBasisPointsInput } from "@/lib/money/payroll-input";
import { inventoryUiItem, inventoryTransferLines } from "@/lib/money/inventory-ui";
import { catalogPriceMinor, catalogWholeInput } from "@/lib/money/catalog-input";
import { budgetMoney as formatMoney, budgetDecimal, budgetDistribute, budgetPerPeriod, budgetInput, budgetLinesInput, budgetDraftInvalid, budgetRemoveDraftLine, accrualUiInput, accrualUiPeriods } from "@/lib/money/budget-ui";
import { projectCrmJson } from "@/lib/money/project-crm-ui";

type DrawerType = "contact" | "project" | "invoice" | "bill" | "entry" | "inventory" | "quote" | "salesReceipt" | "purchaseOrder" | "expense" | "fixedAsset" | "budget" | "employee" | "creditNote" | "recurring" | "account" | "bankAccount" | "warehouse" | "stockTake" | "category" | "transfer" | "bankTransfer" | "contractor" | "deal" | "debitNote" | "customerCredit" | "loan" | "openingBalance" | "accrualSchedule" | "revenueSchedule" | "recurringJournal";

interface DrawerInitialData {
  contactId?: string;
  contactName?: string;
}

interface CreateDrawerContextValue {
  open: (type: DrawerType, initialData?: DrawerInitialData) => void;
  close: () => void;
}

const CreateDrawerContext = createContext<CreateDrawerContextValue | null>(null);

export function useCreateDrawer() {
  const ctx = useContext(CreateDrawerContext);
  if (!ctx) throw new Error("useCreateDrawer must be used within CreateDrawerProvider");
  return ctx;
}

export function CreateDrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeType, setActiveType] = useState<DrawerType | null>(null);
  const [initialData, setInitialData] = useState<DrawerInitialData | undefined>();
  const drawerOrgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const open = useCallback((type: DrawerType, data?: DrawerInitialData) => {
    setInitialData(data);
    setActiveType(type);
  }, []);
  const close = useCallback(() => { setActiveType(null); setInitialData(undefined); }, []);

  return (
    <CreateDrawerContext.Provider value={{ open, close }}>
      {children}
      <ContactDrawer open={activeType === "contact"} onClose={close} />
      <ProjectDrawer open={activeType === "project"} onClose={close} />
      <InvoiceDrawer open={activeType === "invoice"} onClose={close} />
      <BillDrawer open={activeType === "bill"} onClose={close} />
      <EntryDrawer open={activeType === "entry"} onClose={close} />
      <InventoryDrawer open={activeType === "inventory"} onClose={close} />
      <QuoteDrawer open={activeType === "quote"} onClose={close} />
      <SalesReceiptDrawer key={typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : ""} open={activeType === "salesReceipt"} onClose={close} />
      <PurchaseOrderDrawer key={drawerOrgId} open={activeType === "purchaseOrder"} onClose={close} />
      <ExpenseDrawer key={`expense-${drawerOrgId}-${activeType === "expense"}`} open={activeType === "expense"} onClose={close} />
      <FixedAssetDrawer open={activeType === "fixedAsset"} onClose={close} />
      <BudgetDrawer open={activeType === "budget"} onClose={close} />
      <EmployeeDrawer open={activeType === "employee"} onClose={close} />
      <CreditNoteDrawer open={activeType === "creditNote"} onClose={close} />
      <RecurringDrawer key={drawerOrgId} open={activeType === "recurring"} onClose={close} />
      <AccountDrawer open={activeType === "account"} onClose={close} />
      <BankAccountDrawer open={activeType === "bankAccount"} onClose={close} />
      <WarehouseDrawer open={activeType === "warehouse"} onClose={close} />
      <StockTakeDrawer open={activeType === "stockTake"} onClose={close} />
      <CategoryDrawer open={activeType === "category"} onClose={close} />
      <TransferDrawer open={activeType === "transfer"} onClose={close} />
      <BankTransferDrawer open={activeType === "bankTransfer"} onClose={close} />
      <ContractorDrawer open={activeType === "contractor"} onClose={close} />
      <DealDrawer open={activeType === "deal"} onClose={close} initialData={initialData} />
      <DebitNoteDrawer key={drawerOrgId} open={activeType === "debitNote"} onClose={close} />
      <CustomerCreditDrawer open={activeType === "customerCredit"} onClose={close} />
      <LoanDrawer open={activeType === "loan"} onClose={close} />
      <OpeningBalanceDrawer open={activeType === "openingBalance"} onClose={close} />
      <AccrualScheduleDrawer open={activeType === "accrualSchedule"} onClose={close} />
      <RevenueScheduleDrawer open={activeType === "revenueSchedule"} onClose={close} />
      <RecurringJournalDrawer open={activeType === "recurringJournal"} onClose={close} />
    </CreateDrawerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shared drawer chrome
// ---------------------------------------------------------------------------
function DrawerIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function DrawerFooter({
  onClose,
  saving,
  label,
  disabled = false,
  cancelLabel = "Cancel",
  creatingLabel = "Creating...",
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
  disabled?: boolean;
  cancelLabel?: string;
  creatingLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
      <Button type="button" variant="outline" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={saving || disabled}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {saving ? creatingLabel : label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Drawer
// ---------------------------------------------------------------------------
function ContactDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email") || null,
          phone: form.get("phone") || null,
          taxNumber: form.get("taxNumber") || null,
          type: form.get("type") || "customer",
          paymentTermsDays: parseInt(form.get("paymentTermsDays") as string) || 30,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create contact");
      }
      const data = await res.json();
      toast.success("Contact created");
      onClose();
      router.push(`/contacts/${data.contact.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Users className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Contact</SheetTitle>
              <SheetDescription>Add a customer or supplier to your organization.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Basic Info</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-contact-name">Name *</Label>
                <Input id="drawer-contact-name" name="name" required placeholder="Contact name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-contact-email">Email</Label>
                  <Input id="drawer-contact-email" name="email" type="email" placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-contact-phone">Phone</Label>
                  <Input id="drawer-contact-phone" name="phone" placeholder="+1 (555) 000-0000" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select name="type" defaultValue="customer">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-contact-terms">Payment Terms (days)</Label>
                  <Input id="drawer-contact-terms" name="paymentTermsDays" type="number" min={0} defaultValue={30} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-contact-tax">Tax Number</Label>
                <Input id="drawer-contact-tax" name="taxNumber" placeholder="Tax ID / VAT number" />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea name="notes" placeholder="Internal notes about this contact..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Contact" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Project Drawer
// ---------------------------------------------------------------------------
function ProjectDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectBudget, setProjectBudget] = useState("0.00");
  const [projectHourlyRate, setProjectHourlyRate] = useState("0.00");
  const [projectFixedPrice, setProjectFixedPrice] = useState("0.00");

  const PROJECT_COLORS = [
    "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  ];

  useEffect(() => {
    if (!open) { setContactId(""); setStartDate(""); setEndDate(""); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const tagsRaw = (form.get("tags") as string || "").trim();
      const tags = tagsRaw ? tagsRaw.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          contactId: contactId || null,
          status: form.get("status") || "active",
          priority: form.get("priority") || "medium",
          billingType: form.get("billingType") || "hourly",
          color: form.get("color") || "#10b981",
          budgetMinor: projectCentsInput(form.get("budget") as string || "0"),
          hourlyRateMinor: projectCentsInput(form.get("hourlyRate") as string || "0"),
          fixedPriceMinor: projectCentsInput(form.get("fixedPrice") as string || "0"),
          estimatedHours: projectHoursInput(form.get("estimatedHours") as string || "0"),
          category: form.get("category") || null,
          tags,
          startDate: startDate || null,
          endDate: endDate || null,
          enableTasks: true,
          enableTimeTracking: true,
          enableMilestones: false,
          enableNotes: true,
          enableBilling: true,
        }),
      });
      if (!res.ok) {
        const data = await projectCrmJson(res);
        throw new Error(data.error || "Failed to create project");
      }
      const data = await projectCrmJson(res);
      toast.success("Project created");
      window.dispatchEvent(new Event("projects-changed"));
      onClose();
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><FolderKanban className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Project</SheetTitle>
              <SheetDescription>Create a project to track tasks, time, and billing.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Project Info</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-project-name">Project Name *</Label>
                <Input id="drawer-project-name" name="name" required placeholder="Project name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="customer" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue="active">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input name="category" placeholder="e.g. Development" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map(c => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="color" value={c} defaultChecked={c === "#10b981"} className="sr-only peer" />
                      <div className="size-6 rounded-full ring-2 ring-transparent peer-checked:ring-offset-2 peer-checked:ring-gray-400 transition-all" style={{ backgroundColor: c }} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input name="tags" placeholder="Comma separated tags" />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Financials</SectionLabel>
              <div className="space-y-2">
                <Label>Billing Type</Label>
                <Select name="billingType" defaultValue="hourly">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="non_billable">Non-Billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-project-budget">Budget</Label>
                  <CurrencyInput id="drawer-project-budget" name="budget" prefix="$" value={projectBudget} onChange={setProjectBudget} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-project-rate">Hourly Rate</Label>
                  <CurrencyInput id="drawer-project-rate" name="hourlyRate" prefix="$" value={projectHourlyRate} onChange={setProjectHourlyRate} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fixed Price</Label>
                  <CurrencyInput name="fixedPrice" prefix="$" value={projectFixedPrice} onChange={setProjectFixedPrice} />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Hours</Label>
                  <Input name="estimatedHours" type="number" step="0.5" min={0} placeholder="0" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Timeline</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Description</SectionLabel>
              <Textarea name="description" placeholder="Project description..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Project" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Invoice Drawer
// ---------------------------------------------------------------------------
function InvoiceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [currencyContext, setCurrencyContext] = useState<{ orgId: string; contactId: string; code?: string; error?: string } | null>(null);
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const currentCurrencyContext = currencyContext?.orgId === orgId && currencyContext?.contactId === contactId ? currencyContext : null;
  const currencyCode = selectedCurrency || currentCurrencyContext?.code || null;
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  // Deposit / retainer invoice. When on, the invoice is typed as a deposit or
  // retainer and may carry an optional deposit percentage (stored in basis
  // points; the user types a plain percent like 25).
  const [isDepositRetainer, setIsDepositRetainer] = useState(false);
  const [invoiceType, setInvoiceType] = useState<"deposit" | "retainer">("deposit");
  const [depositPercent, setDepositPercent] = useState("");
  // When on, the invoice is routed into the approval queue instead of being
  // sent straight away (created awaiting approval; the invoice's own page
  // carries the approve / reject lifecycle actions).
  const [forApproval, setForApproval] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setContactId(""); setSelectedCurrency(""); setCurrencyContext(null); setValidLines(false); setReference(""); setNotes("");
      setIsDepositRetainer(false); setInvoiceType("deposit"); setDepositPercent("");
      setForApproval(false);
      setIssueDate(new Date().toISOString().split("T")[0]);
      const d = new Date(); d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !orgId || !contactId) return;
    const controller = new AbortController();
    const headers = { "x-organization-id": orgId };
    Promise.all([
      fetch(`/api/v1/contacts/${encodeURIComponent(contactId)}`, { headers, signal: controller.signal }),
      fetch("/api/v1/organization", { headers, signal: controller.signal }),
    ]).then(async ([customer, org]) => {
      if (!customer.ok || !org.ok) throw new Error("Unable to load the customer's invoice currency");
      const [customerData, orgData] = await Promise.all([customer.json(), org.json()]);
      if (!customerData.contact || !orgData.organization) throw new Error("Unable to load the customer's invoice currency");
      const code = invoiceEditorCurrency(null, customerData.contact.currencyCode, orgData.organization.defaultCurrency);
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, code });
    }).catch(() => {
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, error: "Unable to load the customer's invoice currency. Select a currency to continue." });
    });
    return () => controller.abort();
  }, [open, orgId, contactId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!orgId) return;
    if (!currencyCode || !validLines) { toast.error("Check the invoice currency and line amounts"); return; }

    // Deposit % is entered as a plain percent and stored as basis points.
    const pct = parseFloat(depositPercent);
    const depositBasisPoints =
      isDepositRetainer && depositPercent.trim() !== "" && !Number.isNaN(pct)
        ? Math.round(pct * 100)
        : null;

    try {
      const exactLines = documentLineInputs(lines);
      if (exactLines.some(line => !line.description.trim())) throw new Error("Add a description for every line");
      setSaving(true);
      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate, dueDate, currencyCode,
          reference: reference || null,
          notes: notes || null,
          invoiceType: isDepositRetainer ? invoiceType : "standard",
          depositPercent: isDepositRetainer ? depositBasisPoints : null,
          ...(forApproval ? { submitForApproval: true } : {}),
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invoice");
      }
      const data = await res.json();
      toast.success(
        data.invoice.status === "pending_approval"
          ? "Invoice saved for approval — approve it from the invoice's page to send it"
          : "Invoice created"
      );
      onClose();
      router.push(`/sales/${data.invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><FileText className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Invoice</SheetTitle>
              <SheetDescription>Create a sales invoice for your customer.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Invoice Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <ContactPicker value={contactId} onChange={(id) => { if (id !== contactId) { setContactId(id); setSelectedCurrency(""); setValidLines(false); } }} type="customer" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO number, etc." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Invoice currency</Label>
                <CurrencySelect value={currencyCode ?? ""} onValueChange={(code) => { setSelectedCurrency(code); if (code !== currencyCode) setValidLines(false); }} />
                {!selectedCurrency && currentCurrencyContext?.error && <p role="alert" className="text-xs text-red-600">{currentCurrencyContext.error}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDepositRetainer}
                  onChange={(e) => setIsDepositRetainer(e.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">This is a deposit / retainer invoice</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Bill the customer up front for a deposit or an ongoing retainer rather than for work already done.
                  </span>
                </span>
              </label>
              {isDepositRetainer && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Invoice type</Label>
                    <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as "deposit" | "retainer")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="drawer-invoice-deposit-pct">Deposit % (optional)</Label>
                    <Input
                      id="drawer-invoice-deposit-pct"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(e.target.value)}
                      placeholder="e.g. 25"
                    />
                  </div>
                </div>
              )}
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forApproval}
                  onChange={(e) => setForApproval(e.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Submit for approval instead of sending</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Save the invoice for someone to approve. It won&apos;t be sent until it&apos;s approved.
                  </span>
                </span>
              </label>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} accountTypeFilter={["revenue"]} taxContext="sales" currencyCode={currencyCode} roundPriceFirst priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to customer..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Invoice" disabled={!contactId || !currencyCode || !validLines} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bill Drawer
// ---------------------------------------------------------------------------
function BillDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [currencyContext, setCurrencyContext] = useState<{ orgId: string; contactId: string; code?: string; error?: string } | null>(null);
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const currentCurrencyContext = currencyContext?.orgId === orgId && currencyContext?.contactId === contactId ? currencyContext : null;
  const currencyCode = selectedCurrency || currentCurrencyContext?.code || null;
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [reference, setReference] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [notes, setNotes] = useState("");
  // When on, the bill is routed into the approval queue instead of being
  // posted straight away (created as a draft awaiting approval; the bill's own
  // page carries the approve / reject lifecycle actions).
  const [forApproval, setForApproval] = useState(false);
  // When the server flags a possible duplicate (409 + warning), stash the
  // duplicate's bill number so we can show a "Create anyway" confirm.
  const [duplicateBillNumber, setDuplicateBillNumber] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setContactId(""); setSelectedCurrency(""); setCurrencyContext(null); setValidLines(false); setReference(""); setBillNumber(""); setNotes(""); setForApproval(false); setDuplicateBillNumber(null);
      setIssueDate(new Date().toISOString().split("T")[0]);
      const d = new Date(); d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !orgId || !contactId) return;
    const controller = new AbortController();
    const headers = { "x-organization-id": orgId };
    Promise.all([
      fetch(`/api/v1/contacts/${encodeURIComponent(contactId)}`, { headers, signal: controller.signal }),
      fetch("/api/v1/organization", { headers, signal: controller.signal }),
    ]).then(async ([supplier, org]) => {
      if (!supplier.ok || !org.ok) throw new Error("Unable to load the supplier's bill currency");
      const [supplierData, orgData] = await Promise.all([supplier.json(), org.json()]);
      if (!supplierData.contact || !orgData.organization) throw new Error("Unable to load the supplier's bill currency");
      const code = billEditorCurrency(null, supplierData.contact.currencyCode, orgData.organization.defaultCurrency);
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, code });
    }).catch(() => {
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, error: "Unable to load the supplier's bill currency. Select a currency to continue." });
    });
    return () => controller.abort();
  }, [open, orgId, contactId]);

  async function submitBill(confirmDuplicate: boolean) {
    if (!contactId) { toast.error("Please select a supplier"); return; }
    if (!orgId) return;
    if (!currencyCode || !validLines) { toast.error("Check the bill currency and line amounts"); return; }

    try {
      const exactLines = billLineInputs(lines);
      if (exactLines.some(line => !line.description.trim())) throw new Error("Add a description for every line");
      setSaving(true);
      const res = await fetch("/api/v1/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate, dueDate, currencyCode,
          billNumber: billNumber.trim() || null,
          reference: reference || null,
          notes: notes || null,
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
          ...(forApproval ? { submitForApproval: true } : {}),
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        // A soft duplicate warning lets the user create anyway; a hard block does not.
        if (res.status === 409 && data.warning === "duplicate_bill") {
          setDuplicateBillNumber(data.duplicate?.billNumber || billNumber.trim() || "this number");
          return;
        }
        throw new Error(data.error || "Failed to create bill");
      }
      const data = await res.json();
      toast.success(
        data.bill.status === "pending_approval"
          ? "Bill saved for approval — approve it from the bill's page to post it"
          : "Bill created"
      );
      onClose();
      router.push(`/purchases/${data.bill.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bill");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDuplicateBillNumber(null);
    submitBill(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><ShoppingCart className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Bill</SheetTitle>
              <SheetDescription>Record a purchase bill from a supplier.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Bill Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <ContactPicker value={contactId} onChange={(id) => { if (id !== contactId) { setContactId(id); setSelectedCurrency(""); setValidLines(false); setDuplicateBillNumber(null); } }} type="supplier" />
                </div>
                <div className="space-y-2">
                  <Label>Supplier bill number</Label>
                  <Input value={billNumber} onChange={(e) => { setBillNumber(e.target.value); setDuplicateBillNumber(null); }} placeholder="The number on their invoice" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill reference" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bill currency</Label>
                <CurrencySelect value={currencyCode ?? ""} onValueChange={(code) => { setSelectedCurrency(code); if (code !== currencyCode) setValidLines(false); setDuplicateBillNumber(null); }} />
                {!selectedCurrency && currentCurrencyContext?.error && <p role="alert" className="text-xs text-red-600">{currentCurrencyContext.error}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forApproval}
                  onChange={(e) => setForApproval(e.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Submit for approval instead of posting</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Save the bill for someone to approve. It stays a draft and isn&apos;t added to your books until it&apos;s approved.
                  </span>
                </span>
              </label>
              {duplicateBillNumber && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    You already have a bill with number &ldquo;{duplicateBillNumber}&rdquo; for this supplier.
                  </p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90">
                    This might be a duplicate. Create it anyway?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={saving || !currencyCode || !validLines}
                      onClick={() => submitBill(true)}
                    >
                      {saving ? "Creating..." : "Create anyway"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDuplicateBillNumber(null)}
                    >
                      Go back
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); setDuplicateBillNumber(null); }} accountTypeFilter={["expense"]} taxContext="purchase" documentKind="bill" currencyCode={currencyCode} priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Bill" disabled={!contactId || !currencyCode || !validLines} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Entry Drawer
// ---------------------------------------------------------------------------
interface Account {
  id: string;
  code: string;
  name: string;
}

function EntryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/accounts", {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadAccountsFailed"))).json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch((error) => toast.error(journalFailureMessage(error, t("loadAccountsFailed"))));
  }, [open, t, errors]);

  async function handleSubmit(data: {
    date: string;
    description: string;
    reference: string;
    lines: ReturnType<typeof journalEditorPreview>["lines"];
  }) {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          date: data.date,
          description: data.description,
          reference: data.reference || null,
          lines: data.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description || null,
            debitAmountMinor: l.debitAmountMinor,
            creditAmountMinor: l.creditAmountMinor,
            currencyCode: l.currencyCode,
          })),
        }),
      });
      await requireJournalResponse(res, errors, t("createFailed"));
      const { entry } = await res.json();
      if (typeof entry?.id !== "string") throw new Error("Invalid journal response");
      toast.success(t("createdEntry"));
      onClose();
      router.push(`/accounting/${entry.id}`);
    } catch (err) {
      toast.error(journalFailureMessage(err, t("createFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><BookOpen className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("newEntry")}</SheetTitle>
              <SheetDescription>{t("createDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <EntryForm
            accounts={accounts}
            onSubmit={handleSubmit}
            loading={loading}
            onCancel={onClose}
            submitLabel={t("createEntry")}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Inventory Drawer
// ---------------------------------------------------------------------------
function InventoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [invPurchasePrice, setInvPurchasePrice] = useState("0.00");
  const [invSalePrice, setInvSalePrice] = useState("0.00");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          description: form.get("description") || null,
          categoryId: categoryId || null,
          sku: form.get("sku") || null,
          purchasePriceMinor: catalogPriceMinor(form.get("purchasePrice") as string || "0"),
          salePriceMinor: catalogPriceMinor(form.get("salePrice") as string || "0"),
          quantityOnHand: catalogWholeInput(form.get("quantityOnHand") as string || "0", true),
          reorderPoint: catalogWholeInput(form.get("reorderPoint") as string || "0"),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create item");
      }
      const data = await res.json();
      const item = inventoryUiItem(data.inventoryItem);
      toast.success("Inventory item created");
      onClose();
      router.push(`/inventory/${item.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Package className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Inventory Item</SheetTitle>
              <SheetDescription>Add a product or item to track stock.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Item Info</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-code">Code *</Label>
                  <Input id="drawer-inv-code" name="code" required placeholder="ITEM-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-name">Name *</Label>
                  <Input id="drawer-inv-name" name="name" required placeholder="Item name" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <CategoryPicker value={categoryId} onChange={setCategoryId} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-sku">SKU</Label>
                  <Input id="drawer-inv-sku" name="sku" placeholder="Stock keeping unit" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Pricing</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-purchase">Purchase Price</Label>
                  <CurrencyInput id="drawer-inv-purchase" name="purchasePrice" prefix="$" value={invPurchasePrice} onChange={setInvPurchasePrice} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-sale">Sale Price</Label>
                  <CurrencyInput id="drawer-inv-sale" name="salePrice" prefix="$" value={invSalePrice} onChange={setInvSalePrice} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Stock</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-qty">Initial Quantity</Label>
                  <Input id="drawer-inv-qty" name="quantityOnHand" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-inv-reorder">Reorder Point</Label>
                  <Input id="drawer-inv-reorder" name="reorderPoint" type="number" min={0} defaultValue={0} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Description</SectionLabel>
              <Textarea name="description" placeholder="Item description..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Item" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Quote Drawer
// ---------------------------------------------------------------------------
function QuoteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setCurrencyCode("USD"); setValidLines(false);
      setContactId(""); setReference(""); setNotes("");
      setIssueDate(new Date().toISOString().split("T")[0]);
      const d = new Date(); d.setDate(d.getDate() + 30);
      setExpiryDate(d.toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!orgId) return;
    if (!validLines) { toast.error("Check the quote line amounts"); return; }

    try {
      const exactLines = quoteEditorLines(lines);
      setSaving(true);
      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate, expiryDate, currencyCode,
          reference: reference || null,
          notes: notes || null,
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create quote");
      }
      const data = await res.json();
      toast.success("Quote created");
      onClose();
      router.push(`/sales/quotes/${data.quote.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><FileText className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Quote</SheetTitle>
              <SheetDescription>Create a sales quote for your customer.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Quote Details</SectionLabel>
              <div className="space-y-2">
                <Label>Quote currency</Label>
                <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); if (code !== currencyCode) setValidLines(false); }} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="customer" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Quote reference" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <DatePicker value={expiryDate} onChange={setExpiryDate} placeholder="Expiry date" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} accountTypeFilter={["revenue"]} taxContext="sales"
                currencyCode={currencyCode} roundPriceFirst priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to customer..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Quote" disabled={!validLines || !contactId || !orgId || lines.some(line => !line.description.trim())} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Sales Receipt Drawer (cash sale — paid on the spot)
// ---------------------------------------------------------------------------
interface BankAccountOption {
  id: string;
  accountName: string;
  currencyCode: string;
}

function SalesReceiptDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [validLines, setValidLines] = useState(false);
  const [currencyContext, setCurrencyContext] = useState<{ orgId: string; contactId: string; code?: string; error?: string } | null>(null);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const currentCurrencyContext = currencyContext?.orgId === orgId && currencyContext?.contactId === contactId ? currencyContext : null;
  const currencyCode = selectedCurrency || currentCurrencyContext?.code || null;
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setContactId(""); setReference(""); setNotes(""); setSelectedCurrency(""); setCurrencyContext(null); setValidLines(false); setBankAccounts([]); setBankAccountId("");
      setDate(new Date().toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !orgId) return;
    const controller = new AbortController();
    fetch("/api/v1/bank-accounts", { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load bank accounts"); return r.json(); })
      .then(data => { if (!controller.signal.aborted && Array.isArray(data.bankAccounts)) setBankAccounts(data.bankAccounts); })
      .catch(() => { if (!controller.signal.aborted) setBankAccounts([]); });
    return () => controller.abort();
  }, [open, orgId]);

  useEffect(() => {
    if (!open || !orgId || !contactId) return;
    const controller = new AbortController();
    const headers = { "x-organization-id": orgId };
    Promise.all([
      fetch(`/api/v1/contacts/${encodeURIComponent(contactId)}`, { headers, signal: controller.signal }),
      fetch("/api/v1/organization", { headers, signal: controller.signal }),
    ]).then(async ([customer, org]) => {
      if (!customer.ok || !org.ok) throw new Error("Unable to load cash sale currency");
      const [customerData, orgData] = await Promise.all([customer.json(), org.json()]);
      if (!customerData.contact || !orgData.organization) throw new Error("Unable to load cash sale currency");
      const code = salesReceiptEditorCurrency(null, customerData.contact.currencyCode, orgData.organization.defaultCurrency);
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, code });
    }).catch(() => {
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, error: "Unable to load the customer's currency. Select a currency to continue." });
    });
    return () => controller.abort();
  }, [open, orgId, contactId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!bankAccountId) { toast.error("Please choose where the money was paid in"); return; }
    if (!orgId) return;
    if (!currencyCode || !validLines) { toast.error("Check the cash sale currency and line amounts"); return; }

    try {
      const exactLines = salesReceiptEditorLines(lines);
      setSaving(true);
      const res = await fetch("/api/v1/sales-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId,
          date,
          reference: reference || null,
          notes: notes || null,
          currencyCode,
          bankAccountId,
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(typeof data.error === "string" ? data.error : "Failed to record cash sale");
      }
      const data = await res.json();
      toast.success("Cash sale recorded");
      onClose();
      router.push(`/sales/receipts/${data.salesReceipt.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record cash sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Banknote className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Cash Sale</SheetTitle>
              <SheetDescription>Record an over-the-counter sale that&apos;s already been paid for.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Sale Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="customer" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt reference, etc." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker value={date} onChange={setDate} placeholder="Sale date" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencySelect value={currencyCode || ""} onValueChange={setSelectedCurrency} />
                  {!selectedCurrency && currentCurrencyContext?.error && <p role="alert" className="text-xs text-red-600">{currentCurrencyContext.error}</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>What was sold</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={setLines} accountTypeFilter={["revenue"]} taxContext="sales" currencyCode={currencyCode} roundPriceFirst={false} priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Payment</SectionLabel>
              <div className="space-y-2">
                <Label>Paid into *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose where the money landed..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName} · {acc.currencyCode}
                      </SelectItem>
                    ))}
                    {bankAccounts.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No bank or cash accounts yet
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The cash or bank account the customer paid into.
                </p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for this sale..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} disabled={!contactId || !bankAccountId || !currencyCode || !validLines || lines.some(line => !line.description.trim())} label="Record cash sale" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Purchase Order Drawer
// ---------------------------------------------------------------------------
function PurchaseOrderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setCurrencyCode("USD"); setValidLines(false);
      setContactId(""); setReference(""); setNotes(""); setDeliveryDate("");
      setIssueDate(new Date().toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a supplier"); return; }
    if (!orgId || !validLines) { toast.error("Check the purchase order amounts"); return; }
    setSaving(true);

    try {
      const res = await fetch("/api/v1/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate, currencyCode,
          deliveryDate: deliveryDate || null,
          reference: reference || null,
          notes: notes || null,
          lines: procurementEditorLines(lines, "purchaseOrder"),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create purchase order");
      }
      const data = await res.json();
      toast.success("Purchase order created");
      onClose();
      router.push(`/purchases/orders/${data.purchaseOrder.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Receipt className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Purchase Order</SheetTitle>
              <SheetDescription>Create a purchase order for your supplier.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Order Details</SectionLabel>
              <Label>Currency</Label>
              <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); setValidLines(false); }} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="supplier" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO reference" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  <DatePicker value={deliveryDate} onChange={setDeliveryDate} placeholder="Expected delivery" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} documentKind="purchaseOrder" currencyCode={currencyCode} priceFractionDigits={18} onValidityChange={setValidLines} accountTypeFilter={["expense"]} taxContext="purchase" />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} disabled={!orgId || !contactId || !validLines || lines.some(line => !line.description.trim())} label="Create purchase order" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Expense Drawer
// ---------------------------------------------------------------------------
interface ExpenseItemForm {
  date: string;
  description: string;
  amount: string;
  category: string;
  accountId: string;
  taxRateId: string;
  receiptFileKey: string;
  receiptFileName: string;
  // Mileage capture. When on, amount is computed from distance * rate.
  isMileage: boolean;
  distanceMiles: string; // miles, decimal as typed (e.g. "120.5")
  mileageRate: string; // claim-currency major units per mile, exact decimal text
}

const emptyExpenseItem = (): ExpenseItemForm => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  category: "",
  accountId: "",
  taxRateId: "",
  receiptFileKey: "",
  receiptFileName: "",
  isMileage: false,
  distanceMiles: "",
  mileageRate: "",
});

// Mirrors the tax-rates API row shape ({ taxRates: [...] } from GET
// /api/v1/tax-rates). `rate` is in basis points (e.g. 2000 = 20%).
interface ExpenseTaxRateOption {
  id: string;
  name: string;
  rate: number;
  type?: string;
}

function ExpenseDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ExpenseItemForm[]>([emptyExpenseItem()]);
  const [taxRates, setTaxRates] = useState<ExpenseTaxRateOption[]>([]);

  const [settings, setSettings] = useState<{ currencyCode: string; rate: string } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    const controller = new AbortController();
    const options = { headers: { "x-organization-id": orgId }, signal: controller.signal };
    fetch("/api/v1/organization/mileage-rate", options)
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load expense currency"); return expenseUiMileageSetting(data); })
      .then(data => { setSettings(data); setItems(previous => previous.map(item => ({ ...item, mileageRate: item.mileageRate || data.rate }))); })
      .catch(error => { if (!controller.signal.aborted) setSettingsError(error instanceof Error ? error.message : "Unable to load expense currency"); });
    fetch("/api/v1/tax-rates", options)
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error("Unable to load expense taxes"); return data; })
      .then(data => setTaxRates(data.taxRates || []))
      .catch(error => { if (!controller.signal.aborted) setSettingsError(error instanceof Error ? error.message : "Unable to load expense taxes"); });
    return () => controller.abort();
  }, [open]);

  function updateItem(index: number, updates: Partial<ExpenseItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  }

  const preview = expenseEditorPreview(items, settings?.currencyCode ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    if (items.some((item) => !item.description.trim())) {
      toast.error("Please fill in all item descriptions"); return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !settings || settingsError) { toast.error(settingsError || "Load the expense currency first"); return; }
    try {
      const payload = expenseEditorItems(items, settings.currencyCode, true);
      setSaving(true);
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ title, description: description || null, currencyCode: settings.currencyCode, items: payload.items }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create expense claim");
      }
      const data = await res.json();
      toast.success("Expense claim created");
      onClose();
      router.push(`/purchases/expenses/${data.expenseClaim.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create expense claim");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Receipt className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Expense Claim</SheetTitle>
              <SheetDescription>Submit expenses for reimbursement.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Claim Info</SectionLabel>
              <p className="text-sm text-muted-foreground">Currency: {settings?.currencyCode || "Loading..."}. Amounts include tax.</p>
              {(settingsError || preview.error) && <p role="alert" className="text-sm text-destructive">{settingsError || preview.error}</p>}
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Business trip to NYC" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description" />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Expense Items</SectionLabel>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { ...emptyExpenseItem(), mileageRate: settings?.rate || "" }])}>
                  <Plus className="mr-2 size-3.5" />Add Item
                </Button>
              </div>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} className="text-red-600 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isMileage}
                        onChange={(e) => updateItem(index, { isMileage: e.target.checked })}
                        className="size-4 accent-emerald-600"
                      />
                      <span className="text-sm font-medium">Mileage claim (work out the amount from distance)</span>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <DatePicker value={item.date} onChange={(val) => updateItem(index, { date: val })} placeholder="Expense date" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description *</Label>
                        <Input value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="What was this for?" />
                      </div>
                      {item.isMileage ? (
                        <>
                          <div className="space-y-2">
                            <Label>Distance (miles) *</Label>
                            <Input type="text" inputMode="decimal" aria-label="Distance in miles" value={item.distanceMiles} onChange={(e) => updateItem(index, { distanceMiles: e.target.value })} placeholder="0" />
                          </div>
                          <div className="space-y-2">
                            <Label>Rate per mile *</Label>
                            <ExpenseAmountInput currency={settings?.currencyCode || ""} label={`Mileage rate per mile for item ${index + 1}`} value={item.mileageRate} onChange={(v) => updateItem(index, { mileageRate: v })} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Amount *</Label>
                            <ExpenseAmountInput currency={settings?.currencyCode || ""} label={`Amount for item ${index + 1}`} value={item.amount} onChange={(v) => updateItem(index, { amount: v })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Input value={item.category} onChange={(e) => updateItem(index, { category: e.target.value })} placeholder="e.g. Travel" />
                          </div>
                        </>
                      )}
                    </div>
                    {item.isMileage && (
                      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Computed amount</span>
                        <span className="font-mono font-medium tabular-nums">{!preview.error && settings ? expenseUiMoney(preview.amounts[index], settings.currencyCode) : "\u2014"}</span>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Account</Label>
                        <AccountPicker value={item.accountId} onChange={(val) => updateItem(index, { accountId: val })} typeFilter={["expense"]} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax</Label>
                        <Select
                          value={item.taxRateId || "none"}
                          onValueChange={(val) => updateItem(index, { taxRateId: val === "none" ? "" : val })}
                        >
                          <SelectTrigger><SelectValue placeholder="No tax" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No tax</SelectItem>
                            {taxRates
                              .filter((t) => t.type !== "sales")
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} ({(t.rate / 100).toFixed(t.rate % 100 === 0 ? 0 : 2)}%)
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Receipt</Label>
                        <FileUploader accept="image/*,.pdf" onUpload={(fileKey, fileName) => updateItem(index, { receiptFileKey: fileKey, receiptFileName: fileName })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold font-mono tabular-nums">{!preview.error && settings ? expenseUiMoney(preview.total, settings.currencyCode) : "\u2014"}</span>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Expense Claim" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Fixed Asset Drawer
// ---------------------------------------------------------------------------
interface FixedAssetAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

function FixedAssetDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<FixedAssetAccount[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [residualValue, setResidualValue] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");
  const [depreciationMethod, setDepreciationMethod] = useState("straight_line");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [depreciationAccountId, setDepreciationAccountId] = useState("");
  const [accumulatedDepAccountId, setAccumulatedDepAccountId] = useState("");

  useEffect(() => {
    if (!open) {
      setName(""); setDescription(""); setAssetNumber("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setPurchasePrice(""); setResidualValue(""); setUsefulLifeMonths("60");
      setDepreciationMethod("straight_line");
      setAssetAccountId(""); setDepreciationAccountId(""); setAccumulatedDepAccountId("");
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/accounts", { headers: { "x-organization-id": orgId } })
      .then((r) => assetLoanJson(r))
      .then((data) => { if (data.accounts) setAccounts(data.accounts); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load accounts"));
  }, [open]);

  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !assetNumber || !purchasePrice) { toast.error("Please fill in required fields"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name,
          description: description || null,
          assetNumber,
          purchaseDate,
          purchasePriceMinor: assetCentsInput(purchasePrice),
          residualValueMinor: assetCentsInput(residualValue || "0"),
          usefulLifeMonths: assetLifeInput(usefulLifeMonths || "60"),
          depreciationMethod,
          assetAccountId: assetAccountId || null,
          depreciationAccountId: depreciationAccountId || null,
          accumulatedDepAccountId: accumulatedDepAccountId || null,
        }),
      });
      if (!res.ok) {
        const data = await assetLoanJson(res);
        throw new Error(data.error || "Failed to create asset");
      }
      const data = await assetLoanJson(res);
      toast.success("Fixed asset created");
      onClose();
      router.push(`/accounting/fixed-assets/${data.asset.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Building2 className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Fixed Asset</SheetTitle>
              <SheetDescription>Add a capital asset to track depreciation.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Asset Info</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Asset Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office Equipment" />
                </div>
                <div className="space-y-2">
                  <Label>Asset Number *</Label>
                  <Input value={assetNumber} onChange={(e) => setAssetNumber(e.target.value)} placeholder="FA-001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description of the asset..." rows={2} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Purchase</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Purchase Date *</Label>
                  <DatePicker value={purchaseDate} onChange={setPurchaseDate} placeholder="Purchase date" />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Price *</Label>
                  <CurrencyInput prefix="$" value={purchasePrice} onChange={setPurchasePrice} placeholder="10000.00" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Depreciation</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Residual Value</Label>
                  <CurrencyInput prefix="$" value={residualValue} onChange={setResidualValue} placeholder="500.00" />
                </div>
                <div className="space-y-2">
                  <Label>Useful Life (months)</Label>
                  <Input type="number" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} placeholder="60" />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">Straight Line</SelectItem>
                      <SelectItem value="declining_balance">Declining Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Accounts</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Asset Account</Label>
                  <Select value={assetAccountId} onValueChange={setAssetAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {assetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Depreciation Expense</Label>
                  <Select value={depreciationAccountId} onValueChange={setDepreciationAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Accumulated Dep.</Label>
                  <Select value={accumulatedDepAccountId} onValueChange={setAccumulatedDepAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {assetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Asset" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Budget Drawer
// ---------------------------------------------------------------------------
import { generatePeriods } from "@/lib/budget-periods";
import type { PeriodType } from "@/lib/budget-periods";

interface BudgetPeriodInput {
  label: string;
  startDate: string;
  endDate: string;
  amount: bigint;
  sortOrder: number;
}

interface BudgetLineInput {
  accountId: string;
  total: bigint;
  periods: BudgetPeriodInput[];
}

const PERIOD_TYPE_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

function emptyBudgetLine(periodType: PeriodType, startDate: string, endDate: string): BudgetLineInput {
  const periods = generatePeriods(periodType, startDate, endDate).map((p) => ({ ...p, amount: 0n }));
  return { accountId: "", total: 0n, periods };
}

interface BudgetAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

function BudgetDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [budgetCurrency, setBudgetCurrency] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [budgetLines, setBudgetLines] = useState<BudgetLineInput[]>([emptyBudgetLine("monthly", `${new Date().getFullYear()}-01-01`, `${new Date().getFullYear()}-12-31`)]);
  const [periodDrafts, setPeriodDrafts] = useState<Record<string, string>>({});
  const [annualAmounts, setAnnualAmounts] = useState<Record<number, string>>({});
  const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      const yr = new Date().getFullYear();
      setBudgetName(""); setPeriodType("monthly"); setBudgetCurrency(null);
      setBudgetLines([emptyBudgetLine("monthly", `${yr}-01-01`, `${yr}-12-31`)]);
      setAnnualAmounts({}); setPeriodDrafts({}); setExpandedLine(null);
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-12-31`);
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/v1/organizations/${orgId}`, { headers: { "x-organization-id": orgId } })
      .then(async response => { if (!response.ok) throw new Error("Unable to load budget currency"); return response.json(); })
      .then(data => {
        const code = data.organization?.defaultCurrency;
        if (typeof code !== "string" || currencyMetadata(code).code !== code) throw new Error("Invalid budget currency");
        if (!cancelled) setBudgetCurrency(code);
      })
      .catch(() => { if (!cancelled) setBudgetCurrency(null); });
    fetch("/api/v1/accounts?limit=500", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { if (data.accounts) setBudgetAccounts(data.accounts); else if (data.data) setBudgetAccounts(data.data); } })
      .catch(() => { if (!cancelled) setBudgetAccounts([]); });
    return () => { cancelled = true; };
  }, [open]);

  function regenerateAllPeriods(newType: PeriodType, newStart: string, newEnd: string) {
    setPeriodDrafts({});
    setBudgetLines((prev) =>
      prev.map((line) => {
        const newPeriods = generatePeriods(newType, newStart, newEnd).map((p) => ({ ...p, amount: 0n }));
        const amounts = budgetDistribute(line.total, newPeriods.length);
        return {
          ...line,
          periods: newPeriods.map((p, i) => ({ ...p, amount: amounts[i] })),
        };
      })
    );
  }

  function handlePeriodTypeChange(newType: PeriodType) {
    setPeriodType(newType);
    regenerateAllPeriods(newType, startDate, endDate);
  }

  function handleStartDateChange(v: string) {
    setStartDate(v);
    regenerateAllPeriods(periodType, v, endDate);
  }

  function handleEndDateChange(v: string) {
    setEndDate(v);
    regenerateAllPeriods(periodType, startDate, v);
  }

  function handleAnnualChange(index: number, value: string) {
    setPeriodDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${index}:`))));
    setAnnualAmounts((prev) => ({ ...prev, [index]: value }));
    let cents: bigint;
    try { cents = budgetInput(value || "0"); } catch { return; }
    setBudgetLines((prev) => {
      const copy = [...prev];
      const line = copy[index];
      const amounts = budgetDistribute(cents, line.periods.length);
      copy[index] = {
        ...line,
        total: cents,
        periods: line.periods.map((p, i) => ({ ...p, amount: amounts[i] })),
      };
      return copy;
    });
  }


  function updatePeriodAmount(lineIndex: number, periodIndex: number, value: string) {
    setPeriodDrafts(prev => ({ ...prev, [`${lineIndex}:${periodIndex}`]: value }));
    let cents: bigint;
    try { cents = budgetInput(value || "0"); } catch { return; }
    setBudgetLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[lineIndex] };
      const periods = [...line.periods];
      periods[periodIndex] = { ...periods[periodIndex], amount: cents };
      line.periods = periods;
      line.total = periods.reduce((s, p) => s + p.amount, 0n);
      copy[lineIndex] = line;
      return copy;
    });
    setAnnualAmounts((prev) => {
      const copy = { ...prev };
      delete copy[lineIndex];
      return copy;
    });
  }

  function removeLine(index: number) {
    setPeriodDrafts(prev => budgetRemoveDraftLine(prev, index));
    setBudgetLines((prev) => prev.filter((_, i) => i !== index));
    setAnnualAmounts(prev => budgetRemoveDraftLine(prev, index));
    setExpandedLine(prev => prev === index ? null : prev !== null && prev > index ? prev - 1 : prev);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLines = budgetLines.filter((l) => l.accountId);
    if (validLines.length === 0) { toast.error("Add at least one budget line with an account"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      for (const value of [...Object.values(annualAmounts), ...Object.values(periodDrafts)]) budgetInput(value || "0");
      const res = await fetch("/api/v1/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: budgetName,
          startDate,
          endDate,
          periodType,
          lines: budgetLinesInput(validLines),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create budget");
      }
      toast.success("Budget created");
      onClose();
      window.dispatchEvent(new Event("budgets-changed"));
      router.push("/accounting/budgets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create budget");
    } finally {
      setSaving(false);
    }
  }

  const grandTotal = budgetLines.reduce((s, l) => s + l.total, 0n);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Target className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Budget</SheetTitle>
              <SheetDescription>Plan spending by account with flexible period types.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Budget Info</SectionLabel>
              <div className="space-y-2">
                <Label>Budget Name *</Label>
                <Input value={budgetName} onChange={(e) => setBudgetName(e.target.value)} placeholder="FY 2026 Operating Budget" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={handleStartDateChange} placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker value={endDate} onChange={handleEndDateChange} placeholder="End date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Period Type</Label>
                <Select value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Budget Lines</SectionLabel>
                <Button type="button" variant="outline" size="sm" onClick={() => setBudgetLines((prev) => [...prev, emptyBudgetLine(periodType, startDate, endDate)])}>
                  <Plus className="mr-2 size-3.5" />Add Line
                </Button>
              </div>

              {budgetLines.map((line, i) => {
                const isExpanded = expandedLine === i;
                return (
                  <div key={i} className="space-y-2.5">
                    {/* Account + remove */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Select
                          value={line.accountId || undefined}
                          onValueChange={(val) => {
                            setBudgetLines((prev) => {
                              const copy = [...prev];
                              copy[i] = { ...copy[i], accountId: val };
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                          <SelectContent>
                            {budgetAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button type="button" onClick={() => removeLine(i)} className="text-muted-foreground hover:text-red-600 shrink-0 p-1">
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* Annual amount + per-period info */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0 w-16">Annual</Label>
                      <CurrencyInput
                        prefix={budgetCurrency === "USD" ? "$" : budgetCurrency ?? undefined}
                        aria-label={`Total for budget line ${i + 1}`}
                        aria-invalid={budgetDraftInvalid(annualAmounts[i] ?? budgetDecimal(line.total))}
                        value={annualAmounts[i] ?? (line.total !== 0n ? budgetDecimal(line.total) : "")}
                        onChange={(v) => handleAnnualChange(i, v)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      {line.total !== 0n && line.periods.length > 0 && (
                        <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                          {budgetCurrency ? formatMoney(budgetPerPeriod(line.total, line.periods.length), budgetCurrency) : budgetDecimal(budgetPerPeriod(line.total, line.periods.length))}/period
                        </span>
                      )}
                    </div>

                    {/* Customize periods toggle */}
                    {line.total !== 0n && line.periods.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedLine(isExpanded ? null : i)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                      >
                        {isExpanded ? "Hide period breakdown" : `Customize period amounts (${line.periods.length} periods)`}
                      </button>
                    )}

                    {/* Period grid */}
                    {isExpanded && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {line.periods.map((p, pi) => (
                          <div key={pi} className="space-y-1">
                            <label className="text-[10px] text-muted-foreground pl-0.5">{p.label}</label>
                            <CurrencyInput
                              size="sm"
                              aria-label={`Amount for period ${p.label}`}
                              aria-invalid={budgetDraftInvalid(periodDrafts[`${i}:${pi}`] ?? budgetDecimal(p.amount))}
                              value={periodDrafts[`${i}:${pi}`] ?? budgetDecimal(p.amount)}
                              onChange={(v) => updatePeriodAmount(i, pi, v)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {i < budgetLines.length - 1 && <div className="h-px bg-border" />}
                  </div>
                );
              })}

              {budgetLines.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No lines yet. Add one to start planning.</p>
              )}
            </div>
          </div>

          {grandTotal !== 0n && (
            <div className="flex items-center justify-between border-t px-4 py-2.5 sm:px-6 text-sm">
              <span className="text-muted-foreground">Total budget</span>
              <span className="font-mono font-semibold tabular-nums">{budgetCurrency ? formatMoney(grandTotal, budgetCurrency) : budgetDecimal(grandTotal)}</span>
            </div>
          )}
          <DrawerFooter onClose={onClose} saving={saving} label="Create Budget" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Employee Drawer
// ---------------------------------------------------------------------------
function EmployeeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [empName, setEmpName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState("");
  const [payFrequency, setPayFrequency] = useState("monthly");
  const [taxRate, setTaxRate] = useState("20");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [empStartDate, setEmpStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [empCurrency, setEmpCurrency] = useState("USD");

  useEffect(() => {
    if (!open) {
      setEmpName(""); setEmail(""); setEmployeeNumber(""); setPosition("");
      setSalary(""); setPayFrequency("monthly"); setTaxRate("20");
      setBankAccountNumber(""); setEmpStartDate(new Date().toISOString().split("T")[0]);
      setEmpCurrency("USD");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empName || !employeeNumber || !salary) { toast.error("Please fill in required fields"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/payroll/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: empName,
          email: email || null,
          employeeNumber,
          position: position || null,
          salaryMinor: payrollCentsInput(salary),
          payFrequency,
          taxRate: payrollBasisPointsInput(taxRate),
          bankAccountNumber: bankAccountNumber || null,
          startDate: empStartDate,
          currency: empCurrency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add employee");
      }
      const data = await payrollJson(res);
      toast.success("Employee added");
      onClose();
      router.push(`/payroll/employees/${data.employee.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Users className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Employee</SheetTitle>
              <SheetDescription>Add an employee to the payroll.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Personal Info</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Employee Number *</Label>
                  <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="EMP-001" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Software Engineer" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Compensation</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Annual Salary *</Label>
                  <CurrencyInput prefix={empCurrency} value={salary} onChange={setSalary} placeholder="75000.00" />
                </div>
                <div className="space-y-2">
                  <Label>Pay Frequency</Label>
                  <Select value={payFrequency} onValueChange={setPayFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="20.00" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencySelect value={empCurrency} onValueChange={setEmpCurrency} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bank Account Number</Label>
                  <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Account number" />
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <DatePicker value={empStartDate} onChange={setEmpStartDate} placeholder="Start date" />
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Add Employee" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Credit Note Drawer
// ---------------------------------------------------------------------------
function CreditNoteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setCurrencyCode("USD"); setValidLines(false);
      setContactId(""); setReference(""); setNotes("");
      setIssueDate(new Date().toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!orgId) return;
    if (!validLines) { toast.error("Check the credit note line amounts"); return; }

    try {
      const exactLines = creditNoteEditorLines(lines);
      setSaving(true);
      const res = await fetch("/api/v1/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate, currencyCode,
          reference: reference || null,
          notes: notes || null,
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create credit note");
      }
      const data = await res.json();
      toast.success("Credit note created");
      onClose();
      router.push(`/sales/credit-notes/${data.creditNote.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><CreditCard className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Credit Note</SheetTitle>
              <SheetDescription>Issue a credit note to reduce a customer&apos;s balance.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Credit Note Details</SectionLabel>
              <div className="space-y-2">
                <Label>Credit note currency</Label>
                <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); if (code !== currencyCode) setValidLines(false); }} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="customer" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Original invoice, etc." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} accountTypeFilter={["revenue"]} taxContext="sales"
                currencyCode={currencyCode} roundPriceFirst={false} priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for credit..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Credit Note" disabled={!validLines || !contactId || !orgId || lines.some(line => !line.description.trim())} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Recurring Template Drawer
// ---------------------------------------------------------------------------
function RecurringDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  // When on, each generated invoice is approved AND emailed to the customer
  // automatically (carried as `autoSend` on /api/v1/recurring-invoices).
  const [autoSend, setAutoSend] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setName(""); setContactId(""); setFrequency("monthly"); setReference(""); setNotes(""); setEndDate("");
      setAutoSend(false); setCurrencyCode("USD"); setValidLines(false);
      setStartDate(new Date().toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!name.trim()) { toast.error("Please enter a template name"); return; }
    if (!orgId) { toast.error("Select an organization"); return; }
    if (!validLines) { toast.error("Check the line amounts before saving"); return; }
    setSaving(true);

    try {
      const res = await fetch("/api/v1/recurring-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name, contactId, frequency, startDate,
          currencyCode: recurringInvoiceEditorCurrency(currencyCode),
          endDate: endDate || null,
          reference: reference || null,
          notes: notes || null,
          autoSend,
          lines: recurringInvoiceEditorLines(lines),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create recurring template");
      }
      toast.success("Recurring template created");
      onClose();
      router.push("/sales/recurring");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><RefreshCw className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Recurring Invoice</SheetTitle>
              <SheetDescription>Set up a template to automatically generate invoices.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Template Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Retainer" />
                </div>
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="customer" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); setValidLines(false); }} />
                <p className="text-xs text-muted-foreground">Prices use this currency. New templates default to USD.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional reference" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="No end date" />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Email it automatically each time</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Each new invoice is finalised and emailed to the customer on its own. Leave off to create drafts you send yourself.
                  </span>
                </span>
              </label>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} accountTypeFilter={["revenue"]} taxContext="sales"
                currencyCode={currencyCode} documentKind="recurringInvoice" priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for generated invoices..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Template" disabled={!orgId || !name.trim() || !contactId || !validLines || lines.some(line => !line.description.trim())} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Account Drawer
// ---------------------------------------------------------------------------
export function AccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Accounts");
  const errors = useTranslations("AccountErrors");
  const [saving, setSaving] = useState(false);
  const [acctCurrency, setAcctCurrency] = useState("USD");

  useEffect(() => { if (!open) setAcctCurrency("USD"); }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          type: form.get("type") || "asset",
          subType: form.get("subType") || null,
          description: form.get("description") || null,
          currencyCode: acctCurrency,
        }),
      });
      await requireAccountResponse(res, errors, t("createFailed"));
      toast.success(t("accountCreated"));
      onClose();
      window.dispatchEvent(new CustomEvent("accounts-changed"));
    } catch (err) {
      toast.error(accountFailureMessage(err, t("createFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><BookOpen className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("newAccountTitle")}</SheetTitle>
              <SheetDescription>{t("createDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("accountDetails")}</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-account-code">{t("codeRequired")}</Label>
                  <Input id="drawer-account-code" name="code" required placeholder="1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-account-name">{t("nameRequired")}</Label>
                  <Input id="drawer-account-name" name="name" required placeholder={t("cash")} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <Select name="type" defaultValue="asset">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">{t("asset")}</SelectItem>
                      <SelectItem value="liability">{t("liability")}</SelectItem>
                      <SelectItem value="equity">{t("equity")}</SelectItem>
                      <SelectItem value="revenue">{t("revenue")}</SelectItem>
                      <SelectItem value="expense">{t("expense")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-account-currency">{t("currency")}</Label>
                  <CurrencySelect value={acctCurrency} onValueChange={setAcctCurrency} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("optional")}</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-account-description">{t("description")}</Label>
                <Textarea id="drawer-account-description" name="description" placeholder={t("accountDescriptionPlaceholder")} rows={2} />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label={t("createAccount")} cancelLabel={t("cancel")} creatingLabel={t("creating")} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bank Account Drawer
// ---------------------------------------------------------------------------
const BANK_ACCOUNT_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function BankAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("BankAccounts");
  const errors = useTranslations("BankAccountErrors");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [countryCode, setCountryCode] = useState("");
  const [color, setColor] = useState(BANK_ACCOUNT_COLORS[0]);
  // Optional: connect to a specific ledger account. Left blank, the account is
  // connected to its own one automatically.
  const [chartAccountId, setChartAccountId] = useState("");

  useEffect(() => {
    if (!open) {
      setAccountName(""); setBankName(""); setAccountNumber("");
      setAccountType("checking"); setCurrencyCode("USD"); setCountryCode("");
      setColor(BANK_ACCOUNT_COLORS[0]); setChartAccountId("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) { toast.error(t("nameRequired")); return; }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setSaving(true);

    try {
      const res = await fetch("/api/v1/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          accountName,
          accountNumber: accountNumber || null,
          bankName: bankName || null,
          currencyCode,
          countryCode: countryCode || null,
          accountType,
          color,
          ...(chartAccountId ? { chartAccountId } : {}),
        }),
      });
      await requireBankAccountResponse(res, errors, t("createFailed"));
      const data = await res.json();
      const bankAccountId = data.bankAccount?.id;
      if (typeof bankAccountId !== "string" || !bankAccountId) throw new Error("Missing bank account identifier");
      toast.success(t("created"));
      onClose();
      window.dispatchEvent(new CustomEvent("bank-accounts-changed"));
      router.push(`/accounting/banking/${bankAccountId}`);
    } catch (err) {
      toast.error(bankAccountFailureMessage(err, t("createFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Landmark className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("newBankAccount")}</SheetTitle>
              <SheetDescription>{t("createHint")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("accountDetails")}</SectionLabel>
              <div className="space-y-2">
                <Label>{t("accountNameRequired")}</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={t("accountExample")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("bankName")}</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={t("bankPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("accountType")}</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger><SelectValue placeholder={t("selectType")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">{t("checking")}</SelectItem>
                      <SelectItem value="savings">{t("savings")}</SelectItem>
                      <SelectItem value="credit_card">{t("credit_card")}</SelectItem>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="loan">{t("loan")}</SelectItem>
                      <SelectItem value="investment">{t("investment")}</SelectItem>
                      <SelectItem value="other">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("accountNumber")}</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={t("numberPlaceholder")} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("regionCurrency")}</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("currency")}</Label>
                  <CurrencySelect value={currencyCode} onValueChange={setCurrencyCode} />
                </div>
                <div className="space-y-2">
                  <Label>{t("country")}</Label>
                  <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="US" maxLength={2} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("booksOptional")}</SectionLabel>
              <div className="space-y-1.5">
                <AccountPicker
                  value={chartAccountId}
                  onChange={setChartAccountId}
                  typeFilter={["asset", "liability"]}
                  placeholder={t("automatic")}
                  allowCreate
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("automaticHint")}</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("accentColor")}</SectionLabel>
              <div className="flex gap-2">
                {BANK_ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={t("chooseColor", { color: c })}
                    className={`size-6 rounded-full ring-2 ring-transparent transition-all ${color === c ? "ring-offset-2 ring-gray-400" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label={t("createAccount")} cancelLabel={t("cancel")} creatingLabel={t("creating")} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Warehouse Drawer
// ---------------------------------------------------------------------------
function WarehouseDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          code: form.get("code"),
          address: form.get("address") || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create warehouse");
      }
      toast.success("Warehouse created");
      onClose();
      window.dispatchEvent(new CustomEvent("refetch-warehouses"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create warehouse");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Warehouse className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Warehouse</SheetTitle>
              <SheetDescription>Add a warehouse location for inventory tracking.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Warehouse Info</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-wh-name">Name *</Label>
                  <Input id="drawer-wh-name" name="name" required placeholder="Main Warehouse" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-wh-code">Code *</Label>
                  <Input id="drawer-wh-code" name="code" required placeholder="WH-001" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Location</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-wh-address">Address</Label>
                <Textarea id="drawer-wh-address" name="address" placeholder="Street address, city, country..." rows={3} />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Warehouse" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Stock Take Drawer
// ---------------------------------------------------------------------------
function StockTakeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/stock-takes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          warehouseId: warehouseId || null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create stock take");
      }
      toast.success("Stock take created");
      onClose();
      window.dispatchEvent(new CustomEvent("refetch-stock-takes"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create stock take");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose(); setWarehouseId(""); } }}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><ClipboardList className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Stock Take</SheetTitle>
              <SheetDescription>Create a physical inventory count to reconcile stock levels.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-st-name">Name *</Label>
                <Input id="drawer-st-name" name="name" required placeholder="e.g. Q1 2026 Full Count" />
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse (optional)</Label>
                <WarehousePicker value={warehouseId} onChange={setWarehouseId} placeholder="All warehouses" />
                <p className="text-xs text-muted-foreground">Leave empty to count all items across all warehouses.</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea name="notes" placeholder="Optional notes about this stock take..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Stock Take" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Category Drawer
// ---------------------------------------------------------------------------
const CATEGORY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function CategoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          color: color || null,
          description: form.get("description") || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create category");
      }
      toast.success("Category created");
      onClose();
      window.dispatchEvent(new CustomEvent("refetch-categories"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Tag className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Category</SheetTitle>
              <SheetDescription>Organize inventory items with categories.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Category Info</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-cat-name">Name *</Label>
                <Input id="drawer-cat-name" name="name" required placeholder="e.g. Electronics" />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only peer" />
                      <div className="size-6 rounded-full ring-2 ring-transparent peer-checked:ring-offset-2 peer-checked:ring-gray-400 transition-all" style={{ backgroundColor: c }} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-cat-desc">Description</Label>
                <Textarea id="drawer-cat-desc" name="description" placeholder="Optional description..." rows={2} />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Category" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Transfer Drawer
// ---------------------------------------------------------------------------
function TransferDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<{ inventoryItemId: string; quantity: string }[]>([{ inventoryItemId: "", quantity: "1" }]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");

  function resetState() {
    setLines([{ inventoryItemId: "", quantity: "1" }]);
    setFromWarehouseId("");
    setToWarehouseId("");
  }

  function addLine() {
    setLines((prev) => [...prev, { inventoryItemId: "", quantity: "1" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: "inventoryItemId" | "quantity", value: string) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    if (!fromWarehouseId || !toWarehouseId) {
      toast.error("Select both warehouses");
      setSaving(false);
      return;
    }

    let validLines: { inventoryItemId: string; quantity: number }[];
    try {
      validLines = inventoryTransferLines(lines);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid transfer quantity");
      setSaving(false);
      return;
    }
    if (validLines.length === 0) {
      toast.error("Add at least one item");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          notes: (e.currentTarget.elements.namedItem("notes") as HTMLTextAreaElement)?.value || null,
          lines: validLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create transfer");
      }
      toast.success("Transfer created");
      onClose();
      resetState();
      window.dispatchEvent(new CustomEvent("refetch-transfers"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><ArrowLeftRight className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Transfer</SheetTitle>
              <SheetDescription>Move inventory between warehouses.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            {/* Warehouses */}
            <div className="space-y-3">
              <SectionLabel>Warehouses</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">From *</Label>
                  <WarehousePicker value={fromWarehouseId} onChange={setFromWarehouseId} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To *</Label>
                  <WarehousePicker value={toWarehouseId} onChange={setToWarehouseId} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Line items */}
            <div className="space-y-3">
              <SectionLabel>Items</SectionLabel>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <InventoryItemPicker
                        value={line.inventoryItemId}
                        onChange={(v) => updateLine(idx, "inventoryItemId", v)}
                      />
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      aria-label="Whole-unit transfer quantity"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                      className="w-20 shrink-0"
                      placeholder="Qty"
                    />
                    {lines.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => removeLine(idx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addLine}>
                <Plus className="size-3 mr-1.5" />Add Item
              </Button>
            </div>

            <div className="h-px bg-border" />

            {/* Notes */}
            <div className="space-y-3">
              <SectionLabel>Notes</SectionLabel>
              <Textarea name="notes" placeholder="Optional notes about this transfer..." rows={2} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create Transfer" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bank Transfer Drawer (move money between the org's own bank/cash accounts)
// ---------------------------------------------------------------------------
function BankTransferDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("BankPayments");
  const errors = useTranslations("BankAccountErrors");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [fromBankAccountId, setFromBankAccountId] = useState("");
  const [toBankAccountId, setToBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) {
      setFromBankAccountId(""); setToBankAccountId(""); setAmount(""); setMemo("");
      setDate(new Date().toISOString().split("T")[0]);
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setBankAccounts([]);
    fetch("/api/v1/bank-accounts", { headers: { "x-organization-id": orgId } })
      .then((r) => { if (!r.ok) throw new Error(t("banksUnavailable")); return r.json(); })
      .then((data) => { if (data.bankAccounts) setBankAccounts(data.bankAccounts.map(bankUiAccount)); })
      .catch(() => { setBankAccounts([]); toast.error(t("banksUnavailable")); });
  }, [open, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromBankAccountId) { toast.error(t("chooseFrom")); return; }
    if (!toBankAccountId) { toast.error(t("chooseTo")); return; }
    if (fromBankAccountId === toBankAccountId) { toast.error(t("differentAccounts")); return; }
    let amountMinor: string;
    try { amountMinor = bankUiTransfer(amount, bankAccounts.find(b => b.id === fromBankAccountId), bankAccounts.find(b => b.id === toBankAccountId)).amountMinor; }
    catch (error) { toast.error(paymentFailure(error, t, t("invalidTransfer"))); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }

    try {
      const res = await fetch("/api/v1/bank-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          fromBankAccountId,
          toBankAccountId,
          amountMinor,
          date,
          memo: memo.trim() || null,
        }),
      });
      await requirePaymentResponse(res, t, errors, t("transferFailed"));
      const data = await res.json();
      toast.success(t("transferRecorded"));
      onClose();
      if (data.journalEntryId) router.push(`/accounting/${data.journalEntryId}`);
    } catch (err) {
      toast.error(paymentFailure(err, t, t("transferFailed")));
    } finally {
      setSaving(false);
    }
  }

  const fromCurrency = bankAccounts.find((b) => b.id === fromBankAccountId)?.currencyCode;

  let preview: string | null = null;
  let previewError = "";
  try { if (fromCurrency) preview = bankUiMoney(BigInt(bankUiTransfer(amount, bankAccounts.find(b => b.id === fromBankAccountId), bankAccounts.find(b => b.id === toBankAccountId)).amountMinor), fromCurrency); }
  catch (error) { previewError = paymentFailure(error, t, t("invalidTransfer")); }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><ArrowLeftRight className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("transferTitle")}</SheetTitle>
              <SheetDescription>{t("transferHint")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("accounts")}</SectionLabel>
              <div className="space-y-2">
                <Label>{t("from")}</Label>
                <Select value={fromBankAccountId} onValueChange={setFromBankAccountId}>
                  <SelectTrigger><SelectValue placeholder={t("fromPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id} disabled={b.id === toBankAccountId}>
                        {b.accountName} ({b.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("to")}</Label>
                <Select value={toBankAccountId} onValueChange={setToBankAccountId}>
                  <SelectTrigger><SelectValue placeholder={t("toPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id} disabled={b.id === fromBankAccountId || (!!fromCurrency && b.currencyCode !== fromCurrency)}>
                        {b.accountName} ({b.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("details")}</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("amountRequired")}</Label>
                  <CurrencyInput prefix={fromCurrency || ""} fractionDigits={fromCurrency ? currencyMetadata(fromCurrency).minorUnits : 2} aria-label={t("transferAmount", { currency: fromCurrency || t("selectBank") })} value={amount} onChange={setAmount} placeholder="0.00" />
                  {fromCurrency && (
                    <p className="text-[11px] text-muted-foreground">{t("transferCurrency", { currency: fromCurrency, preview: preview ? t("transferPreview", { amount: preview }) : previewError })}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("date")}</Label>
                  <DatePicker value={date} onChange={setDate} placeholder={t("transferDate")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("memo")}</Label>
                <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("memoPlaceholder")} rows={2} />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label={t("recordTransfer")} cancelLabel={t("cancel")} creatingLabel={t("creating")} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ContractorDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cCompany, setCCompany] = useState("");
  const [cRate, setCRate] = useState("");
  const [cCurrency, setCCurrency] = useState("USD");

  useEffect(() => {
    if (!open) {
      setCName(""); setCEmail(""); setCCompany(""); setCRate(""); setCCurrency("USD");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cName) { toast.error("Name is required"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/payroll/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: cName,
          email: cEmail || null,
          company: cCompany || null,
          hourlyRateMinor: cRate ? payrollCentsInput(cRate) : null,
          currency: cCurrency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add contractor");
      }
      const data = await payrollJson(res);
      toast.success("Contractor added");
      onClose();
      router.push(`/payroll/contractors/${data.contractor.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contractor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Briefcase className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Contractor</SheetTitle>
              <SheetDescription>Add a contractor for payments.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Contractor Info</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={cCompany} onChange={(e) => setCCompany(e.target.value)} placeholder="Acme LLC" />
                </div>
                <div className="space-y-2">
                  <Label>Default Rate</Label>
                  <CurrencyInput prefix={cCurrency} value={cRate} onChange={setCRate} placeholder="150.00" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencySelect value={cCurrency} onValueChange={setCCurrency} />
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Add Contractor" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Deal Drawer
// ---------------------------------------------------------------------------
interface DealPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string }[];
  isDefault: boolean;
}

function DealDrawer({ open, onClose, initialData }: { open: boolean; onClose: () => void; initialData?: DrawerInitialData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<DealPipeline[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [contactId, setContactId] = useState("");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("");
  const [expectedClose, setExpectedClose] = useState<string | undefined>();
  const [source, setSource] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Pre-fill contactId from initialData
  useEffect(() => {
    if (open && initialData?.contactId) {
      setContactId(initialData.contactId);
    }
  }, [open, initialData]);

  // Fetch pipelines when drawer opens
  useEffect(() => {
    if (!open) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/crm/pipelines", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        const pipes = data.pipelines || [];
        setPipelines(pipes);
        const def = pipes.find((p: DealPipeline) => p.isDefault) || pipes[0];
        if (def) {
          setPipelineId(def.id);
          if (def.stages?.length) setStageId(def.stages[0].id);
        }
      })
      .catch(() => {});
  }, [open]);

  const activePipeline = pipelines.find((p) => p.id === pipelineId);
  const stages = activePipeline?.stages || [];

  function reset() {
    setValue("");
    setProbability("");
    setExpectedClose(undefined);
    setSource("");
    setContactId("");
    setDirty(false);
  }

  function handleClose() {
    if (dirty && !window.confirm("You have unsaved changes. Discard?")) return;
    reset();
    onClose();
  }

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = (form.get("title") as string)?.trim();
    if (!title || !pipelineId || saving) return;
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch("/api/v1/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          pipelineId,
          stageId: stageId || stages[0]?.id || "lead",
          contactId: contactId || undefined,
          title,
          valueCentsMinor: value ? assetCentsInput(value) : "0",
          currency: "USD",
          probability: probability ? parseInt(probability) : null,
          expectedCloseDate: expectedClose || null,
          source: source || null,
          notes: (form.get("notes") as string) || null,
        }),
      });
      if (!res.ok) {
        const data = await projectCrmJson(res);
        throw new Error(data.error || "Failed to create deal");
      }
      const data = await projectCrmJson(res);
      toast.success("Deal created");
      reset();
      onClose();
      window.dispatchEvent(new CustomEvent("deals-changed"));
      router.push(`/crm/deals/${data.deal.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Target className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New Deal</SheetTitle>
              <SheetDescription>Add a deal to your sales pipeline.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Deal Info</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-deal-title">Title *</Label>
                <Input
                  id="drawer-deal-title"
                  name="title"
                  required
                  placeholder="e.g. Acme Corp - Enterprise Plan"
                  onChange={markDirty}
                />
              </div>
              {pipelines.length > 1 && (
                <div className="space-y-2">
                  <Label>Pipeline</Label>
                  <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); markDirty(); const p = pipelines.find((pp) => pp.id === v); if (p?.stages?.length) setStageId(p.stages[0].id); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={stageId} onValueChange={(v) => { setStageId(v); markDirty(); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.filter((s) => s.id !== "closed_lost" && s.id !== "closed_won").map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Contact</SectionLabel>
              <div className="space-y-2">
                <Label>Associated Contact</Label>
                <ContactPicker value={contactId} onChange={(v) => { setContactId(v); markDirty(); }} placeholder="Select a contact..." />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Value &amp; Probability</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deal Value</Label>
                  <CurrencyInput value={value} onChange={(v) => { setValue(v); markDirty(); }} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-deal-prob">Win Probability %</Label>
                  <Input id="drawer-deal-prob" type="number" min={0} max={100} placeholder="50" value={probability} onChange={(e) => { setProbability(e.target.value); markDirty(); }} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Expected Close</Label>
                  <DatePicker value={expectedClose} onChange={(v) => { setExpectedClose(v); markDirty(); }} />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={source} onValueChange={(v) => { setSource(v); markDirty(); }}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-deal-notes">Notes</Label>
                <Textarea id="drawer-deal-notes" name="notes" placeholder="Additional context about this deal..." rows={3} onChange={markDirty} />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={handleClose} saving={saving} label="Create Deal" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Debit Note Drawer (supplier credit — money a supplier owes you back)
// ---------------------------------------------------------------------------
function DebitNoteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setContactId(""); setReference(""); setNotes(""); setCurrencyCode("USD"); setValidLines(false);
      setIssueDate(new Date().toISOString().split("T")[0]);
      setLines([{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a supplier"); return; }
    if (!orgId) return;
    if (!validLines) { toast.error("Check the supplier credit line amounts"); return; }

    try {
      const exactLines = debitNoteEditorLines(lines);
      setSaving(true);
      const res = await fetch("/api/v1/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId, issueDate,
          reference: reference || null,
          notes: notes || null,
          currencyCode,
          lines: exactLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create supplier credit");
      }
      const data = await res.json();
      toast.success("Supplier credit created");
      onClose();
      router.push(`/purchases/debit-notes/${data.debitNote.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create supplier credit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Undo2 className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New supplier credit</SheetTitle>
              <SheetDescription>Record money a supplier owes you back, to reduce what you owe them.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Credit Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <ContactPicker value={contactId} onChange={setContactId} type="supplier" />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Original bill, etc." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <DatePicker value={issueDate} onChange={setIssueDate} placeholder="Issue date" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); if (code !== currencyCode) setValidLines(false); }} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Line Items</SectionLabel>
              <LineItemsEditor key={orgId} lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }} accountTypeFilter={["expense"]} taxContext="purchase"
                currencyCode={currencyCode} roundPriceFirst={false} priceFractionDigits={18} onValidityChange={setValidLines} />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for the credit..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create supplier credit" disabled={!validLines || !contactId || !orgId || lines.some(line => !line.description.trim())} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Customer Credit Drawer (prepayment — money received in advance)
// ---------------------------------------------------------------------------
function CustomerCreditDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <CustomerCreditForm key={`${orgId}:${open}`} open={open} onClose={onClose} orgId={orgId} />;
}

function CustomerCreditForm({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [sourceType, setSourceType] = useState("prepayment");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [currencyContext, setCurrencyContext] = useState<{ orgId: string; contactId: string; code?: string; error?: string } | null>(null);
  const currentContext = currencyContext?.orgId === orgId && currencyContext?.contactId === contactId ? currencyContext : null;
  const currencyCode = selectedCurrency || currentContext?.code || null;
  const matchingBanks = bankAccounts.filter(bank => bank.currencyCode === currencyCode);
  const selectedBank = matchingBanks.find(bank => bank.id === bankAccountId);
  let exactAmount: { amountMinor: string } | null = null;
  try { if (currencyCode) exactAmount = customerPrepaymentAmount(amount, currencyCode); } catch {}
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !orgId) return;
    const controller = new AbortController();
    fetch("/api/v1/bank-accounts", { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load bank accounts"); return r.json(); })
      .then(data => { if (!controller.signal.aborted && Array.isArray(data.bankAccounts)) setBankAccounts(data.bankAccounts); })
      .catch(() => { if (!controller.signal.aborted) setBankAccounts([]); });
    return () => controller.abort();
  }, [open, orgId]);

  useEffect(() => {
    if (!open || !orgId || !contactId) return;
    const controller = new AbortController();
    const headers = { "x-organization-id": orgId };
    Promise.all([
      fetch(`/api/v1/contacts/${encodeURIComponent(contactId)}`, { headers, signal: controller.signal }),
      fetch("/api/v1/organization", { headers, signal: controller.signal }),
    ]).then(async ([customer, org]) => {
      if (!customer.ok || !org.ok) throw new Error("Unable to load prepayment currency");
      const [customerData, orgData] = await Promise.all([customer.json(), org.json()]);
      if (!customerData.contact || !orgData.organization) throw new Error("Unable to load prepayment currency");
      const code = customerPrepaymentCurrency(null, customerData.contact.currencyCode, orgData.organization.defaultCurrency);
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, code });
    }).catch(() => {
      if (!controller.signal.aborted) setCurrencyContext({ orgId, contactId, error: "Unable to load the customer's currency. Select a currency to continue." });
    });
    return () => controller.abort();
  }, [open, orgId, contactId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Please select a customer"); return; }
    if (!bankAccountId) { toast.error("Please choose where the money was paid in"); return; }
    if (!currencyCode || !exactAmount || !selectedBank) { toast.error("Check the amount, currency and paid-in account"); return; }
    setSaving(true);
    if (!orgId) { setSaving(false); return; }

    try {
      const res = await fetch("/api/v1/customer-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          contactId,
          date,
          ...exactAmount,
          sourceType,
          bankAccountId,
          currencyCode,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(typeof data.error === "string" ? data.error : "Failed to record prepayment");
      }
      toast.success("Prepayment recorded");
      onClose();
      router.push("/sales/customer-prepayments");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record prepayment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Wallet className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New prepayment</SheetTitle>
              <SheetDescription>Record money a customer paid you in advance, before any invoice.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Prepayment Details</SectionLabel>
              <div className="space-y-2">
                <Label>Customer *</Label>
                <ContactPicker value={contactId} onChange={setContactId} type="customer" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker value={date} onChange={setDate} placeholder="Date received" />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  {currencyCode ? <InvoiceAmountInput currency={currencyCode} value={amount} onChange={setAmount} /> :
                    <p className="text-sm text-muted-foreground">Select a customer or currency to enter an amount.</p>}
                  {exactAmount && currencyCode && <p className="text-xs text-muted-foreground">Received: {customerPrepaymentMoney(BigInt(exactAmount.amountMinor), currencyCode)}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={sourceType} onValueChange={setSourceType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepayment">Prepayment</SelectItem>
                      <SelectItem value="overpayment">Overpayment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencySelect value={currencyCode ?? ""} onValueChange={setSelectedCurrency} />
                  {currentContext?.error && !selectedCurrency && <p role="alert" className="text-xs text-destructive">{currentContext.error}</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Payment</SectionLabel>
              <div className="space-y-2">
                <Label>Paid into *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose where the money landed..." />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingBanks.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName} · {acc.currencyCode}
                      </SelectItem>
                    ))}
                    {matchingBanks.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No bank or cash accounts in this currency
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The cash or bank account the customer paid into.
                </p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes about this prepayment..." rows={3} />
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Record prepayment" disabled={!orgId || !contactId || !exactAmount || !selectedBank} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Loan Drawer
// ---------------------------------------------------------------------------
function LoanDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("0.00");
  const [interestPercent, setInterestPercent] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [principalAccountId, setPrincipalAccountId] = useState("");
  const [interestAccountId, setInterestAccountId] = useState("");

  useEffect(() => {
    if (!open) {
      setName(""); setPrincipalAmount("0.00"); setInterestPercent(""); setTermMonths("");
      setStartDate(new Date().toISOString().split("T")[0]); setBankAccountId("");
      setPrincipalAccountId(""); setInterestAccountId("");
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/bank-accounts", { headers: { "x-organization-id": orgId } })
      .then((r) => assetLoanJson(r))
      .then((data) => { if (data.bankAccounts) setBankAccounts(data.bankAccounts); })
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Please enter a loan name"); return; }
    if (!principalAccountId) { toast.error("Please choose the loan (liability) account"); return; }
    if (!interestAccountId) { toast.error("Please choose the interest (expense) account"); return; }

    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }

    try {
      const res = await fetch("/api/v1/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name,
          principalAmountMinor: assetCentsInput(principalAmount),
          interestRate: assetRateInput(interestPercent || "0"),
          termMonths: assetLifeInput(termMonths),
          startDate,
          bankAccountId: bankAccountId || undefined,
          principalAccountId,
          interestAccountId,
        }),
      });
      if (!res.ok) {
        const data = await assetLoanJson(res);
        throw new Error(data.error || "Failed to create loan");
      }
      const data = await assetLoanJson(res);
      toast.success("Loan created");
      onClose();
      router.push(`/accounting/loans/${data.loan.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Landmark className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New loan</SheetTitle>
              <SheetDescription>Track a loan you&apos;ve taken out, its repayments and interest.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Loan Details</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-loan-name">Name *</Label>
                <Input id="drawer-loan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Equipment loan" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-loan-principal">Loan amount</Label>
                  <CurrencyInput id="drawer-loan-principal" prefix="$" value={principalAmount} onChange={setPrincipalAmount} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-loan-rate">Interest rate (%)</Label>
                  <Input id="drawer-loan-rate" type="number" step="0.01" min={0} value={interestPercent} onChange={(e) => setInterestPercent(e.target.value)} placeholder="e.g. 5" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-loan-term">Term (months)</Label>
                  <Input id="drawer-loan-term" type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(e.target.value)} placeholder="e.g. 36" />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Where the money landed</SectionLabel>
              <div className="space-y-2">
                <Label>Paid into</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose where the loan was paid in..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName} · {acc.currencyCode}
                      </SelectItem>
                    ))}
                    {bankAccounts.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No bank or cash accounts yet
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Accounts</SectionLabel>
              <div className="space-y-2">
                <Label>Loan account *</Label>
                <AccountPicker value={principalAccountId} onChange={setPrincipalAccountId} typeFilter={["liability"]} placeholder="Choose the liability account..." />
                <p className="text-[11px] text-muted-foreground">The liability account that tracks what you owe.</p>
              </div>
              <div className="space-y-2">
                <Label>Interest account *</Label>
                <AccountPicker value={interestAccountId} onChange={setInterestAccountId} typeFilter={["expense"]} placeholder="Choose the interest expense account..." />
                <p className="text-[11px] text-muted-foreground">The expense account interest charges are recorded against.</p>
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create loan" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Opening Balance Drawer (debit/credit rows, must balance)
// ---------------------------------------------------------------------------
function OpeningBalanceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    setAccounts([]);
    if (!open) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    fetch("/api/v1/accounts", { headers: { "x-organization-id": orgId } })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadAccountsFailed"))).json())
      .then(data => { if (!cancelled && data.accounts) setAccounts(data.accounts); })
      .catch((error) => toast.error(journalFailureMessage(error, t("loadAccountsFailed"))));
    return () => { cancelled = true; };
  }, [open, t, errors]);
  async function handleSubmit(payload: { date: string; balances: OpeningBalanceWrite[] }) {
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }
    try {
      const res = await fetch("/api/v1/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(payload),
      });
      await requireJournalResponse(res, errors, t("setOpeningFailed"));
      toast.success(t("openingSet"));
      window.dispatchEvent(new Event("opening-balances-updated"));
      onClose();
      router.push("/accounting/opening-balances");
    } catch (err) {
      toast.error(journalFailureMessage(err, t("setOpeningFailed")));
    } finally { setSaving(false); }
  }
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Scale className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("setOpening")}</SheetTitle>
              <SheetDescription>{t("openingDrawerDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        {open && <OpeningBalanceForm accounts={accounts} saving={saving} onCancel={onClose} onSubmit={handleSubmit} />}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Accrual Schedule Drawer
// ---------------------------------------------------------------------------
function AccrualScheduleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [retryKey, setRetryKey] = useState(() => crypto.randomUUID());
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [periods, setPeriods] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reverseAccountId, setReverseAccountId] = useState("");

  useEffect(() => {
    if (!open) {
      setDescription(""); setTotalAmount("0.00"); setEndDate(""); setPeriods("");
      setRetryKey(crypto.randomUUID());
      setAccountId(""); setReverseAccountId("");
      setStartDate(new Date().toISOString().split("T")[0]);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { toast.error("Please enter a description"); return; }
    if (!accountId) { toast.error("Please choose an account"); return; }
    if (!reverseAccountId) { toast.error("Please choose the reversing account"); return; }
    try { accrualUiInput(totalAmount); accrualUiPeriods(periods); } catch (error) { toast.error((error as Error).message); return; }
    if (!endDate) { toast.error("Please choose an end date"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }

    try {
      const res = await fetch("/api/v1/accrual-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          description,
          totalAmountExact: accrualUiInput(totalAmount).exact,
          idempotencyKey: retryKey,
          startDate,
          endDate,
          periods: accrualUiPeriods(periods),
          accountId,
          reverseAccountId,
        }),
      });
      if (!res.ok) {
        const data = await projectCrmJson(res);
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create accrual");
      }
      const data = await projectCrmJson(res);
      toast.success("Accrual created");
      onClose();
      router.push(`/accounting/accruals/${data.schedule.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create accrual");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><CalendarClock className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New accrual</SheetTitle>
              <SheetDescription>Spread a cost or income evenly across several periods.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Accrual Details</SectionLabel>
              <div className="space-y-2">
                <Label htmlFor="drawer-accrual-desc">Description *</Label>
                <Input id="drawer-accrual-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Annual insurance premium" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-accrual-amount">Total amount</Label>
                  <CurrencyInput id="drawer-accrual-amount" prefix="$" value={totalAmount} onChange={setTotalAmount} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-accrual-periods">Number of periods</Label>
                  <Input id="drawer-accrual-periods" type="number" min={1} value={periods} onChange={(e) => setPeriods(e.target.value)} placeholder="e.g. 12" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>Accounts</SectionLabel>
              <div className="space-y-2">
                <Label>Account *</Label>
                <AccountPicker value={accountId} onChange={setAccountId} placeholder="Choose the account..." />
              </div>
              <div className="space-y-2">
                <Label>Reversing account *</Label>
                <AccountPicker value={reverseAccountId} onChange={setReverseAccountId} placeholder="Choose the account each period posts against..." />
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create accrual" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Revenue Schedule Drawer
// ---------------------------------------------------------------------------
interface InvoiceOption {
  id: string;
  number: string | null;
  total: number;
  contact?: { name?: string | null } | null;
}

function RevenueScheduleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [method, setMethod] = useState("straight_line");
  const retryRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!open) {
      retryRef.current = null;
      setInvoiceId(""); setTotalAmount("0.00"); setEndDate(""); setMethod("straight_line");
      setStartDate(new Date().toISOString().split("T")[0]);
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/invoices", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.data) setInvoices(data.data); })
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId) { toast.error("Please choose an invoice"); return; }
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }

    const fingerprint = JSON.stringify({ orgId, invoiceId, totalAmount, startDate, endDate, method });
    if (retryRef.current?.fingerprint !== fingerprint) retryRef.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const res = await fetch("/api/v1/revenue-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          invoiceId,
          totalAmountExact: totalAmount,
          idempotencyKey: retryRef.current.key,
          startDate,
          endDate,
          method,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create revenue schedule");
      }
      const data = await res.json();
      toast.success("Revenue schedule created");
      onClose();
      router.push(`/sales/revenue-schedules/${data.schedule.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create revenue schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><TrendingUp className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">New revenue schedule</SheetTitle>
              <SheetDescription>Recognize income from an invoice gradually over time.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>Schedule Details</SectionLabel>
              <div className="space-y-2">
                <Label>Invoice *</Label>
                <Select value={invoiceId} onValueChange={setInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number || inv.id.slice(0, 8)}
                        {inv.contact?.name ? ` · ${inv.contact.name}` : ""}
                      </SelectItem>
                    ))}
                    {invoices.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No invoices yet
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-revsched-amount">Total amount</Label>
                  <CurrencyInput id="drawer-revsched-amount" prefix="$" value={totalAmount} onChange={setTotalAmount} />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">Even amounts over time</SelectItem>
                      <SelectItem value="milestone">By milestone</SelectItem>
                      <SelectItem value="on_completion">All on completion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label="Create revenue schedule" />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Recurring Journal Drawer (debit/credit legs, must balance)
// ---------------------------------------------------------------------------
interface RecurringJournalRow {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

function RecurringJournalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RecurringJournalRow[]>([
    { accountId: "", description: "", debit: "", credit: "" },
    { accountId: "", description: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    if (!open) {
      setName(""); setFrequency("monthly"); setEndDate(""); setReference(""); setNotes("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setRows([
        { accountId: "", description: "", debit: "", credit: "" },
        { accountId: "", description: "", debit: "", credit: "" },
      ]);
      return;
    }
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    fetch("/api/v1/accounts", { headers: { "x-organization-id": orgId } })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadAccountsFailed"))).json())
      .then((data) => { if (data.accounts) setAccounts(data.accounts); })
      .catch((error) => toast.error(journalFailureMessage(error, t("loadAccountsFailed"))));
  }, [open, t, errors]);

  const preview = journalEditorPreview(rows, { oneSided: true });
  const { totalDebit, totalCredit, isBalanced } = preview;

  function updateRow(index: number, field: keyof RecurringJournalRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { accountId: "", description: "", debit: "", credit: "" }]);
  }
  function removeRow(index: number) {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(t("enterName")); return; }
    if (!isBalanced) return;
    setSaving(true);
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setSaving(false); return; }

    try {
      const res = await fetch("/api/v1/recurring-journals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name,
          frequency,
          startDate,
          endDate: endDate || null,
          reference: reference || null,
          notes: notes || null,
          currencyCode: "USD",
          lines: preview.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description || name.trim(),
            debitAmountMinor: line.debitAmountMinor,
            creditAmountMinor: line.creditAmountMinor,
          })),
        }),
      });
      await requireJournalResponse(res, errors, t("createRecurringFailed"));
      toast.success(t("createdRecurring"));
      onClose();
      router.push("/accounting/recurring-journals");
    } catch (err) {
      toast.error(journalFailureMessage(err, t("createRecurringFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Repeat className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("newRecurring")}</SheetTitle>
              <SheetDescription>{t("recurringDrawerDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("templateDetails")}</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("nameRequired")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("depreciationPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("frequency")}</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">{t("weekly")}</SelectItem>
                      <SelectItem value="fortnightly">{t("fortnightly")}</SelectItem>
                      <SelectItem value="monthly">{t("monthly")}</SelectItem>
                      <SelectItem value="quarterly">{t("quarterly")}</SelectItem>
                      <SelectItem value="semi_annual">{t("semiAnnual")}</SelectItem>
                      <SelectItem value="annual">{t("annual")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("startDateLabel")}</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder={t("startDate")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("endDateOptional")}</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder={t("noEndDate")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("reference")}</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("optionalReference")} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("journalLines")}</Label>
                <p className="text-xs text-muted-foreground">{t("linesHint")}</p>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <div className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>{t("account")}</span>
                  <span>{t("description")}</span>
                  <span className="text-right">{t("debit")}</span>
                  <span className="text-right">{t("credit")}</span>
                  <span />
                </div>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-b px-3 py-2 last:border-b-0"
                  >
                    <Select value={row.accountId} onValueChange={(v) => updateRow(i, "accountId", v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={t("selectAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 text-sm"
                      value={row.description}
                      onChange={(e) => updateRow(i, "description", e.target.value)}
                      placeholder={t("lineMemo")}
                    />
                    <CurrencyInput size="sm" aria-label={t("debitLine", { number: i + 1 })} value={row.debit} onChange={(v) => updateRow(i, "debit", v)} />
                    <CurrencyInput size="sm" aria-label={t("creditLine", { number: i + 1 })} value={row.credit} onChange={(v) => updateRow(i, "credit", v)} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => removeRow(i)}
                      aria-label={t("removeLine", { number: i + 1 })}
                      disabled={rows.length <= 2}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <div className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-t bg-muted/30 px-3 py-2">
                  <Button type="button" variant="ghost" size="sm" onClick={addRow} className="w-fit text-xs">
                    <Plus className="mr-1 size-3" />{t("addLine")}</Button>
                  <span />
                  <span className="text-right text-sm font-mono font-semibold tabular-nums">{journalDecimal(totalDebit)}</span>
                  <span className="text-right text-sm font-mono font-semibold tabular-nums">{journalDecimal(totalCredit)}</span>
                  <span />
                </div>
              </div>
              {preview.error && <p role="alert" className="text-xs text-red-600">{journalPreviewMessage(t, preview.error)}</p>}
              {!preview.error && !isBalanced && totalDebit + totalCredit > 0n && (
                <p className="text-xs font-medium text-red-600">
                  {t("imbalance", { debit: journalDecimal(totalDebit), credit: journalDecimal(totalCredit) })}
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <SectionLabel>{t("notes")}</SectionLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} rows={3} />
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving || !isBalanced} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? t("creating") : t("createRecurring")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
