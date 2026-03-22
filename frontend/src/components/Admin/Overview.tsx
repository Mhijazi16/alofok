import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingDown,
  Users,
  AlertCircle,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";

import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { BarChart } from "@/components/ui/bar-chart";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { adminApi } from "@/services/adminApi";
import type { SalesStatsOut, DebtStatsOut, SalesRepStats, DailyBreakdownOut } from "@/services/adminApi";
import { toLocalDateStr } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

function getWeekRange() {
  const now = new Date();
  const s = new Date(now);
  s.setDate(s.getDate() - 6);
  return { start: toLocalDateStr(s), end: toLocalDateStr(now) };
}

/* ── Consistent metric card ── */
function MetricCard({ icon: Icon, value, label, sub, onClick }: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 ${onClick ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-primary mb-3" />
      <p className="text-h4 font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-caption text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-caption text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export function Overview({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const weekRange = useMemo(() => getWeekRange(), []);

  const { data: salesStats, isLoading: salesLoading } = useQuery<SalesStatsOut>({
    queryKey: ["admin-sales-stats", weekRange.start, weekRange.end],
    queryFn: () => adminApi.getSalesStats(weekRange.start, weekRange.end),
  });
  const { data: debtStats, isLoading: debtLoading } = useQuery<DebtStatsOut>({
    queryKey: ["admin-debt-stats"],
    queryFn: () => adminApi.getDebtStats(),
  });
  const { data: dailyBreakdown, isLoading: chartLoading } = useQuery<DailyBreakdownOut>({
    queryKey: ["admin-daily-breakdown"],
    queryFn: () => adminApi.getDailyBreakdown(7),
  });

  const isLoading = salesLoading || debtLoading;

  const activeReps = useMemo(() =>
    (salesStats?.reps ?? []).filter((r: SalesRepStats) => r.order_count > 0 || r.collection_count > 0),
    [salesStats]);

  const topReps = useMemo(() =>
    [...(salesStats?.reps ?? [])].sort((a, b) => b.total_collected - a.total_collected).slice(0, 3),
    [salesStats]);

  const revenue = salesStats?.grand_total_orders ?? 0;
  const collected = salesStats?.grand_total_collected ?? 0;
  const collectionRate = revenue > 0 ? Math.round((collected / revenue) * 100) : 0;
  const overdueCount = debtStats?.overdue_checks?.length ?? 0;
  const totalOrders = salesStats?.reps?.reduce((s, r) => s + r.order_count, 0) ?? 0;

  const chartData = useMemo(() => {
    if (!dailyBreakdown?.days) return [];
    return dailyBreakdown.days.map((d) => ({
      day: new Date(d.date + "T00:00:00").toLocaleDateString(isAr ? "ar-SA" : "en-US", { weekday: "short", day: "numeric" }),
      orders: Math.round(d.total_orders),
      collections: Math.round(d.total_collected),
    }));
  }, [dailyBreakdown, isAr]);

  const maxCityDebt = useMemo(() =>
    Math.max(...(debtStats?.by_city ?? []).map(c => c.total_debt), 1),
    [debtStats]);

  const todayStr = new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isLoading) {
    return (
      <>
        <TopBar title={t("admin.title")} />
        <PageContainer>
          <div className="space-y-4">
            <Skeleton variant="card" className="h-48" />
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} variant="card" className="h-24" />)}
            </div>
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <TopBar title={t("admin.title")} />
      <PageContainer>
        <div className="space-y-5" dir={isAr ? "rtl" : "ltr"}>

          {/* ── Hero: Revenue & Collections ── */}
          <div className="relative overflow-hidden rounded-2xl">
            {/* Dark mode gradient — deep red tones matching primary #dc2626 */}
            <div className="absolute inset-0 hidden dark:block" style={{
              background: "linear-gradient(135deg, #0a0a0a 0%, #1a0808 35%, #2a0c0c 70%, #3b1010 100%)",
            }} />
            {/* Light mode gradient — deep blue tones matching primary #3b82f6 */}
            <div className="absolute inset-0 dark:hidden" style={{
              background: "linear-gradient(135deg, #0c1929 0%, #122448 35%, #183060 70%, #1e3a75 100%)",
            }} />

            <div className="relative p-5 space-y-5">
              <p className="text-caption text-white/40">{todayStr}</p>

              {/* Revenue / Collections side by side */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400/80" />
                    <span className="text-[0.65rem] uppercase tracking-wider text-white/40">
                      {t("admin.totalRevenue")}
                    </span>
                  </div>
                  <p className="text-h1 font-bold text-white tabular-nums leading-none">
                    {formatCurrency(revenue)}
                  </p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex-1 text-end">
                  <div className="flex items-center justify-end gap-1.5 mb-1">
                    <ArrowDownRight className="h-3 w-3 text-white/30" />
                    <span className="text-[0.65rem] uppercase tracking-wider text-white/40">
                      {t("admin.totalCollected")}
                    </span>
                  </div>
                  <p className="text-h1 font-bold text-white tabular-nums leading-none">
                    {formatCurrency(collected)}
                  </p>
                </div>
              </div>

              {/* Collection rate */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[0.65rem] uppercase tracking-wider text-white/40">
                    {t("admin.collectionRate")}
                  </span>
                  <span className="text-body-sm font-semibold text-white tabular-nums">
                    {collectionRate}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(collectionRate, 100)}%`,
                      background: collectionRate >= 70 ? "#34d399" : collectionRate >= 40 ? "#fbbf24" : "#f87171",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Metrics Grid ── */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={TrendingDown}
              value={formatCurrency(debtStats?.total_debt ?? 0)}
              label={t("admin.totalDebt")}
              onClick={() => onNavigate?.("debt")}
            />
            <MetricCard
              icon={Users}
              value={activeReps.length}
              label={t("admin.activeCustomers")}
              onClick={() => onNavigate?.("customers")}
            />
            <MetricCard
              icon={AlertCircle}
              value={overdueCount}
              label={t("admin.overdueChecks")}
              onClick={() => onNavigate?.("checks")}
            />
            <MetricCard
              icon={Banknote}
              value={totalOrders}
              label={t("admin.orderCount")}
              onClick={() => onNavigate?.("sales")}
            />
          </div>

          {/* ── Rep Performance ── */}
          {topReps.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-body-sm font-semibold text-foreground mb-4">
                {t("admin.repPerformance")}
              </h3>
              <div className="space-y-4">
                {topReps.map((rep, idx) => {
                  const pct = Math.round((rep.total_collected / (topReps[0]?.total_collected || 1)) * 100);
                  return (
                    <div key={rep.user_id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-body-sm text-foreground">{rep.username}</span>
                        <span className="text-body-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(rep.total_collected)}
                        </span>
                      </div>
                      <Progress value={pct} color={idx === 0 ? "success" : "primary"} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 7-day Chart ── */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-body-sm font-semibold text-foreground mb-3">
              {t("admin.performanceChart")}
            </h3>
            {chartLoading ? (
              <Skeleton variant="card" className="h-48" />
            ) : chartData.length > 0 ? (
              <BarChart
                data={chartData}
                xAxisKey="day"
                bars={[
                  { dataKey: "orders", label: t("admin.totalOrders"), color: "hsl(var(--primary))" },
                  { dataKey: "collections", label: t("admin.totalCollected"), color: "hsl(var(--muted-foreground))" },
                ]}
                height={200}
                showLegend
              />
            ) : (
              <EmptyState preset="no-data" title={t("admin.noData")} className="py-6" />
            )}
          </div>

          {/* ── Debt by City ── */}
          {debtStats?.by_city && debtStats.by_city.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-body-sm font-semibold text-foreground mb-4">
                {t("admin.debtByCity")}
              </h3>
              <div className="space-y-4">
                {debtStats.by_city.map((city) => {
                  const ratio = city.total_debt / maxCityDebt;
                  return (
                    <div key={city.city}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-body-sm text-foreground">{city.city}</span>
                          <Badge variant="secondary" size="sm">{city.customer_count}</Badge>
                        </div>
                        <span className="text-body-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(city.total_debt)}
                        </span>
                      </div>
                      <Progress
                        value={ratio * 100}
                        color={ratio > 0.75 ? "destructive" : ratio > 0.4 ? "warning" : "primary"}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </PageContainer>
    </>
  );
}
