import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Calendar,
  Clock,
  Shield,
  ShoppingCart,
  Banknote,
  FileText,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
  const { t, i18n } = useTranslation();

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
    Math.abs(val).toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(
      i18n.language === "ar" ? "ar-SA" : "en-US",
      { month: "short", day: "numeric" }
    );
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
        {/* Insight Stats 2x2 */}
        {insightsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              variant="glass"
              value={formatCurrency(insights?.total_debt ?? customer.balance)}
              label={t("customer.totalDebt")}
              icon={DollarSign}
              className="animate-slide-up"
              style={{ animationDelay: "0ms" }}
            />
            <StatCard
              variant="glass"
              value={
                insights?.last_payment_amount
                  ? formatCurrency(insights.last_payment_amount)
                  : "-"
              }
              label={t("customer.lastCollection")}
              icon={Calendar}
              footer={
                insights?.last_payment_date ? (
                  <span className="text-caption text-muted-foreground">
                    {formatDate(insights.last_payment_date)}
                  </span>
                ) : undefined
              }
              className="animate-slide-up"
              style={{ animationDelay: "60ms" }}
            />
            <StatCard
              variant="glass"
              value={
                insights?.avg_payment_interval_days
                  ? `${insights.avg_payment_interval_days}`
                  : "-"
              }
              label={t("customer.collectionFrequency")}
              icon={Clock}
              footer={
                insights?.avg_payment_interval_days ? (
                  <span className="text-caption text-muted-foreground">
                    {t("customer.daysAverage")}
                  </span>
                ) : undefined
              }
              className="animate-slide-up"
              style={{ animationDelay: "120ms" }}
            />
            <StatCard
              variant="glass"
              value={riskLabel(insights?.risk_score)}
              label={t("customer.riskScore")}
              icon={Shield}
              footer={
                <StatusIndicator
                  variant={riskStatusVariant(insights?.risk_score)}
                  label={riskLabel(insights?.risk_score)}
                  size="sm"
                />
              }
              className="animate-slide-up"
              style={{ animationDelay: "180ms" }}
            />
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
    </div>
  );
}
