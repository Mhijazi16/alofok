import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileText, FileDown } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { pdf } from "@react-pdf/renderer";
import { StatementPdf, type StatementPdfProps } from "@/components/shared/StatementPdf";
import { salesApi, type Customer } from "@/services/salesApi";
import { toLocalDateStr } from "@/lib/utils";
import { CheckPhotoThumbnail } from "@/components/ui/check-photo-thumbnail";
import { DatePicker } from "@/components/ui/date-picker";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FilterPreset = "zero" | "week" | "month" | "year" | "custom";

interface StatementViewProps {
  customer: Customer;
  onBack: () => void;
}

export function StatementView({ customer, onBack }: StatementViewProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<FilterPreset>("zero");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [generating, setGenerating] = useState(false);

  const queryParams = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "zero":
        return { since_zero_balance: true };
      case "week": {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { start_date: toLocalDateStr(d) };
      }
      case "month": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return { start_date: toLocalDateStr(d) };
      }
      case "year": {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        return { start_date: toLocalDateStr(d) };
      }
      case "custom": {
        if (customRange?.from && customRange?.to) {
          return {
            start_date: toLocalDateStr(customRange.from),
            end_date: toLocalDateStr(customRange.to),
          };
        }
        return { since_zero_balance: true };
      }
    }
  }, [preset, customRange]);

  const { data: statement, isLoading } = useQuery({
    queryKey: ["statement", customer.id, preset, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: () => salesApi.getStatement(customer.id, queryParams),
  });

  const entries = statement?.entries ?? [];
  const closingBalance = statement?.closing_balance ?? customer.balance;

  const openingBalance = useMemo(() => {
    if (entries.length === 0) return closingBalance;
    const first = entries[0];
    return first.running_balance - first.transaction.amount;
  }, [entries, closingBalance]);

  const pdfProps = useMemo((): StatementPdfProps | null => {
    if (!statement || entries.length === 0) return null;
    const totals = entries.reduce(
      (acc, e) => {
        const type = e.transaction.type;
        if (type === "Order") acc.orders += Math.abs(e.transaction.amount);
        else if (type.startsWith("Payment")) acc.payments += Math.abs(e.transaction.amount);
        else if (type === "Purchase") acc.purchases += Math.abs(e.transaction.amount);
        return acc;
      },
      { orders: 0, payments: 0, purchases: 0 }
    );
    const fromDate = entries[0].transaction.created_at.split("T")[0];
    const toDate = entries[entries.length - 1].transaction.created_at.split("T")[0];
    return {
      customerName: customer.name,
      dateRange: {
        from: preset === "custom" && customRange?.from ? toLocalDateStr(customRange.from) : fromDate,
        to: preset === "custom" && customRange?.to ? toLocalDateStr(customRange.to) : toDate,
      },
      openingBalance,
      entries: entries as StatementPdfProps["entries"],
      closingBalance,
      totals,
    };
  }, [statement, entries, openingBalance, closingBalance, customer, preset, customRange]);

  const handleDownload = async () => {
    if (!pdfProps) return;
    setGenerating(true);
    try {
      const blob = await pdf(<StatementPdf {...pdfProps} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `\u0643\u0634\u0641_${customer.name}_${pdfProps.dateRange.from}_${pdfProps.dateRange.to}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed, using print fallback:", err);
      const { handlePrintFallback } = await import("@/components/shared/StatementPrintView");
      handlePrintFallback(pdfProps);
    } finally {
      setGenerating(false);
    }
  };

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
    if (type === "Purchase") return "info" as const;
    return "default" as const;
  };

  const txBadgeVariant = (type: string) => {
    if (type === "Order") return "warning" as const;
    if (type.startsWith("Payment")) return "success" as const;
    if (type === "Check_Return") return "destructive" as const;
    if (type === "Purchase") return "info" as const;
    return "default" as const;
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("statement.title")}
        subtitle={customer.name}
        backButton={{ onBack }}
        actions={
          entries.length > 0 ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-50"
              title={t("statement.downloadPdf")}
            >
              {generating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4">
        {/* Preset Filters */}
        <Tabs
          value={preset}
          onValueChange={(v) => setPreset(v as FilterPreset)}
        >
          <TabsList variant="pills" className="w-full flex-wrap gap-1.5">
            <TabsTrigger value="zero">{t("statement.sinceZero")}</TabsTrigger>
            <TabsTrigger value="week">{t("statement.lastWeek")}</TabsTrigger>
            <TabsTrigger value="month">{t("statement.lastMonth")}</TabsTrigger>
            <TabsTrigger value="year">{t("statement.lastYear")}</TabsTrigger>
            <TabsTrigger value="custom">{t("statement.customRange")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Custom Date Range Picker */}
        {preset === "custom" && (
          <DatePicker
            mode="range"
            value={customRange}
            onChange={setCustomRange}
            placeholder={t("statement.selectDateRange")}
          />
        )}

        {/* Opening Balance */}
        <StatCard
          variant="glass"
          value={formatCurrency(openingBalance)}
          label={t("statement.openingBalance")}
          icon={FileText}
          className="animate-slide-up"
        />

        {/* Transactions Timeline */}
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
                      {tx.type === "Payment_Check" && (
                        <CheckPhotoThumbnail imageUrl={tx.data?.image_url} />
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
