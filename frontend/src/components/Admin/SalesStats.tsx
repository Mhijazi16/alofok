import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type SalesRepStats } from "@/services/adminApi";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "week" | "month" | "year";

function periodDates(p: Period): { start: string; end: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  const end = iso(today);
  const start = new Date(today);
  if (p === "week") start.setDate(start.getDate() - 7);
  else if (p === "month") start.setMonth(start.getMonth() - 1);
  else start.setFullYear(start.getFullYear() - 1);
  return { start: iso(start), end };
}

function RepBar({ rep, max }: { rep: SalesRepStats; max: number }) {
  const orderPct = max > 0 ? (Number(rep.total_orders) / max) * 100 : 0;
  const collectPct = max > 0 ? (Number(rep.total_collected) / max) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{rep.username}</span>
        <span className="text-xs text-muted-foreground">
          {rep.order_count} طلب · {rep.collection_count} تحصيل
        </span>
      </div>

      {/* Orders bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>طلبات</span>
          <span className="font-medium text-foreground">
            {Number(rep.total_orders).toLocaleString("ar-SA")}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${orderPct}%` }}
          />
        </div>
      </div>

      {/* Collections bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>تحصيل</span>
          <span className="font-medium text-green-600">
            {Number(rep.total_collected).toLocaleString("ar-SA")}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${collectPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SalesStats() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("month");
  const dates = periodDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sales", period],
    queryFn: () => adminApi.getSalesStats(dates.start, dates.end),
    staleTime: 2 * 60 * 1000,
  });

  const maxVal = data
    ? Math.max(...data.reps.map((r) => Math.max(Number(r.total_orders), Number(r.total_collected))))
    : 0;

  const periods: Period[] = ["week", "month", "year"];

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground"
            }`}
          >
            {t(`admin.period.${p}`)}
          </button>
        ))}
      </div>

      {/* Totals */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("admin.totalOrders")}</p>
            <p className="mt-1 text-xl font-bold text-primary">
              {Number(data.grand_total_orders).toLocaleString("ar-SA")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("admin.totalCollected")}</p>
            <p className="mt-1 text-xl font-bold text-green-600">
              {Number(data.grand_total_collected).toLocaleString("ar-SA")}
            </p>
          </div>
        </div>
      )}

      {/* Per-rep bars */}
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))
      ) : !data?.reps.length ? (
        <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>
      ) : (
        data.reps.map((rep) => (
          <RepBar key={rep.user_id} rep={rep} max={maxVal} />
        ))
      )}
    </div>
  );
}
