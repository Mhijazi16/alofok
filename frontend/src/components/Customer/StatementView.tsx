import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { customerApi } from "@/services/customerApi";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FilterPreset = "zero" | "week" | "month" | "year";

export function CustomerStatementView() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<FilterPreset>("zero");

  /* Profile is needed for the fallback balance only */
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: customerApi.getProfile,
    staleTime: 2 * 60 * 1000,
  });

  const queryParams = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "zero":
        return { since_zero_balance: true };
      case "week": {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { start_date: d.toISOString().split("T")[0] };
      }
      case "month": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return { start_date: d.toISOString().split("T")[0] };
      }
      case "year": {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        return { start_date: d.toISOString().split("T")[0] };
      }
    }
  }, [preset]);

  const { data: statement, isLoading } = useQuery({
    queryKey: ["customer-statement", preset],
    queryFn: () => customerApi.getStatement(queryParams),
    staleTime: 60 * 1000,
  });

  const entries = statement?.entries ?? [];
  const closingBalance = statement?.closing_balance ?? profile?.balance ?? 0;

  const openingBalance = useMemo(() => {
    if (entries.length === 0) return closingBalance;
    const first = entries[0];
    return first.running_balance - first.transaction.amount;
  }, [entries, closingBalance]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

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

  return (
    <div className="animate-fade-in">
      <TopBar title={t("statement.title")} />

      <div className="space-y-4 p-4">
        {/* Filter Presets */}
        <Tabs
          value={preset}
          onValueChange={(v) => setPreset(v as FilterPreset)}
        >
          <TabsList variant="pills" className="w-full flex-wrap gap-1.5">
            <TabsTrigger value="zero">{t("statement.sinceZero")}</TabsTrigger>
            <TabsTrigger value="week">{t("statement.lastWeek")}</TabsTrigger>
            <TabsTrigger value="month">{t("statement.lastMonth")}</TabsTrigger>
            <TabsTrigger value="year">{t("statement.lastYear")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Opening Balance */}
        {!isLoading && (
          <StatCard
            variant="glass"
            value={formatCurrency(openingBalance)}
            label={t("statement.openingBalance")}
            icon={FileText}
            className="animate-slide-up"
          />
        )}

        {/* Transactions */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-16" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            preset="no-data"
            title={t("statement.noTransactions")}
          />
        ) : (
          <Timeline>
            {entries.map((entry, idx) => {
              const tx = entry.transaction;
              const amountSign = tx.amount >= 0 ? "+" : "";

              return (
                <TimelineItem
                  key={tx.id}
                  variant={txTypeVariant(tx.type)}
                  title={`${amountSign}${formatCurrency(tx.amount)}`}
                  timestamp={formatDate(tx.created_at)}
                  isLast={idx === entries.length - 1}
                  className="animate-slide-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="mt-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={txBadgeVariant(tx.type)} size="sm">
                        {t(
                          `statement.transactionTypes.${tx.type}`,
                          tx.type
                        )}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {tx.currency}
                      </Badge>
                      {tx.type === "Payment_Check" && tx.status && (
                        <Badge
                          variant={
                            tx.status === "Pending" ? "warning"
                            : tx.status === "Deposited" ? "success"
                            : tx.status === "Returned" ? "destructive"
                            : "outline"
                          }
                          size="sm"
                        >
                          {t(`checks.status.${tx.status}`, tx.status)}
                        </Badge>
                      )}
                      {tx.is_draft && (
                        <Badge variant="warning" size="sm">
                          {t("portal.draft")}
                        </Badge>
                      )}
                      <span className="text-caption text-muted-foreground">
                        {formatTime(tx.created_at)}
                      </span>
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {t("statement.runningBalance")}:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(entry.running_balance)}
                      </span>
                    </p>
                    {tx.notes && (
                      <p className="text-caption text-muted-foreground italic">
                        {tx.notes}
                      </p>
                    )}
                  </div>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}

        {/* Closing Balance */}
        {!isLoading && entries.length > 0 && (
          <StatCard
            variant="gradient"
            value={formatCurrency(closingBalance)}
            label={t("statement.closingBalance")}
            icon={FileText}
            className="animate-slide-up"
          />
        )}
      </div>
    </div>
  );
}
