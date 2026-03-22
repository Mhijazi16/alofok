import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  UtensilsCrossed,
  Fuel,
  Gift,
  CarFront,
  MoreHorizontal,
  Zap,
  Wifi,
  Wrench,
  Wallet,
  type LucideIcon,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/useToast";
import { salesApi } from "@/services/salesApi";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategoryConfig {
  key: string;
  icon: LucideIcon;
  bg: string;
  color: string;
}

interface ExpenseCardProps {
  categories: CategoryConfig[];
  date: string; // YYYY-MM-DD
  isAdmin?: boolean;
  className?: string;
}

// ── Category presets ─────────────────────────────────────────────────────────

export const REP_CATEGORIES: CategoryConfig[] = [
  { key: "Food", icon: UtensilsCrossed, bg: "bg-orange-500/15", color: "text-orange-400" },
  { key: "Fuel", icon: Fuel, bg: "bg-blue-500/15", color: "text-blue-400" },
  { key: "Gifts", icon: Gift, bg: "bg-pink-500/15", color: "text-pink-400" },
  { key: "CarWash", icon: CarFront, bg: "bg-cyan-500/15", color: "text-cyan-400" },
  { key: "Other", icon: MoreHorizontal, bg: "bg-zinc-500/15", color: "text-zinc-400" },
];

