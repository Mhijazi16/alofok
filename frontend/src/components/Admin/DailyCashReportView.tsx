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
  Banknote,
  CreditCard,
} from "lucide-react";
import { subDays, addDays } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { adminApi } from "@/services/adminApi";
import type { RepCashSummary, RepPaymentDetail } from "@/services/adminApi";
import { toLocalDateStr } from "@/lib/utils";

export function DailyCashReportView() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [handedOverInput, setHandedOverInput] = useState("");
  const [flagNotes, setFlagNotes] = useState("");
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const dateStr = toLocalDateStr(reportDate);
  const isToday = dateStr === toLocalDateStr(new Date());

  const goToPrev = () => setReportDate((d) => subDays(d, 1));
  const goToNext = () => {
    if (!isToday) setReportDate((d) => addDays(d, 1));
  };

  // Format date in current locale
  const formattedDate = reportDate.toLocaleDateString(
    isAr ? "ar-SA" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const { data: report, isLoading } = useQuery({
    queryKey: ["daily-cash-report", dateStr],
    queryFn: () => adminApi.getDailyCashReport(dateStr),
  });

  // Fetch individual payments when a rep is selected
  const { data: repDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["rep-payment-details", selectedRepId, dateStr],
    queryFn: () => adminApi.getRepPaymentDetails(selectedRepId!, dateStr),
    enabled: !!selectedRepId,
  });

  // Reset selection when date changes
  useEffect(() => {
    setSelectedRepId(null);
    setEditing(false);
    setShowFlagForm(false);
  }, [dateStr]);

  // Init handed-over input when rep changes
  useEffect(() => {
    if (!report || !selectedRepId) return;
    const rep = report.reps.find((r) => r.rep_id === selectedRepId);
    if (!rep) return;
    if (rep.confirmation?.handed_over_amount != null) {
      setHandedOverInput(String(rep.confirmation.handed_over_amount));
    } else {
      setHandedOverInput(String(rep.computed_net));
    }
    setEditing(false);
    setShowFlagForm(false);
    setFlagNotes("");
  }, [selectedRepId, report]);

  const confirmMutation = useMutation({
    mutationFn: adminApi.confirmHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
      toast({ title: t("cash.confirmed"), variant: "success" });
      setEditing(false);
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const flagMutation = useMutation({
    mutationFn: adminApi.flagHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
      toast({ title: t("cash.flagged"), variant: "warning" });
      setShowFlagForm(false);
      setEditing(false);
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const selectedRep = report?.reps.find((r) => r.rep_id === selectedRepId) ?? null;

  const getDiscrepancy = (rep: RepCashSummary) => {
    const handedOver = parseFloat(handedOverInput) || 0;
    const diff = Math.abs(handedOver - rep.computed_net);
    const pct = rep.computed_net !== 0 ? diff / Math.abs(rep.computed_net) : 0;
    return { pct, hasDiscrepancy: pct > 0.05 };
  };

  const getRepStatus = (rep: RepCashSummary) => {
    if (!rep.confirmation) return "pending";
    if (rep.confirmation.is_flagged) return "flagged";
    return "confirmed";
  };

  const handleConfirm = () => {
    if (!selectedRepId) return;
    const amount = parseFloat(handedOverInput) || 0;
    confirmMutation.mutate({ rep_id: selectedRepId, report_date: dateStr, handed_over_amount: amount });
  };

  const handleFlag = () => {
    if (!selectedRepId || !flagNotes.trim()) return;
    const amount = parseFloat(handedOverInput) || 0;
    flagMutation.mutate({ rep_id: selectedRepId, report_date: dateStr, handed_over_amount: amount, flag_notes: flagNotes.trim() });
  };

  const fmt = (value: number) =>
    `₪${value.toLocaleString(isAr ? "ar-SA" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fmtTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-32" />
        ))}
      </div>
    );
  }

  const totalIncoming = report ? report.grand_cash + report.grand_checks : 0;
  const totalOutgoing = report ? report.grand_expenses : 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Date navigation — arrows always Left=prev Right=next regardless of RTL */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={goToPrev} className="p-2">
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 max-w-[220px]">
          <DatePicker
            mode="single"
            value={reportDate}
            onChange={(date) => { if (date) setReportDate(date); }}
            placeholder={formattedDate}
            disabled={false}
          />
        </div>

        <Button variant="ghost" size="sm" onClick={goToNext} disabled={isToday} className="p-2">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Localized date label */}
      <p className="text-center text-body-sm text-muted-foreground">{formattedDate}</p>

      {report && report.reps.length === 0 && (
        <EmptyState preset="no-data" title={t("cash.noActivity")} className="py-12" />
      )}

      {report && report.reps.length > 0 && (
        <>
          {/* ── INCOMING SECTION ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-body font-bold text-foreground flex-1">{t("cash.incoming")}</h2>
              <span className="text-body font-bold text-emerald-400 tabular-nums">{fmt(totalIncoming)}</span>
            </div>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-body-sm text-muted-foreground">{t("cash.cashPayments")}</span>
                <span className="text-body-sm font-semibold text-emerald-400 tabular-nums">{fmt(report.grand_cash)}</span>
              </CardContent>
            </Card>

            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-body-sm text-muted-foreground">{t("cash.checkPayments")}</span>
                <span className="text-body-sm font-semibold text-blue-400 tabular-nums">{fmt(report.grand_checks)}</span>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* ── OUTGOING SECTION ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-red-400" />
              <h2 className="text-body font-bold text-foreground flex-1">{t("cash.outgoing")}</h2>
              <span className="text-body font-bold text-red-400 tabular-nums">{fmt(totalOutgoing)}</span>
            </div>

            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-body-sm text-muted-foreground">{t("cash.expenses")}</span>
                <span className="text-body-sm font-semibold text-red-400 tabular-nums">{fmt(report.grand_expenses)}</span>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* ── NET SUMMARY ── */}
          <Card variant="glass">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-body font-semibold text-foreground">{t("cash.netHandover")}</span>
              <span className={`text-h3 font-bold tabular-nums ${report.grand_net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmt(report.grand_net)}
              </span>
            </CardContent>
          </Card>

          <Separator />

          {/* ── REP HANDOVER ── */}
          <div className="space-y-4">
            <h2 className="text-body font-bold text-foreground">{t("cash.repHandovers")}</h2>

            {/* Rep dropdown */}
            <Select value={selectedRepId ?? ""} onValueChange={(v) => setSelectedRepId(v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("cash.selectRep")} />
              </SelectTrigger>
              <SelectContent>
                {report.reps.map((rep) => {
                  const status = getRepStatus(rep);
                  return (
                    <SelectItem key={rep.rep_id} value={rep.rep_id}>
                      <span className="flex items-center gap-2">
                        {rep.rep_name}
                        {status === "confirmed" && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                        {status === "flagged" && <Flag className="h-3 w-3 text-red-400" />}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Selected rep content */}
            {selectedRep && (
              <div className="space-y-3">
                {/* Rep summary row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-caption text-muted-foreground">{t("cash.cashPayments")}</p>
                    <p className="text-body-sm font-semibold text-emerald-400 tabular-nums">{fmt(selectedRep.cash_total)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-muted-foreground">{t("cash.checkPayments")}</p>
                    <p className="text-body-sm font-semibold text-blue-400 tabular-nums">{fmt(selectedRep.check_total)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-muted-foreground">{t("cash.expenses")}</p>
                    <p className="text-body-sm font-semibold text-red-400 tabular-nums">{fmt(selectedRep.expense_total)}</p>
                  </div>
                </div>

                {/* Net */}
                <div className="flex items-center justify-between rounded-lg bg-card/50 px-3 py-2">
                  <span className="text-body-sm text-muted-foreground">{t("cash.netHandover")}</span>
                  <span className={`text-body-sm font-bold tabular-nums ${selectedRep.computed_net >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                    {fmt(selectedRep.computed_net)}
                  </span>
                </div>

                {/* Payment cards */}
                <div className="space-y-2">
                  <h3 className="text-body-sm font-semibold text-muted-foreground">{t("cash.payments")}</h3>

                  {detailsLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} variant="card" className="h-16" />
                      ))}
                    </div>
                  )}

                  {repDetails && repDetails.payments.length === 0 && (
                    <p className="text-caption text-muted-foreground py-4 text-center">{t("cash.noActivity")}</p>
                  )}

                  {repDetails?.payments.map((payment: RepPaymentDetail) => {
                    const isCash = payment.type === "Payment_Cash";
                    const isExpanded = expandedTx === payment.transaction_id;

                    return (
                      <Card
                        key={payment.transaction_id}
                        className={`cursor-pointer transition-all ${isCash ? "border-emerald-500/20" : "border-blue-500/20"}`}
                        onClick={() => setExpandedTx(isExpanded ? null : payment.transaction_id)}
                      >
                        <CardContent className="p-3">
                          {/* Condensed row */}
                          <div className="flex items-center gap-2">
                            {isCash
                              ? <Banknote className="h-4 w-4 text-emerald-400 shrink-0" />
                              : <CreditCard className="h-4 w-4 text-blue-400 shrink-0" />
                            }
                            <span className="text-body-sm font-medium text-foreground flex-1 truncate">
                              {payment.customer_name}
                            </span>
                            <span className={`text-body-sm font-bold tabular-nums ${isCash ? "text-emerald-400" : "text-blue-400"}`}>
                              {fmt(payment.amount)}
                            </span>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-caption text-muted-foreground">
                              <div className="flex justify-between">
                                <span>{t("cash.paymentType")}</span>
                                <Badge variant={isCash ? "success" : "default"} size="sm">
                                  {isCash ? t("payment.cash") : t("payment.check")}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span>{t("cash.paymentTime")}</span>
                                <span className="text-foreground">{fmtTime(payment.created_at)}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Separator />

                {/* Confirm / Flag section */}
                {(() => {
                  const status = getRepStatus(selectedRep);
                  const showForm = status === "pending" || editing;

                  return (
                    <div className="space-y-3">
                      {/* Confirmed display */}
                      {status === "confirmed" && !editing && selectedRep.confirmation && (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                          <div className="space-y-0.5">
                            <p className="text-body-sm font-semibold text-foreground">{fmt(selectedRep.confirmation.handed_over_amount)}</p>
                            <p className="text-caption text-muted-foreground">
                              {selectedRep.confirmation.confirmed_at
                                ? new Date(selectedRep.confirmation.confirmed_at).toLocaleString(isAr ? "ar-SA" : "en-US")
                                : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                            <Pencil className="h-3.5 w-3.5 me-1" />
                            {t("cash.undoConfirm")}
                          </Button>
                        </div>
                      )}

                      {/* Flagged display */}
                      {status === "flagged" && !editing && selectedRep.confirmation && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Flag className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                <p className="text-body-sm font-semibold text-foreground">{fmt(selectedRep.confirmation.handed_over_amount)}</p>
                              </div>
                              {selectedRep.confirmation.flag_notes && (
                                <p className="text-caption text-muted-foreground truncate">{selectedRep.confirmation.flag_notes}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="shrink-0 ms-2">
                              <Pencil className="h-3.5 w-3.5 me-1" />
                              {t("cash.undoConfirm")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Form */}
                      {showForm && !showFlagForm && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-caption text-muted-foreground font-medium">{t("cash.handedOver")}</label>
                            <Input
                              type="number"
                              value={handedOverInput}
                              onChange={(e) => setHandedOverInput(e.target.value)}
                              className="tabular-nums"
                            />
                          </div>

                          {getDiscrepancy(selectedRep).hasDiscrepancy && (
                            <div className="flex items-center gap-1.5 text-yellow-400 text-caption">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{t("cash.discrepancy", { pct: (getDiscrepancy(selectedRep).pct * 100).toFixed(1) })}</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" onClick={handleConfirm} isLoading={confirmMutation.isPending} disabled={confirmMutation.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                              {t("cash.confirm")}
                            </Button>
                            <Button variant="destructive" size="sm" className="flex-1" onClick={() => setShowFlagForm(true)} disabled={confirmMutation.isPending}>
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
                            <label className="text-caption text-muted-foreground font-medium">{t("cash.flagNotes")}</label>
                            <textarea
                              value={flagNotes}
                              onChange={(e) => setFlagNotes(e.target.value)}
                              rows={3}
                              placeholder={t("cash.flagNotesRequired")}
                              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="destructive" size="sm" className="flex-1" onClick={handleFlag} isLoading={flagMutation.isPending} disabled={flagMutation.isPending || !flagNotes.trim()}>
                              <Flag className="h-3.5 w-3.5 me-1.5" />
                              {t("cash.flag")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowFlagForm(false)} disabled={flagMutation.isPending}>
                              {t("actions.cancel")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
