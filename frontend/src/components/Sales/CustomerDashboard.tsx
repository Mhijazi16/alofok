import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Banknote,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Action = "order" | "pay" | "statement" | "returnedCheck";

interface CustomerDashboardProps {
  customer: Customer;
  onAction: (action: Action) => void;
  onBack: () => void;
}

function RiskBadge({ score }: { score: string }) {
  const { t } = useTranslation();
  if (score === "green")
    return <Badge variant="success">{t("actions.confirm")}</Badge>;
  if (score === "yellow")
    return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="danger">{score}</Badge>;
}

export default function CustomerDashboard({
  customer,
  onAction,
  onBack,
}: CustomerDashboardProps) {
  const { t } = useTranslation();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["insights", customer.id],
    queryFn: () => salesApi.getInsights(customer.id),
    staleTime: 2 * 60 * 1000,
  });

  const actions: { key: Action; label: string; icon: React.ReactNode; color: string }[] = [
    {
      key: "order",
      label: t("actions.order"),
      icon: <ShoppingCart className="h-6 w-6" />,
      color: "bg-blue-50 text-blue-700",
    },
    {
      key: "pay",
      label: t("actions.pay"),
      icon: <Banknote className="h-6 w-6" />,
      color: "bg-green-50 text-green-700",
    },
    {
      key: "statement",
      label: t("actions.statement"),
      icon: <FileText className="h-6 w-6" />,
      color: "bg-purple-50 text-purple-700",
    },
    {
      key: "returnedCheck",
      label: t("actions.returnedCheck"),
      icon: <AlertCircle className="h-6 w-6" />,
      color: "bg-red-50 text-red-700",
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold">{customer.name}</h2>
          <p className="text-sm text-muted-foreground">{customer.city}</p>
        </div>
      </div>

      {/* Insights grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : insights ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("customer.totalDebt")}
            </p>
            <p className="mt-1 text-xl font-bold text-destructive">
              {Number(insights.total_debt).toLocaleString("ar-SA")}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("customer.lastCollection")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {insights.last_payment_date
                ? new Date(insights.last_payment_date).toLocaleDateString("ar-SA")
                : "—"}
            </p>
            {insights.last_payment_amount && (
              <p className="text-xs text-muted-foreground">
                {Number(insights.last_payment_amount).toLocaleString("ar-SA")}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("customer.collectionFrequency")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {insights.avg_payment_interval_days != null
                ? `${Math.round(insights.avg_payment_interval_days)} ${t("customer.daysAverage")}`
                : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-2">
              {t("customer.balance")}
            </p>
            <RiskBadge score={insights.risk_score} />
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ key, label, icon, color }) => (
          <button
            key={key}
            onClick={() => onAction(key)}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-5 font-semibold transition-transform active:scale-95 ${color}`}
          >
            {icon}
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
