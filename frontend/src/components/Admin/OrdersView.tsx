import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  ShoppingBag,
  User,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "@/lib/icons";
import { adminApi, type AdminOrder } from "@/services/adminApi";
import { getImageUrl } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";
import { TopBar } from "@/components/ui/top-bar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FadeIn } from "@/components/ui/fade-in";

type Period = "today" | "7d" | "30d" | "all";
type Delivery = "all" | "pending" | "delivered";

function startDateFor(period: Period): string | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  if (period === "7d") d.setDate(d.getDate() - 6);
  else if (period === "30d") d.setDate(d.getDate() - 29);
  return toLocalDateStr(d);
}

// An order counts as "new" (worth flagging to the admin) if it landed within
// the last 12 hours — long enough to survive a refresh, short enough to mean
// "just came in".
const NEW_WINDOW_MS = 12 * 60 * 60 * 1000;

const selectClass =
  "h-10 flex-1 rounded-lg border border-input bg-background px-3 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function OrdersView() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const [period, setPeriod] = useState<Period>("7d");
  const [repId, setRepId] = useState<string>("");
  const [delivery, setDelivery] = useState<Delivery>("all");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const { data: reps } = useQuery({
    queryKey: ["sales-reps"],
    queryFn: adminApi.getSalesReps,
  });

  const startDate = startDateFor(period);
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders", period, repId],
    queryFn: () =>
      adminApi.getOrders({
        ...(startDate ? { start_date: startDate } : {}),
        ...(repId ? { rep_id: repId } : {}),
      }),
    // Keep the visible list in sync with the notification poll so an order the
    // admin was just toasted about actually appears without changing a filter.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  // Backend returns newest-first; apply the delivery filter client-side so the
  // admin can isolate orders that still need delivering without a round-trip.
  const visible = useMemo(() => {
    const list = orders ?? [];
    if (delivery === "delivered") return list.filter((o) => !!o.delivered_date);
    if (delivery === "pending") return list.filter((o) => !o.delivered_date);
    return list;
  }, [orders, delivery]);

  const totalSum = useMemo(
    () => visible.reduce((s, o) => s + Number(o.amount), 0),
    [visible]
  );
  const pendingCount = useMemo(
    () => (orders ?? []).filter((o) => !o.delivered_date).length,
    [orders]
  );

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(isRTL ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });

  // Recency at a glance: "just now / 5m / 3h / Yesterday / Jun 12".
  const relativeTime = (iso: string): string => {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return t("orders.justNow");
    if (min < 60) return t("orders.minutesAgo", { count: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t("orders.hoursAgo", { count: hr });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((startOfToday.getTime() - then) / 86_400_000);
    if (daysAgo < 1) return t("orders.yesterday");
    return fmtDate(iso);
  };

  const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < NEW_WINDOW_MS;

  return (
    <FadeIn animation="fade">
      <TopBar
        title={t("orders.title")}
        subtitle={
          orders
            ? pendingCount > 0
              ? t("orders.countWithPending", {
                  count: orders.length,
                  pending: pendingCount,
                })
              : t("orders.count", { count: orders.length })
            : undefined
        }
      />

      <div className="space-y-4 p-4">
        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className={selectClass}
          >
            <option value="today">{t("orders.today")}</option>
            <option value="7d">{t("orders.last7")}</option>
            <option value="30d">{t("orders.last30")}</option>
            <option value="all">{t("orders.all")}</option>
          </select>
          <select
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            className={selectClass}
          >
            <option value="">{t("orders.allReps")}</option>
            {reps?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.username}
              </option>
            ))}
          </select>
        </div>

        {/* Delivery status filter */}
        <div className="flex gap-2">
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as Delivery)}
            className={selectClass}
          >
            <option value="all">{t("orders.allStatuses")}</option>
            <option value="pending">{t("orders.statusPending")}</option>
            <option value="delivered">{t("orders.statusDelivered")}</option>
          </select>
        </div>

        {/* Total value summary */}
        <Card className="flex items-center justify-between p-4">
          <span className="text-body-sm text-muted-foreground">
            {t("orders.totalValue")}
          </span>
          <span className="text-h4 font-bold text-primary" dir="ltr">
            ₪ {formatCurrency(totalSum)}
          </span>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={t("orders.empty")}
            className="py-12"
          />
        ) : (
          <div className="space-y-2">
            {visible.map((o) => {
              const delivered = !!o.delivered_date;
              return (
                <Card
                  key={o.id}
                  variant="interactive"
                  className="p-4"
                  onClick={() => setSelected(o)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-body-sm font-semibold text-foreground truncate">
                          {o.customer_name}
                        </p>
                        {isNew(o.created_at) && (
                          <Badge variant="default" size="sm" className="shrink-0">
                            {t("orders.new")}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {/* Delivery status — the clearest signal on the card */}
                        <Badge
                          variant={delivered ? "success" : "warning"}
                          size="sm"
                        >
                          {delivered ? (
                            <CheckCircle className="h-2.5 w-2.5 me-0.5" />
                          ) : (
                            <Clock className="h-2.5 w-2.5 me-0.5" />
                          )}
                          {delivered
                            ? t("orders.delivered")
                            : t("orders.pending")}
                        </Badge>
                        {o.rep_name && (
                          <Badge variant="outline" size="sm">
                            <User className="h-2.5 w-2.5 me-0.5" />
                            {o.rep_name}
                          </Badge>
                        )}
                        <span className="text-caption text-muted-foreground">
                          · {t("orders.itemsCount", { count: o.items.length })}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className="text-body-sm font-bold text-foreground"
                        dir="ltr"
                      >
                        ₪ {formatCurrency(Number(o.amount))}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {relativeTime(o.created_at)}
                      </span>
                    </div>
                    <ChevronIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Order detail — products + total */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
            <DialogDescription>
              {selected?.rep_name ? `${selected.rep_name} · ` : ""}
              {selected ? fmtDateTime(selected.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Delivery status banner */}
          {selected &&
            (selected.delivered_date ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-success">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="text-body-sm font-semibold">
                  {t("orders.deliveredOn", {
                    date: fmtDateTime(selected.delivered_date),
                  })}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-warning">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="text-body-sm font-semibold">
                  {selected.delivery_date
                    ? t("orders.scheduledFor", {
                        date: fmtDate(selected.delivery_date),
                      })
                    : t("orders.notDeliveredYet")}
                </span>
              </div>
            ))}

          <div className="-mx-2 flex-1 overflow-y-auto px-2">
            <div className="space-y-2 py-1">
              {(selected?.items ?? []).map((item, idx) => (
                <Card key={idx} variant="glass" className="p-3">
                  <div className="flex gap-3">
                    {getImageUrl(item.image_url) ? (
                      <img
                        src={getImageUrl(item.image_url)!}
                        alt={item.name ?? ""}
                        className="h-16 w-16 rounded-xl bg-muted object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-foreground truncate">
                        {item.name}
                      </p>
                      {item.selected_options && item.selected_options.length > 0 && (
                        <p className="text-caption text-muted-foreground truncate">
                          {item.selected_options
                            .map((o) => `${o.name}: ${o.value}`)
                            .join(" | ")}
                        </p>
                      )}
                      <p className="text-caption text-muted-foreground" dir="ltr">
                        {item.quantity} × ₪ {formatCurrency(Number(item.unit_price))}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-body-sm font-semibold text-foreground" dir="ltr">
                        ₪ {formatCurrency(item.quantity * Number(item.unit_price))}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            {selected?.discount && (
              <>
                <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                  <span>{t("cart.subtotal")}</span>
                  <span dir="ltr">
                    ₪ {formatCurrency(Number(selected.subtotal ?? 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-body-sm text-success">
                  <span>
                    {t("cart.discount")}
                    {selected.discount.type === "percent"
                      ? ` (${selected.discount.value}%)`
                      : ""}
                  </span>
                  <span dir="ltr">
                    − ₪ {formatCurrency(Number(selected.discount.amount))}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{t("order.total")}</p>
              <p className="text-h4 font-bold text-primary" dir="ltr">
                ₪ {formatCurrency(Number(selected?.amount ?? 0))}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}
