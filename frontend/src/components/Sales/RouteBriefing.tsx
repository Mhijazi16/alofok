import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Users, ShoppingBag, Wallet } from "@/lib/icons";
import { salesApi } from "@/services/salesApi";
import { useAppSelector } from "@/store";
import { StepWizard, type WizardStep } from "@/components/ui/step-wizard";
import { toLocalDateStr } from "@/lib/utils";

const DAY_CODES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const money = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Morning route briefing: a once-per-day wizard that slides a Sales rep through
 * a quick summary of today's route — how many stops, how many orders to deliver
 * (and their value), who is expecting them, and how much there is to collect.
 */
export function RouteBriefing() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const userId = useAppSelector((s) => s.auth.userId) ?? "anon";

  const today = useMemo(() => new Date(), []);
  const todayStr = toLocalDateStr(today);
  const dayCode = DAY_CODES[today.getDay()];
  const seenKey = `alofok-route-briefing-${userId}-${todayStr}`;
  const alreadySeen = useMemo(
    () => localStorage.getItem(seenKey) === "1",
    [seenKey]
  );

  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  // Open at most once per mount. Without this, closing sets `open=false`, the
  // open-effect re-runs, sees the memoized `alreadySeen=false`, and reopens —
  // so the X / Done button appears to do nothing.
  const handled = useRef(false);

  // Reuse RouteView's exact query keys so this shares the cache (no double-fetch).
  const { data: customers } = useQuery({
    queryKey: ["route-day", dayCode, todayStr],
    queryFn: () => salesApi.getRouteByDay(dayCode, todayStr),
    enabled: !alreadySeen,
  });
  const { data: orders } = useQuery({
    queryKey: ["delivery-orders", todayStr, dayCode],
    queryFn: () => salesApi.getDeliveryOrders(todayStr, dayCode),
    enabled: !alreadySeen,
  });

  const routeCount = customers?.length ?? 0;
  const orderList = orders ?? [];
  const orderCount = orderList.length;
  const orderTotal = useMemo(
    () => orderList.reduce((s, o) => s + Number(o.amount), 0),
    [orderList]
  );
  const toCollect = useMemo(
    () =>
      (customers ?? []).reduce(
        (s, c) => s + Math.max(0, Number(c.balance)),
        0
      ),
    [customers]
  );
  const byCustomer = useMemo(() => {
    const m = new Map<string, { name: string; count: number; total: number }>();
    for (const o of orderList) {
      const e = m.get(o.customer_id) ?? {
        name: o.customer_name,
        count: 0,
        total: 0,
      };
      e.count += 1;
      e.total += Number(o.amount);
      m.set(o.customer_id, e);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [orderList]);

  // Open once both queries have resolved — but only if there's a route today.
  useEffect(() => {
    if (alreadySeen || handled.current) return;
    if (customers === undefined || orders === undefined) return;
    handled.current = true;
    if (routeCount === 0 && orderCount === 0) {
      localStorage.setItem(seenKey, "1"); // rest day — nothing to brief, don't nag
      return;
    }
    setOpen(true);
  }, [alreadySeen, customers, orders, routeCount, orderCount, seenKey]);

  const close = () => {
    setOpen(false);
    setDone(false);
    localStorage.setItem(seenKey, "1");
  };

  const dateLabel = `${t(`customer.days.${dayCode}`)} · ${today.toLocaleDateString(
    isRTL ? "ar-EG" : "en-US",
    { day: "numeric", month: "long" }
  )}`;

  const bigStat = (
    icon: ReactNode,
    value: ReactNode,
    label: string
  ) => (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="text-5xl font-extrabold text-primary" dir="ltr">
        {value}
      </div>
      <div className="text-body-sm text-muted-foreground">{label}</div>
    </div>
  );

  const steps: WizardStep[] = [
    {
      key: "hello",
      title: t("briefing.greeting"),
      hint: dateLabel,
      canAdvance: true,
      content: bigStat(
        <Users className="h-7 w-7" />,
        routeCount,
        t("briefing.customersToday")
      ),
    },
    {
      key: "orders",
      title: t("briefing.ordersTitle"),
      canAdvance: true,
      content: (
        <div className="space-y-3">
          {bigStat(
            <ShoppingBag className="h-7 w-7" />,
            orderCount,
            t("briefing.ordersToDeliver")
          )}
          <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
            <span className="text-body-sm text-muted-foreground">
              {t("briefing.ordersValue")}
            </span>
            <span className="text-body font-bold text-foreground" dir="ltr">
              ₪ {money(orderTotal)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "who",
      title: t("briefing.whoTitle"),
      hint: t("briefing.whoHint"),
      canAdvance: true,
      content:
        byCustomer.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-muted-foreground">
            {t("briefing.noOrders")}
          </p>
        ) : (
          <div className="space-y-2">
            {byCustomer.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 rounded-xl border border-border bg-background-subtle px-3 py-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-body-sm font-bold text-primary">
                  {c.count}
                </div>
                <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground">
                  {c.name}
                </span>
                <span className="shrink-0 text-body-sm font-bold text-primary" dir="ltr">
                  ₪ {money(c.total)}
                </span>
              </div>
            ))}
          </div>
        ),
    },
    {
      key: "collect",
      title: t("briefing.collectTitle"),
      hint: t("briefing.collectHint"),
      canAdvance: true,
      content: bigStat(
        <Wallet className="h-7 w-7" />,
        <>₪ {money(toCollect)}</>,
        t("briefing.toCollect")
      ),
    },
  ];

  return (
    <StepWizard
      open={open}
      onClose={close}
      done={done}
      onComplete={() => setDone(true)}
      steps={steps}
      dir={isRTL ? "rtl" : "ltr"}
      width={380}
      successMessage={t("briefing.successTitle")}
      successHint={t("briefing.successHint")}
      labels={{
        next: t("briefing.next"),
        back: t("briefing.back"),
        complete: t("briefing.start"),
        done: t("briefing.letsGo"),
        close: t("briefing.close"),
        stepCounter: (current, total) =>
          t("briefing.step", { current, total }),
      }}
      theme={{
        paper: "hsl(var(--card))",
        ink: "hsl(var(--foreground))",
        muted: "hsl(var(--muted-foreground))",
        rule: "hsl(var(--border))",
        soft: "hsl(var(--secondary))",
        accent: "hsl(var(--primary))",
        onAccent: "hsl(var(--primary-foreground))",
      }}
    />
  );
}
