import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Banknote } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart } from "@/components/ui/bar-chart";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { adminApi } from "@/services/adminApi";
import type { SalesStatsOut, SalesRepStats } from "@/services/adminApi";

type Period = "week" | "month" | "year";

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const startDate = new Date(now);

  switch (period) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case "year":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const start = startDate.toISOString().split("T")[0];
  return { start, end };
}

export function SalesStats() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("week");
  const dateRange = useMemo(() => getDateRange(period), [period]);

  const { data, isLoading } = useQuery<SalesStatsOut>({
    queryKey: ["admin-sales-stats", dateRange.start, dateRange.end],
    queryFn: () => adminApi.getSalesStats(dateRange.start, dateRange.end),
  });

  // Max values for progress bar normalization
  const maxOrders = useMemo(() => {
    if (!data?.reps?.length) return 1;
    return Math.max(...data.reps.map((r: SalesRepStats) => r.total_orders), 1);
  }, [data]);

  const maxCollected = useMemo(() => {
    if (!data?.reps?.length) return 1;
    return Math.max(...data.reps.map((r: SalesRepStats) => r.total_collected), 1);
  }, [data]);

  // Chart data: reps comparison
  const chartData = useMemo(() => {
    if (!data?.reps) return [];
    return data.reps.map((rep: SalesRepStats) => ({
      name: rep.username,
      orders: rep.total_orders,
      collections: rep.total_collected,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="card" className="h-12" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton variant="card" className="h-28" />
            <Skeleton variant="card" className="h-28" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-36" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Title */}
        <h1 className="text-h2 font-bold text-foreground">
          {t("admin.salesStats")}
        </h1>

        {/* Period tabs */}
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
        >
          <TabsList variant="segment">
            <TabsTrigger value="week">{t("admin.period.week")}</TabsTrigger>
            <TabsTrigger value="month">{t("admin.period.month")}</TabsTrigger>
            <TabsTrigger value="year">{t("admin.period.year")}</TabsTrigger>
          </TabsList>

          {/* Single content block — tabs only change the query period */}
          <TabsContent value={period}>
            <div className="space-y-6">
              {/* Grand totals */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  variant="glass"
                  icon={ShoppingCart}
                  value={data?.grand_total_orders.toLocaleString() ?? "0"}
                  label={t("admin.totalOrders")}
                />
                <StatCard
                  variant="glass"
                  icon={Banknote}
                  value={data?.grand_total_collected.toLocaleString() ?? "0"}
                  label={t("admin.totalCollected")}
                />
              </div>

              {/* Rep comparison chart */}
              {chartData.length > 0 && (
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>{t("admin.repPerformance")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart
                      data={chartData}
                      xAxisKey="name"
                      bars={[
                        {
                          dataKey: "orders",
                          label: t("admin.totalOrders"),
                          color: "hsl(0 72% 51%)",
                        },
                        {
                          dataKey: "collections",
                          label: t("admin.totalCollected"),
                          color: "hsl(0 0% 95%)",
                        },
                      ]}
                      height={260}
                      showLegend
                    />
                  </CardContent>
                </Card>
              )}

              {/* Per-rep cards */}
              {data?.reps?.length ? (
                <div className="space-y-3">
                  {data.reps.map((rep: SalesRepStats) => {
                    const collectionRate =
                      rep.total_orders > 0
                        ? Math.round(
                            (rep.total_collected / rep.total_orders) * 100
                          )
                        : 0;

                    return (
                      <Card key={rep.user_id} variant="glass">
                        <CardContent className="p-4 space-y-4">
                          {/* Rep header */}
                          <div className="flex items-center gap-3">
                            <Avatar name={rep.username} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-semibold text-foreground truncate">
                                {rep.username}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge
                                  variant={
                                    collectionRate >= 75
                                      ? "success"
                                      : collectionRate >= 40
                                        ? "warning"
                                        : "destructive"
                                  }
                                  size="sm"
                                >
                                  {t("admin.collectionRate")} {collectionRate}%
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Progress bars */}
                          <div className="space-y-3">
                            <Progress
                              value={(rep.total_orders / maxOrders) * 100}
                              label={`${t("admin.totalOrders")} — ${rep.total_orders.toLocaleString()}`}
                              color="primary"
                              showPercentage={false}
                            />
                            <Progress
                              value={
                                (rep.total_collected / maxCollected) * 100
                              }
                              label={`${t("admin.totalCollected")} — ${rep.total_collected.toLocaleString()}`}
                              color="success"
                              showPercentage={false}
                            />
                          </div>

                          {/* Counts row */}
                          <div className="flex items-center justify-between text-caption text-muted-foreground border-t border-border pt-3">
                            <span>
                              {rep.order_count} {t("admin.orderCount")}
                            </span>
                            <span>
                              {rep.collection_count} {t("admin.collectionCount")}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  preset="no-data"
                  title={t("admin.noData")}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
