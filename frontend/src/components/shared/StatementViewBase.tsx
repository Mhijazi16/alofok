import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileText, FileDown } from "@/lib/icons";
import { type DateRange } from "react-day-picker";
import type { StatementPdfProps } from "@/components/shared/StatementPdf";
import { toLocalDateStr } from "@/lib/utils";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { CheckPhotoThumbnail } from "@/components/ui/check-photo-thumbnail";
import { DatePicker } from "@/components/ui/date-picker";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FilterPreset = "zero" | "week" | "month" | "year" | "custom";

export interface StatementViewBaseProps {
  /** Customer name for PDF export */
  customerName: string;
  /** Fallback closing balance when no statement data */
  balance: number;
  /** Function to fetch statement data given filter params */
  fetchStatement: (params: {
    since_zero_balance?: boolean;
    start_date?: string;
    end_date?: string;
  }) => Promise<any>;
  /** React Query key prefix, e.g. ["statement", customerId] */
  queryKeyPrefix: string[];
  /** TopBar subtitle (Sales passes customer name, Customer omits) */
  subtitle?: string;
  /** Back button handler (Sales passes onBack, Customer omits) */
  onBack?: () => void;
  /** Show is_draft badge on transactions (Customer portal only) */
  showDraftBadge?: boolean;
}

export function StatementViewBase({
  customerName,
  balance,
  fetchStatement,
  queryKeyPrefix,
  subtitle,
  onBack,
  showDraftBadge = false,
}: StatementViewBaseProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<FilterPreset>("month");
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
    queryKey: [
      ...queryKeyPrefix,
      preset,
      customRange?.from?.toISOString(),
      customRange?.to?.toISOString(),
    ],
    queryFn: () => fetchStatement(queryParams),
  });

  const entries = statement?.entries ?? [];
  const closingBalance = statement?.closing_balance ?? balance;

  const openingBalance = useMemo(() => {
    if (entries.length === 0) return closingBalance;
    const first = entries[0];
    return first.running_balance - first.transaction.amount;
  }, [entries, closingBalance]);

  const pdfProps = useMemo((): StatementPdfProps | null => {
    if (!statement || entries.length === 0) return null;
    const totals = entries.reduce(
      (acc: { orders: number; payments: number; purchases: number }, e: any) => {
        const type = e.transaction.type;
        if (type === "Order") acc.orders += Math.abs(e.transaction.amount);
        else if (type.startsWith("Payment"))
          acc.payments += Math.abs(e.transaction.amount);
        else if (type === "Purchase")
          acc.purchases += Math.abs(e.transaction.amount);
        return acc;
      },
      { orders: 0, payments: 0, purchases: 0 }
    );
    const fromDate = entries[0].transaction.created_at.split("T")[0];
    const toDate =
      entries[entries.length - 1].transaction.created_at.split("T")[0];
    return {
      customerName,
      dateRange: {
        from:
          preset === "custom" && customRange?.from
            ? toLocalDateStr(customRange.from)
            : fromDate,
        to:
          preset === "custom" && customRange?.to
            ? toLocalDateStr(customRange.to)
            : toDate,
      },
      openingBalance,
      entries: entries as StatementPdfProps["entries"],
      closingBalance,
      totals,
    };
  }, [
    statement,
    entries,
    openingBalance,
    closingBalance,
    customerName,
    preset,
    customRange,
  ]);

  const toGrayscaleDataUrl = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Darken: push dark tones much darker for high-contrast B&W
          const darkened = Math.pow(gray / 255, 2.2) * 255;
          d[i] = d[i + 1] = d[i + 2] = darkened;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });

  const handleDownload = async () => {
    if (!pdfProps) return;
    setGenerating(true);
    try {
      const logoDataUrl = await toGrayscaleDataUrl("/dark-mode-logo.png").catch(() => undefined);
      const { pdf } = await import("@react-pdf/renderer");
      const { StatementPdf } = await import(
        "@/components/shared/StatementPdf"
      );
      const blob = await pdf(<StatementPdf {...pdfProps} logoDataUrl={logoDataUrl} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `كشف_${customerName || "customer"}_${pdfProps.dateRange.from}_${pdfProps.dateRange.to}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

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
        subtitle={subtitle}
        backButton={onBack ? { onBack } : undefined}
        actions={
          entries.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={generating}
              className="h-8 w-8 rounded-full"
              title={t("statement.downloadPdf")}
            >
              {generating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </Button>
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
            <TabsTrigger value="zero">
              {t("statement.sinceZero")}
            </TabsTrigger>
            <TabsTrigger value="week">
              {t("statement.lastWeek")}
            </TabsTrigger>
            <TabsTrigger value="month">
              {t("statement.lastMonth")}
            </TabsTrigger>
            <TabsTrigger value="year">
              {t("statement.lastYear")}
            </TabsTrigger>
            <TabsTrigger value="custom">
              {t("statement.customRange")}
            </TabsTrigger>
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
        {!isLoading && (
          <StatCard
            variant="glass"
            value={formatCurrency(openingBalance)}
            label={t("statement.openingBalance")}
            icon={FileText}
            className="animate-slide-up"
          />
        )}

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
            {entries.map((entry: any, idx: number) => {
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
                            tx.status === "Pending"
                              ? "warning"
                              : tx.status === "Deposited"
                                ? "success"
                                : tx.status === "Returned"
                                  ? "destructive"
                                  : "outline"
                          }
                          size="sm"
                        >
                          {t(`checks.status.${tx.status}`, tx.status)}
                        </Badge>
                      )}
                      {tx.type === "Payment_Check" && (
                        <CheckPhotoThumbnail
                          imageUrl={
                            typeof tx.data?.image_url === "string"
                              ? tx.data.image_url
                              : null
                          }
                        />
                      )}
                      {showDraftBadge && tx.is_draft && (
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
