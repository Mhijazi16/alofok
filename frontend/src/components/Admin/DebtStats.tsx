import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { adminApi } from "@/services/adminApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DebtStats() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-debt"],
    queryFn: adminApi.getDebtStats,
    staleTime: 2 * 60 * 1000,
  });

  const maxDebt = data
    ? Math.max(...data.by_city.map((c) => Number(c.total_debt)))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Total debt card */}
      {data && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-muted-foreground">{t("admin.totalDebt")}</p>
          <p className="mt-1 text-3xl font-black text-destructive">
            {Number(data.total_debt).toLocaleString("ar-SA")}
          </p>
        </div>
      )}

      {/* By-city section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          {t("admin.debtOverview")}
        </h3>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-16 w-full" />
          ))
        ) : !data?.by_city.length ? (
          <p className="text-center text-muted-foreground py-4">
            {t("admin.noData")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.by_city.map((city) => {
              const pct = maxDebt > 0 ? (Number(city.total_debt) / maxDebt) * 100 : 0;
              return (
                <div
                  key={city.city}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{city.city}</span>
                    <span className="text-xs text-muted-foreground">
                      {city.customer_count} عميل
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-destructive/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-destructive shrink-0">
                      {Number(city.total_debt).toLocaleString("ar-SA")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overdue checks */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {t("admin.overdueChecks")}
          {data?.overdue_checks.length ? (
            <Badge variant="danger">{data.overdue_checks.length}</Badge>
          ) : null}
        </h3>

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-16 w-full" />
          ))
        ) : !data?.overdue_checks.length ? (
          <p className="rounded-2xl bg-muted/50 py-4 text-center text-sm text-muted-foreground">
            لا توجد شيكات متأخرة ✓
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.overdue_checks.map((chk) => (
              <div
                key={chk.transaction_id}
                className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">
                    {chk.customer_name}
                  </span>
                  <span className="font-bold text-destructive">
                    {Number(chk.amount).toLocaleString("ar-SA")} {chk.currency}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {chk.bank && <span>{chk.bank}</span>}
                  {chk.due_date && <span>استحقاق: {chk.due_date}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