export const ADMIN_CATEGORIES: CategoryConfig[] = [
  ...REP_CATEGORIES.filter((c) => c.key !== "Other"),
  { key: "Electricity", icon: Zap, bg: "bg-yellow-500/15", color: "text-yellow-400" },
  { key: "Internet", icon: Wifi, bg: "bg-indigo-500/15", color: "text-indigo-400" },
  { key: "CarRepair", icon: Wrench, bg: "bg-amber-500/15", color: "text-amber-400" },
  { key: "Salaries", icon: Wallet, bg: "bg-emerald-500/15", color: "text-emerald-400" },
  { key: "Other", icon: MoreHorizontal, bg: "bg-zinc-500/15", color: "text-zinc-400" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string) {
  switch (status) {
    case "confirmed":
      return "default" as const;
    case "flagged":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "text-green-400";
    case "flagged":
      return "text-red-400";
    default:
      return "text-yellow-400";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExpenseCard({ categories, date, isAdmin = false, className }: ExpenseCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Form state ──
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date(date + "T00:00:00"));
  const [notes, setNotes] = useState("");

  // ── Data ──
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["my-expenses", date],
    queryFn: () => salesApi.getMyExpenses(date),
  });

  const total = expenses?.reduce((sum, e) => sum + Math.abs(e.amount), 0) ?? 0;

  // ── Mutations ──
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["my-expenses"] });
    queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
  };

  const createMutation = useMutation({
    mutationFn: salesApi.createExpense,
    onSuccess: () => {
      toast({ title: t("expense.added"), variant: "default" });
      invalidateQueries();
      resetForm();
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: salesApi.deleteExpense,
    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey: ["my-expenses", date] });
      const previous = queryClient.getQueryData(["my-expenses", date]);
      queryClient.setQueryData(["my-expenses", date], (old: any) =>
        old?.filter((e: any) => e.id !== expenseId)
      );
      toast({ title: t("expense.deleted"), variant: "default" });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-expenses", date], context.previous);
      }
      toast({ title: t("toast.error"), variant: "error" });
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  function resetForm() {
    setSelectedCategory(null);
    setAmount("");
    setExpenseDate(new Date(date + "T00:00:00"));
    setNotes("");
  }

  function handleSubmit() {
    if (!selectedCategory || !amount || Number(amount) <= 0) return;
    const dateStr = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, "0")}-${String(expenseDate.getDate()).padStart(2, "0")}`;
    createMutation.mutate({
      amount: Number(amount),
      category: selectedCategory,
      date: dateStr,
      notes: notes.trim() || undefined,
    });
  }

  function getCategoryConfig(key: string): CategoryConfig | undefined {
    return categories.find((c) => c.key === key);
  }

  return (
    <>
      {/* ── Expenses group: header + dropdown in one bordered container ── */}
      <div
        className={`rounded-xl border border-border/60 overflow-hidden transition-all duration-200 ${className ?? ""}`}
      >
        {/* Header button */}
        <Button
          variant="ghost"
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`
            flex w-full items-center justify-between p-3 glass cursor-pointer h-auto rounded-none
            transition-colors hover:bg-accent/30
            ${expanded ? "border-b border-border/40" : ""}
          `}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
              <Receipt className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-start">
              <p className="text-body-sm font-semibold text-foreground">
                {t("expense.title")}
              </p>
              {!isLoading && expenses && expenses.length > 0 && (
                <p className="text-caption text-muted-foreground">
                  {expenses.length} {expenses.length === 1 ? "item" : "items"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <span className="text-body font-bold text-red-400" dir="ltr">
                {total.toLocaleString("en-US", { minimumFractionDigits: 0 })} ILS
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>

        {/* Expanded dropdown inside the same container */}
        {expanded && (
          <div className="bg-card/30 p-2 space-y-1.5">
            {isLoading ? (
              <div className="space-y-1.5">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : expenses && expenses.length > 0 ? (
              expenses.map((expense) => {
                const cat = getCategoryConfig(expense.category ?? "");
                const CatIcon = cat?.icon ?? Receipt;
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 rounded-lg bg-card/50 p-2.5"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cat?.bg ?? "bg-zinc-500/15"}`}
                    >
                      <CatIcon className={`h-4 w-4 ${cat?.color ?? "text-zinc-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-foreground truncate">
                        {t(`expense.category.${expense.category ?? "Other"}`)}
                      </p>
                      {expense.notes && (
                        <p className="text-caption text-muted-foreground truncate">
                          {expense.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-body-sm font-semibold text-foreground" dir="ltr">
                        {Math.abs(expense.amount).toLocaleString("en-US")} ILS
                      </span>
                      <Badge
                        variant={statusBadgeVariant(expense.status)}
                        size="sm"
                        className={statusColor(expense.status)}
                      >
                        {t(`cash.${expense.status === "confirmed" ? "confirmed" : expense.status === "flagged" ? "flagged" : "confirm"}`)}
                      </Badge>
                      {!isAdmin && expense.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(expense.id);
                          }}
                          className="h-7 w-7 rounded-md hover:bg-destructive/15"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-body-sm text-muted-foreground py-3">
                {t("expense.noExpenses")}
              </p>
            )}

            {/* Add button inside the dropdown */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1"
              onClick={(e) => {
                e.stopPropagation();
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 me-1" />
              {t("expense.addExpense")}
            </Button>
          </div>
        )}
      </div>

      {/* ── Add Expense Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("expense.addExpense")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category grid */}
            <div>
              <p className="text-body-sm font-medium text-muted-foreground mb-2">
                {t("expense.selectCategory")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <Button
                      key={cat.key}
                      variant="ghost"
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`
                        flex flex-col items-center gap-1.5 rounded-xl p-3 h-auto transition-all
                        ${isSelected
                          ? "ring-2 ring-primary bg-primary/10"
                          : "bg-card hover:bg-accent"
                        }
                      `}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat.bg}`}>
                        <cat.icon className={`h-5 w-5 ${cat.color}`} />
                      </div>
                      <span className="text-caption font-medium text-foreground">
                        {t(`expense.category.${cat.key}`)}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-body-sm font-medium text-muted-foreground mb-1 block">
                {t("expense.amount")} (ILS)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-body ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                placeholder="0.00"
                dir="ltr"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-body-sm font-medium text-muted-foreground mb-1 block">
                {t("expense.date")}
              </label>
              <DatePicker
                value={expenseDate}
                onChange={(d) => d && setExpenseDate(d)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-body-sm font-medium text-muted-foreground mb-1 block">
                {t("expense.notes")}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("expense.notes")}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              disabled={!selectedCategory || !amount || Number(amount) <= 0 || createMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending ? "..." : t("expense.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
