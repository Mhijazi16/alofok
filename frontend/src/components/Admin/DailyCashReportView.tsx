import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { subDays, addDays, format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/useToast";
import { adminApi } from "@/services/adminApi";
import type { RepCashSummary } from "@/services/adminApi";
import { toLocalDateStr } from "@/lib/utils";

export function DailyCashReportView() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isRTL = i18n.language === "ar";

  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [handedOverInputs, setHandedOverInputs] = useState<Record<string, string>>({});
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [flaggingRep, setFlaggingRep] = useState<string | null>(null);
  const [editingReps, setEditingReps] = useState<Set<string>>(new Set());
  const dateStr = toLocalDateStr(reportDate);
  const isToday = dateStr === toLocalDateStr(new Date());

  const goToPrev = () => setReportDate((d) => subDays(d, 1));
  const goToNext = () => {
    if (!isToday) setReportDate((d) => addDays(d, 1));
  };

  const { data: report, isLoading } = useQuery({
    queryKey: ["daily-cash-report", dateStr],
    queryFn: () => adminApi.getDailyCashReport(dateStr),
  });

  useEffect(() => {
    if (!report) return;
    const initial: Record<string, string> = {};
    for (const rep of report.reps) {
      if (rep.confirmation?.handed_over_amount != null) {
        initial[rep.rep_id] = String(rep.confirmation.handed_over_amount);
      } else {
        initial[rep.rep_id] = String(rep.computed_net);
      }
    }
    setHandedOverInputs(initial);
    setEditingReps(new Set());
  }, [report]);

  const confirmMutation = useMutation({
    mutationFn: adminApi.confirmHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
      toast({ title: t("cash.confirmed"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const flagMutation = useMutation({
    mutationFn: adminApi.flagHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
      toast({ title: t("cash.flagged"), variant: "warning" });
      setFlaggingRep(null);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const enterEditMode = (repId: string) => {
    setEditingReps((prev) => {
      const next = new Set(prev);
      next.add(repId);
      return next;
    });
  };

  const getDiscrepancy = (rep: RepCashSummary) => {
    const computedNet = rep.computed_net;
    const handedOver = parseFloat(handedOverInputs[rep.rep_id] ?? "") || 0;
    const diff = Math.abs(handedOver - computedNet);
    const pct = computedNet !== 0 ? diff / Math.abs(computedNet) : 0;
    return { pct, hasDiscrepancy: pct > 0.05 };
  };

  const getRepStatus = (rep: RepCashSummary) => {
    if (!rep.confirmation) return "pending";
    if (rep.confirmation.is_flagged) return "flagged";
    return "confirmed";
  };

  const handleConfirm = (rep: RepCashSummary) => {
    const amount = parseFloat(handedOverInputs[rep.rep_id] ?? "0") || 0;
    confirmMutation.mutate({
      rep_id: rep.rep_id,
      report_date: dateStr,
      handed_over_amount: amount,
    });
    setEditingReps((prev) => {
      const next = new Set(prev);
      next.delete(rep.rep_id);
      return next;
    });
  };

  const handleFlag = (rep: RepCashSummary) => {
    const notes = flagInputs[rep.rep_id]?.trim() ?? "";
    if (!notes) return;
    const amount = parseFloat(handedOverInputs[rep.rep_id] ?? "0") || 0;
    flagMutation.mutate({
      rep_id: rep.rep_id,
      report_date: dateStr,
      handed_over_amount: amount,
      flag_notes: notes,
    });
  };

  const formatCurrency = (value: number) =>
    `₪${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-32" />
        ))}
      </div>
    );
  }

  // Compute section totals
  const totalIncoming = report ? report.grand_cash + report.grand_checks : 0;
  const totalOutgoing = report ? report.grand_expenses : 0;

  return (
      <div className="space-y-5 max-w-2xl mx-auto">

        {/* Date navigation */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" onClick={goToPrev} className="p-2">
            {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>

          <div className="flex-1 max-w-[220px]">
            <DatePicker
              mode="single"
              value={reportDate}
              onChange={(date) => { if (date) setReportDate(date); }}
              placeholder={format(reportDate, "PPP")}
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
            {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>

        {report && report.reps.length === 0 && (
          <EmptyState preset="no-data" title={t("cash.noActivity")} className="py-12" />
        )}

        {report && report.reps.length > 0 && (
          <>
            {/* ── INCOMING SECTION ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-emerald-400" />
                <h2 className="text-body font-bold text-foreground">{t("cash.incoming")}</h2>
                <div className="flex-1" />
                <span className="text-body font-bold text-emerald-400 tabular-nums">
                  {formatCurrency(totalIncoming)}
                </span>
              </div>

              {/* Cash total card */}
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("cash.cashPayments")}</span>
                    <span className="text-body-sm font-semibold text-emerald-400 tabular-nums">
                      {formatCurrency(report.grand_cash)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Checks total card */}
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("cash.checkPayments")}</span>
                    <span className="text-body-sm font-semibold text-blue-400 tabular-nums">
                      {formatCurrency(report.grand_checks)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* ── OUTGOING SECTION ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-red-400" />
                <h2 className="text-body font-bold text-foreground">{t("cash.outgoing")}</h2>
                <div className="flex-1" />
                <span className="text-body font-bold text-red-400 tabular-nums">
                  {formatCurrency(totalOutgoing)}
                </span>
              </div>

              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("cash.expenses")}</span>
                    <span className="text-body-sm font-semibold text-red-400 tabular-nums">
                      {formatCurrency(report.grand_expenses)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* ── NET SUMMARY ── */}
            <Card variant="glass">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-body font-semibold text-foreground">{t("cash.netHandover")}</span>
                  <span className={`text-h3 font-bold tabular-nums ${report.grand_net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(report.grand_net)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* ── PER-REP HANDOVER ── */}
            <div className="space-y-3">
              <h2 className="text-body font-bold text-foreground">{t("cash.repHandovers")}</h2>

              {report.reps.map((rep) => {
                const status = getRepStatus(rep);
                const isInEditMode = editingReps.has(rep.rep_id);
                const showConfirmForm = status === "pending" || isInEditMode;
                const showFlagForm = flaggingRep === rep.rep_id;
                const { pct, hasDiscrepancy } = getDiscrepancy(rep);

                const borderClass =
                  rep.confirmation?.is_flagged ? "border-red-500/40"
                  : rep.confirmation && !isInEditMode ? "border-emerald-500/40"
                  : "border-yellow-500/20";

                return (
                  <Card key={rep.rep_id} className={`transition-all ${borderClass}`}>
                    <CardContent className="p-4 space-y-3">

                      {/* Rep header */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{rep.rep_name}</span>
                        <Badge
                          variant={
                            status === "confirmed" ? "success"
                            : status === "flagged" ? "destructive"
                            : "outline"
                          }
                          size="sm"
                        >
                          {status === "confirmed" && <CheckCircle2 className="h-3 w-3 me-1" />}
                          {status === "flagged" && <Flag className="h-3 w-3 me-1" />}
                          {t(`cash.${status}Status`)}
                        </Badge>
                      </div>

                      {/* Mini summary: 3 colored values */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-caption text-muted-foreground">{t("cash.cashPayments")}</p>
                          <p className="text-body-sm font-semibold text-emerald-400 tabular-nums">
                            {formatCurrency(rep.cash_total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">{t("cash.checkPayments")}</p>
                          <p className="text-body-sm font-semibold text-blue-400 tabular-nums">
                            {formatCurrency(rep.check_total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">{t("cash.expenses")}</p>
                          <p className="text-body-sm font-semibold text-red-400 tabular-nums">
                            {formatCurrency(rep.expense_total)}
                          </p>
                        </div>
                      </div>

                      {/* Net for this rep */}
                      <div className="flex items-center justify-between rounded-lg bg-card/50 px-3 py-2">
                        <span className="text-body-sm text-muted-foreground">{t("cash.netHandover")}</span>
                        <span className={`text-body-sm font-bold tabular-nums ${rep.computed_net >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                          {formatCurrency(rep.computed_net)}
                        </span>
                      </div>

                      {/* Confirmed display */}
                      {status === "confirmed" && !isInEditMode && rep.confirmation && (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                          <div className="space-y-0.5">
                            <p className="text-body-sm font-semibold text-foreground">
                              {formatCurrency(rep.confirmation.handed_over_amount)}
                            </p>
                            <p className="text-caption text-muted-foreground">
                              {rep.confirmation.confirmed_at
                                ? format(new Date(rep.confirmation.confirmed_at), "PPp")
                                : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => enterEditMode(rep.rep_id)}>
                            <Pencil className="h-3.5 w-3.5 me-1" />
                            {t("cash.undoConfirm")}
                          </Button>
                        </div>
                      )}

                      {/* Flagged display */}
                      {status === "flagged" && !isInEditMode && rep.confirmation && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Flag className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                <p className="text-body-sm font-semibold text-foreground">
                                  {formatCurrency(rep.confirmation.handed_over_amount)}
                                </p>
                              </div>
                              {rep.confirmation.flag_notes && (
                                <p className="text-caption text-muted-foreground truncate">
                                  {rep.confirmation.flag_notes}
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => enterEditMode(rep.rep_id)} className="shrink-0 ms-2">
                              <Pencil className="h-3.5 w-3.5 me-1" />
                              {t("cash.undoConfirm")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Confirm form */}
                      {showConfirmForm && !showFlagForm && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-caption text-muted-foreground font-medium">
                              {t("cash.handedOver")}
                            </label>
                            <Input
                              type="number"
                              value={handedOverInputs[rep.rep_id] ?? ""}
                              onChange={(e) =>
                                setHandedOverInputs((prev) => ({
                                  ...prev,
                                  [rep.rep_id]: e.target.value,
                                }))
                              }
                              className="tabular-nums"
                            />
                          </div>

                          {hasDiscrepancy && (
                            <div className="flex items-center gap-1.5 text-yellow-400 text-caption">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{t("cash.discrepancy", { pct: (pct * 100).toFixed(1) })}</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleConfirm(rep)}
                              isLoading={confirmMutation.isPending}
                              disabled={confirmMutation.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                              {t("cash.confirm")}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              onClick={() => setFlaggingRep(rep.rep_id)}
                              disabled={confirmMutation.isPending}
                            >
                              <Flag className="h-3.5 w-3.5 me-1.5" />
                              {t("cash.flag")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Flag notes form */}
                      {showFlagForm && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-caption text-muted-foreground font-medium">
                              {t("cash.flagNotes")}
                            </label>
                            <textarea
                              value={flagInputs[rep.rep_id] ?? ""}
                              onChange={(e) =>
                                setFlagInputs((prev) => ({
                                  ...prev,
                                  [rep.rep_id]: e.target.value,
                                }))
                              }
                              rows={3}
                              placeholder={t("cash.flagNotesRequired")}
                              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleFlag(rep)}
                              isLoading={flagMutation.isPending}
                              disabled={
                                flagMutation.isPending ||
                                !(flagInputs[rep.rep_id]?.trim().length > 0)
                              }
                            >
                              <Flag className="h-3.5 w-3.5 me-1.5" />
                              {t("cash.flag")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFlaggingRep(null)}
                              disabled={flagMutation.isPending}
                            >
                              {t("actions.cancel")}
                            </Button>
                          </div>
                        </div>
                      )}

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

      </div>
  );
}
