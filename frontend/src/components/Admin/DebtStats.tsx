import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Landmark, AlertTriangle } from "@/lib/icons";

import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { FadeIn } from "@/components/ui/fade-in";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart } from "@/components/ui/bar-chart";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { adminApi } from "@/services/adminApi";
import type { DebtStatsOut, OverdueCheck, CityDebt } from "@/services/adminApi";

function daysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(diff, 0);
}

export function DebtStats({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<DebtStatsOut>({
    queryKey: ["admin-debt-stats"],
    queryFn: () => adminApi.getDebtStats(),
  });

  const maxCityDebt = useMemo(() => {
    if (!data?.by_city?.length) return 1;
    return Math.max(...data.by_city.map((c: CityDebt) => c.total_debt), 1);
  }, [data]);

  // Chart data for city debts
  const cityChartData = useMemo(() => {
    if (!data?.by_city) return [];
    return data.by_city.map((c: CityDebt) => ({
      city: c.city,
      debt: c.total_debt,
      customers: c.customer_count,
    }));
  }, [data]);

  // Flag severely overdue (> 90 days)
  const hasSeverelyOverdue = useMemo(() => {
    if (!data?.overdue_checks) return false;
    return data.overdue_checks.some(
      (c: OverdueCheck) => daysOverdue(c.due_date) > 90
    );
  }, [data]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-72" />
          <Skeleton variant="card" className="h-64" />
        </div>
      </PageContainer>
    );
  }

  return (
    <>
    <TopBar title={t("admin.debtOverview")} backButton={onBack ? { onBack } : undefined} />
    <PageContainer>
      <FadeIn animation="fade">
      <div className="space-y-6">
        {/* Total debt hero card */}
        <StatCard
          variant="gradient"
          icon={Landmark}
          value={data?.total_debt.toLocaleString() ?? "0"}
          label={t("admin.totalDebt")}
          className="text-center"
        />

        {/* Severely overdue alert */}
        {hasSeverelyOverdue && (
          <Alert
            variant="error"
            icon={AlertTriangle}
            title={t("admin.overdueChecks")}
            description={t("errors.generic")}
          />
        )}

        {/* Debt by city: chart + cards */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>{t("admin.debtByCity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {cityChartData.length > 0 ? (
              <div className="space-y-6">
                <BarChart
                  data={cityChartData}
                  xAxisKey="city"
                  bars={[
                    {
                      dataKey: "debt",
                      label: t("admin.totalDebt"),
                      color: "hsl(0 72% 51%)",
                    },
                  ]}
                  height={240}
                />

                {/* Per-city progress cards */}
                <div className="space-y-4 border-t border-border pt-4">
                  {data?.by_city.map((city: CityDebt) => {
                    const proportion = (city.total_debt / maxCityDebt) * 100;
                    return (
                      <div key={city.city} className="space-y-1.5">
                        <div className="flex items-center justify-between text-body-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {city.city}
                            </span>
                            <Badge variant="outline" size="sm">
                              {city.customer_count} {t("nav.customers")}
                            </Badge>
                          </div>
                          <span className="tabular-nums font-semibold text-foreground">
                            {city.total_debt.toLocaleString()}
                          </span>
                        </div>
                        <Progress
                          value={proportion}
                          color={
                            proportion > 75
                              ? "destructive"
                              : proportion > 40
                                ? "warning"
                                : "primary"
                          }
                          size="default"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                preset="no-data"
                title={t("admin.noData")}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Overdue checks table */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>{t("admin.overdueChecks")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.overdue_checks?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("nav.customers")}</TableHead>
                    <TableHead>{t("payment.amount")}</TableHead>
                    <TableHead>{t("payment.currency")}</TableHead>
                    <TableHead>{t("payment.bank")}</TableHead>
                    <TableHead>{t("payment.dueDate")}</TableHead>
                    <TableHead>{t("admin.daysOverdue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdue_checks.map((check: OverdueCheck) => {
                    const days = daysOverdue(check.due_date);
                    return (
                      <TableRow key={check.transaction_id}>
                        <TableCell className="font-medium">
                          {check.customer_name}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {check.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{check.currency}</TableCell>
                        <TableCell>{check.bank ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {check.due_date ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              days > 90
                                ? "danger"
                                : days > 30
                                  ? "warning"
                                  : "default"
                            }
                            size="sm"
                          >
                            {days} {t("admin.daysOverdue")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                preset="no-data"
                title={t("admin.noData")}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>
      </FadeIn>
    </PageContainer>
    </>
  );
}
