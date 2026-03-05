import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  DollarSign,
  Calendar,
  Clock,
  Shield,
  ShoppingCart,
  Banknote,
  FileText,
  RotateCcw,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { CheckDetailDialog } from "@/components/ui/check-detail-dialog";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

type CustomerAction = "order" | "payment" | "statement" | "check";

interface CustomerDashboardProps {
  customer: Customer;
  onBack: () => void;
  onAction: (action: CustomerAction) => void;
  onEditCustomer?: (customer: Customer) => void;
}

export function CustomerDashboard({
  customer,
  onBack,
  onAction,
  onEditCustomer,
}: CustomerDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [returnedCheckIdx, setReturnedCheckIdx] = useState(0);
  const [returnedCheckDialogOpen, setReturnedCheckDialogOpen] = useState(false);

  const { data: returnedChecks } = useQuery({
    queryKey: ["returned-checks", customer.id],
    queryFn: () => salesApi.getReturnedChecks(customer.id),
    enabled: (customer.returned_checks_count ?? 0) > 0,
  });

  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["drafts", customer.id],
    queryFn: () => salesApi.getDraftOrders(customer.id),
  });

  const confirmMutation = useMutation({
    mutationFn: salesApi.confirmDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
      toast({ title: t("portal.draftConfirmedSuccess"), variant: "success" });
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: salesApi.rejectDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts", customer.id] });
      toast({ title: t("portal.draftRejectedSuccess"), variant: "success" });
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["insights", customer.id],
    queryFn: () => salesApi.getInsights(customer.id),
  });

  const { data: recentStatement, isLoading: statementLoading } = useQuery({
    queryKey: ["statement", customer.id, "recent"],
    queryFn: () => salesApi.getStatement(customer.id, { since_zero_balance: true }),
  });

  const recentEntries = recentStatement?.entries.slice(-3).reverse() ?? [];

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const riskStatusVariant = (risk: string | undefined) => {
    switch (risk) {
      case "green":
        return "online" as const;
      case "yellow":
        return "pending" as const;
      case "red":
        return "offline" as const;
      default:
        return "neutral" as const;
    }
  };

  const riskLabel = (risk: string | undefined) => {
    switch (risk) {
      case "green":
        return t("customer.riskLow");
      case "yellow":
        return t("customer.riskMedium");
      case "red":
        return t("customer.riskHigh");
      default:
        return "-";
    }
  };

  const txTypeVariant = (type: string) => {
    if (type === "Order") return "warning" as const;
    if (type.startsWith("Payment")) return "success" as const;
    if (type === "Check_Return") return "destructive" as const;
    return "default" as const;
  };

  const txBadgeVariant = (type: string) => {
    if (type === "Order") return "warning" as const;
    if (type.startsWith("Payment")) return "success" as const;
    if (type === "Check_Return") return "destructive" as const;
    return "default" as const;
  };

  const actionCards: {
    key: CustomerAction;
    icon: typeof ShoppingCart;
    label: string;
    accent: string;
    iconBg: string;
  }[] = [
    {
      key: "order",
      icon: ShoppingCart,
      label: t("actions.order"),
      accent: "hover:border-info/50",
      iconBg: "bg-info/15 text-info",
    },
    {
      key: "payment",
      icon: Banknote,
      label: t("actions.pay"),
      accent: "hover:border-success/50",
      iconBg: "bg-success/15 text-success",
    },
    {
      key: "statement",
      icon: FileText,
      label: t("actions.statement"),
      accent: "hover:border-violet-500/50",
      iconBg: "bg-violet-500/15 text-violet-400",
    },
    {
      key: "check",
      icon: RotateCcw,
      label: t("actions.returnedCheck"),
      accent: "hover:border-destructive/50",
      iconBg: "bg-destructive/15 text-destructive",
    },
  ];

  return (
    <div className="animate-fade-in">
      <TopBar
        title={customer.name}
        subtitle={customer.city}
        backButton={{ onBack }}
        actions={
          onEditCustomer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCustomer(customer)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )
        }
      />

      <div className="space-y-5 p-4">
        {(customer.returned_checks_count ?? 0) > 0 && (
          <Card
            variant="glass"
            className="border-warning/30 bg-warning/5 cursor-pointer animate-slide-up"
            onClick={() => {
              setReturnedCheckIdx(0);
              setReturnedCheckDialogOpen(true);
            }}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-warning">
                  {t("checkDetail.returnedWarning", {
                    count: customer.returned_checks_count,
                  })}
                </p>
                <p className="text-caption text-muted-foreground">
                  {t("checkDetail.viewCheck")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insight Stats — horizontal cards */}
        {insightsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total Debt */}
            <div
              className="group relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm overflow-hidden animate-slide-up transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              style={{ animationDelay: "0ms" }}
            >
              <div className="absolute inset-y-0 start-0 w-1 rounded-s-2xl bg-primary" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-muted-foreground">{t("customer.balance")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(Number(insights?.total_debt ?? customer.balance))}
                </p>
              </div>
              <Badge variant={Number(insights?.total_debt ?? customer.balance) > 0 ? "danger" : "success"} size="sm">
                {Number(insights?.total_debt ?? customer.balance) > 0 ? t("customer.riskHigh") : t("customer.riskLow")}
              </Badge>
            </div>

            {/* Last Collection */}
            <div
              className="group relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm overflow-hidden animate-slide-up transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              style={{ animationDelay: "60ms" }}
            >
              <div className="absolute inset-y-0 start-0 w-1 rounded-s-2xl bg-primary/60" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-muted-foreground">{t("customer.lastCollection")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {insights?.last_payment_amount ? formatCurrency(insights.last_payment_amount) : "-"}
                </p>
              </div>
              {insights?.last_payment_date && (
                <span className="text-caption text-muted-foreground shrink-0">
                  {formatDate(insights.last_payment_date)}
                </span>
              )}
            </div>

            {/* Collection Frequency */}
            <div
              className="group relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm overflow-hidden animate-slide-up transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              style={{ animationDelay: "120ms" }}
            >
              <div className="absolute inset-y-0 start-0 w-1 rounded-s-2xl bg-primary/40" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-muted-foreground">{t("customer.collectionFrequency")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {insights?.avg_payment_interval_days ? `${insights.avg_payment_interval_days}` : "-"}
                </p>
              </div>
              {insights?.avg_payment_interval_days && (
                <span className="text-caption text-muted-foreground shrink-0">
                  {t("customer.daysAverage")}
                </span>
              )}
            </div>

            {/* Risk Score */}
            <div
              className={cn(
                "group relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm overflow-hidden animate-slide-up transition-all hover:shadow-lg",
                insights?.risk_score === "red" ? "hover:border-destructive/40 hover:shadow-destructive/5" : insights?.risk_score === "yellow" ? "hover:border-warning/40 hover:shadow-warning/5" : "hover:border-success/40 hover:shadow-success/5"
              )}
              style={{ animationDelay: "180ms" }}
            >
              <div className={cn(
                "absolute inset-y-0 start-0 w-1 rounded-s-2xl",
                insights?.risk_score === "red" ? "bg-destructive" : insights?.risk_score === "yellow" ? "bg-warning" : "bg-success"
              )} />
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                insights?.risk_score === "red" ? "bg-destructive/15 text-destructive" : insights?.risk_score === "yellow" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
              )}>
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-muted-foreground">{t("customer.riskScore")}</p>
                <p className="text-lg font-bold text-foreground">
                  {riskLabel(insights?.risk_score)}
                </p>
              </div>
              <StatusIndicator
                variant={riskStatusVariant(insights?.risk_score)}
                label={riskLabel(insights?.risk_score)}
                size="sm"
              />
            </div>
          </div>
        )}

        {/* Action Cards 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {actionCards.map((ac, idx) => {
            const Icon = ac.icon;
            return (
              <Card
                key={ac.key}
                variant="interactive"
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-5 animate-scale-in",
                  ac.accent
                )}
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => onAction(ac.key)}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    ac.iconBg
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-body-sm font-medium text-foreground">
                  {ac.label}
                </span>
              </Card>
            );
          })}
        </div>

        {/* Pending Drafts */}
        {draftsLoading ? (
          <Skeleton variant="card" className="h-20" />
        ) : drafts && drafts.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-h4 font-semibold text-foreground">
              {t("portal.pendingDrafts")}
              <Badge variant="warning" size="sm" className="ms-2">
                {drafts.length}
              </Badge>
            </h3>
            {drafts.map((draft, idx) => (
              <Card
                key={draft.id}
                variant="glass"
                className="animate-slide-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm">
                        {t("portal.draftPending")}
                      </Badge>
                      <span className="text-caption text-muted-foreground">
                        {new Date(draft.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-body-sm font-bold text-foreground mt-1">
                      {Math.abs(draft.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {draft.currency}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 border-success/50 text-success hover:bg-success/10"
                      onClick={() => confirmMutation.mutate(draft.id)}
                      disabled={confirmMutation.isPending || rejectMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => rejectMutation.mutate(draft.id)}
                      disabled={confirmMutation.isPending || rejectMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Recent Activity */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h4 font-semibold text-foreground">
              {t("customer.recentActivity")}
            </h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => onAction("statement")}
              className="text-primary"
            >
              {t("actions.viewAll")}
            </Button>
          </div>

          <Separator />

          {statementLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="text" className="h-12" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-body-sm text-muted-foreground text-center py-6">
              {t("statement.noTransactions")}
            </p>
          ) : (
            <Timeline>
              {recentEntries.map((entry, idx) => {
                const tx = entry.transaction;
                return (
                  <TimelineItem
                    key={tx.id}
                    variant={txTypeVariant(tx.type)}
                    title={formatCurrency(Math.abs(tx.amount))}
                    timestamp={formatDate(tx.created_at)}
                    isLast={idx === recentEntries.length - 1}
                  >
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={txBadgeVariant(tx.type)} size="sm">
                        {t(`statement.transactionTypes.${tx.type}`, tx.type)}
                      </Badge>
                      <span className="text-caption text-muted-foreground">
                        {tx.amount >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(tx.amount))} {tx.currency}
                      </span>
                    </div>
                  </TimelineItem>
                );
              })}
            </Timeline>
          )}
        </div>
      </div>

      {returnedChecks && returnedChecks.length > 0 && (
        <CheckDetailDialog
          check={returnedChecks[returnedCheckIdx] ?? null}
          open={returnedCheckDialogOpen}
          onOpenChange={setReturnedCheckDialogOpen}
          navigation={
            returnedChecks.length > 1
              ? {
                  current: returnedCheckIdx + 1,
                  total: returnedChecks.length,
                  onPrev:
                    returnedCheckIdx > 0
                      ? () => setReturnedCheckIdx((i) => i - 1)
                      : undefined,
                  onNext:
                    returnedCheckIdx < returnedChecks.length - 1
                      ? () => setReturnedCheckIdx((i) => i + 1)
                      : undefined,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
