import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subDays, addDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  CheckCircle2,
  Flag,
  Undo2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwipeableCard } from "@/components/ui/swipeable-card";
import { useToast } from "@/hooks/useToast";
import { adminApi } from "@/services/adminApi";
import type { LedgerEntry, RepLedgerGroup } from "@/services/adminApi";
import { toLocalDateStr } from "@/lib/utils";

export function DailyCashReportView() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  // ── State ──────────────────────────────────────────────────────────────────
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagNotes, setFlagNotes] = useState("");
  const [pendingFlagIds, setPendingFlagIds] = useState<string[]>([]);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionMode = selectedIds.size > 0;

  const dateStr = toLocalDateStr(reportDate);
  const isToday = dateStr === toLocalDateStr(new Date());

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrev = () => setReportDate((d) => subDays(d, 1));
  const goToNext = () => {
    if (!isToday) setReportDate((d) => addDays(d, 1));
  };

  const formattedDate = reportDate.toLocaleDateString(
    isAr ? "ar-SA" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: report, isLoading } = useQuery({
    queryKey: ["daily-ledger", dateStr],
    queryFn: () => adminApi.getDailyLedger(dateStr),
  });

  const statusMutation = useMutation({
    mutationFn: adminApi.updateLedgerStatus,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
      if (variables.status === "confirmed") {
        toast({ title: t("cash.confirmed"), variant: "success" });
      } else if (variables.status === "flagged") {
        toast({ title: t("cash.flagged"), variant: "warning" });
      } else {
        toast({ title: t("cash.undone"), variant: "default" });
      }
      setSelectedIds(new Set());
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmt = (value: number) =>
    `₪${value.toLocaleString(isAr ? "ar-SA" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(isAr ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(
    (ids: string[]) => {
      statusMutation.mutate({ ids, status: "confirmed" });
    },
    [statusMutation],
  );

  const handleUndo = useCallback(
    (ids: string[]) => {
      statusMutation.mutate({ ids, status: "pending" });
    },
    [statusMutation],
  );

  const openFlagDialog = useCallback((ids: string[]) => {
    setPendingFlagIds(ids);
    setFlagNotes("");
    setFlagDialogOpen(true);
  }, []);

  const submitFlag = useCallback(() => {
    if (!flagNotes.trim()) return;
    statusMutation.mutate({
      ids: pendingFlagIds,
      status: "flagged",
      flag_notes: flagNotes.trim(),
    });
    setFlagDialogOpen(false);
    setPendingFlagIds([]);
    setFlagNotes("");
  }, [flagNotes, pendingFlagIds, statusMutation]);

  // ── Long-press multi-select ────────────────────────────────────────────────
  const startLongPress = useCallback(
    (id: string) => {
      longPressTimer.current = setTimeout(() => {
        setSelectedIds((prev) => new Set(prev).add(id));
      }, 500);
    },
    [],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCardClick = useCallback(
    (id: string) => {
      if (selectionMode) {
        toggleSelection(id);
      } else {
        setExpandedId((prev) => (prev === id ? null : id));
      }
    },
    [selectionMode, toggleSelection],
  );

  // ── Swipe actions per status ───────────────────────────────────────────────
  const getSwipeActions = (entry: LedgerEntry) => {
    const confirmAction = {
      label: t("cash.confirm"),
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "bg-emerald-600",
      onClick: () => handleConfirm([entry.id]),
    };
    const flagAction = {
      label: t("cash.flag"),
      icon: <Flag className="h-5 w-5" />,
      color: "bg-red-600",
      onClick: () => openFlagDialog([entry.id]),
    };
    const undoAction = {
      label: t("cash.undo"),
      icon: <Undo2 className="h-5 w-5" />,
      color: "bg-zinc-600",
      onClick: () => handleUndo([entry.id]),
    };

    switch (entry.status) {
      case "pending":
        return [confirmAction, flagAction];
      case "confirmed":
        return [undoAction, flagAction];
      case "flagged":
        return [confirmAction, undoAction];
      default:
        return [];
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderLedgerCard = (entry: LedgerEntry) => {
    const isCash = entry.payment_method === "cash";
    const isExpanded = expandedId === entry.id;
    const isSelected = selectedIds.has(entry.id);

    return (
      <SwipeableCard
        key={entry.id}
        rightActions={getSwipeActions(entry)}
        disabled={selectionMode}
      >
        <Card
          className={`cursor-pointer transition-all ${
            isSelected ? "ring-2 ring-primary" : ""
          } ${isCash ? "border-emerald-500/20" : "border-blue-500/20"}`}
          onPointerDown={() => startLongPress(entry.id)}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onClick={() => handleCardClick(entry.id)}
        >
          <CardContent className="p-3">
            {/* Main row */}
            <div className="flex items-center gap-2">
              {selectionMode && (
                isSelected
                  ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              {isCash ? (
                <Banknote className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <CreditCard className="h-4 w-4 text-blue-400 shrink-0" />
              )}

              <span className="text-body-sm font-medium text-foreground flex-1 truncate">
                {entry.customer_name || entry.category || "—"}
              </span>

              {/* Status indicator */}
              {entry.status === "confirmed" && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              )}
              {entry.status === "flagged" && (
                <Flag className="h-4 w-4 text-red-400 shrink-0" />
              )}

              <span
                className={`text-body-sm font-bold tabular-nums ${
                  isCash ? "text-emerald-400" : "text-blue-400"
                }`}
              >
                {fmt(entry.amount)}
              </span>
            </div>

            {/* Expanded details */}
            {isExpanded && !selectionMode && (
              <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-caption text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t("cash.paymentTime")}</span>
                  <span className="text-foreground">{fmtTime(entry.created_at)}</span>
                </div>
                {entry.notes && (
                  <div className="flex justify-between">
                    <span>{t("cash.notes")}</span>
                    <span className="text-foreground">{entry.notes}</span>
                  </div>
                )}
                {entry.flag_notes && (
                  <div className="flex justify-between">
                    <span>{t("cash.flagNotes")}</span>
                    <span className="text-red-400">{entry.flag_notes}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </SwipeableCard>
    );
  };

  const renderRepGroup = (group: RepLedgerGroup) => (
    <div key={group.rep_id} className="space-y-2">
      <h3 className="text-body-sm font-semibold text-muted-foreground px-1">
        {group.rep_name}
      </h3>
      {group.entries.map(renderLedgerCard)}
    </div>
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-20" />
        ))}
      </div>
    );
  }

  const hasIncoming = report && report.incoming.length > 0;
  const hasOutgoing = report && report.outgoing.length > 0;
  const hasData = hasIncoming || hasOutgoing;

  return (
    <div className="space-y-5 max-w-2xl mx-auto" dir={isAr ? "rtl" : "ltr"}>
      {/* ── Date Navigation ── */}
      <div className="flex items-center justify-center gap-3" dir="ltr">
        <Button variant="ghost" size="sm" onClick={goToPrev} className="p-2">
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 max-w-[220px]">
          <DatePicker
            mode="single"
            value={reportDate}
            onChange={(date) => {
              if (date) setReportDate(date);
            }}
            placeholder={formattedDate}
            disabled={false}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNext}
          disabled={isToday}
          className="p-2"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Empty state ── */}
      {!hasData && (
        <EmptyState preset="no-data" title={t("cash.noActivity")} className="py-12" />
      )}

      {hasData && (
        <>
          {/* ── Incoming Section ── */}
          {hasIncoming && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-emerald-400" />
                <h2 className="text-body font-bold text-foreground">
                  {t("cash.incoming")}
                </h2>
              </div>
              {report!.incoming.map(renderRepGroup)}
            </div>
          )}

          {hasIncoming && hasOutgoing && <Separator />}

          {/* ── Outgoing Section ── */}
          {hasOutgoing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-red-400" />
                <h2 className="text-body font-bold text-foreground">
                  {t("cash.outgoing")}
                </h2>
              </div>
              {report!.outgoing.map(renderRepGroup)}
            </div>
          )}

          {/* ── Swipe hint ── */}
          {!selectionMode && (
            <p className="text-center text-caption text-muted-foreground">
              {t("cash.swipeToAct")}
            </p>
          )}
        </>
      )}

      {/* ── Floating selection bar ── */}
      {selectionMode && (
        <div className="fixed bottom-20 inset-x-0 z-50 px-4">
          <div className="max-w-2xl mx-auto rounded-xl bg-card border border-border shadow-xl p-3 flex items-center gap-2">
            <span className="text-body-sm font-medium text-foreground flex-1">
              {t("cash.selectedCount", { count: selectedIds.size })}
            </span>

            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleConfirm(Array.from(selectedIds))}
              disabled={statusMutation.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5 me-1" />
              {t("cash.confirmSelected")}
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() => openFlagDialog(Array.from(selectedIds))}
              disabled={statusMutation.isPending}
            >
              <Flag className="h-3.5 w-3.5 me-1" />
              {t("cash.flagSelected")}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Flag Notes Dialog ── */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cash.flagNotes")}</DialogTitle>
          </DialogHeader>
          <textarea
            value={flagNotes}
            onChange={(e) => setFlagNotes(e.target.value)}
            rows={3}
            placeholder={t("cash.flagNotesRequired")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlagDialogOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={submitFlag}
              disabled={!flagNotes.trim() || statusMutation.isPending}
              isLoading={statusMutation.isPending}
            >
              <Flag className="h-3.5 w-3.5 me-1" />
              {t("cash.flag")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
