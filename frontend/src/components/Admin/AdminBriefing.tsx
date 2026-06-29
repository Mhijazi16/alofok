import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, ShoppingBag, Receipt, ChevronDown } from "@/lib/icons";
import { adminApi } from "@/services/adminApi";
import { useAppSelector } from "@/store";
import { StepWizard, type WizardStep } from "@/components/ui/step-wizard";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toLocalDateStr, cn } from "@/lib/utils";

const money = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Admin morning briefing: a once-per-day wizard summarizing *yesterday* —
 * how much was collected, who paid, orders placed, and expenses. Each step
 * shows a clean headline figure and can be tapped to expand inline detail.
 */
export function AdminBriefing() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const userId = useAppSelector((s) => s.auth.userId) ?? "anon";

  const now = useMemo(() => new Date(), []);
  const todayStr = toLocalDateStr(now);
  const yesterday = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }, [now]);
  const yesterdayStr = toLocalDateStr(yesterday);

  // Shown at most once per calendar day (keyed on today, summarizing yesterday).
  const seenKey = `alofok-admin-briefing-${userId}-${todayStr}`;
  const alreadySeen = useMemo(
    () => localStorage.getItem(seenKey) === "1",
    [seenKey]
  );

  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  // Open at most once per mount — see RouteBriefing for the reopen-loop reasoning.
  const handled = useRef(false);

  // Which step's detail panel is expanded, and which customer row within it.
  const [detail, setDetail] = useState<Record<string, boolean>>({});
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const toggleDetail = (k: string) =>
    setDetail((s) => ({ ...s, [k]: !s[k] }));

  const { data: summary } = useQuery({
    queryKey: ["admin-day-summary", yesterdayStr],
    queryFn: () => adminApi.getDaySummary(yesterdayStr),
    enabled: !alreadySeen,
  });

  // Yesterday's full order list — fetched lazily only when the admin expands
  // the Orders step, so the headline summary stays light.
  const { data: dayOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-orders-day", yesterdayStr],
    queryFn: () =>
      adminApi.getOrders({ start_date: yesterdayStr, end_date: yesterdayStr }),
    enabled: open && !!detail["orders"],
  });

  const payments = summary?.payments ?? [];

  const byCustomer = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const p of payments) {
      const e = m.get(p.customer_name) ?? {
        name: p.customer_name,
        total: 0,
        count: 0,
      };
      e.total += Number(p.amount);
      e.count += 1;
      m.set(p.customer_name, e);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [payments]);

  // Cash vs check split + per-rep totals — the "more detail" for Collected.
  const split = useMemo(() => {
    let cash = 0,
      check = 0,
      cashN = 0,
      checkN = 0;
    for (const p of payments) {
      if (p.method === "cash") {
        cash += Number(p.amount);
        cashN += 1;
      } else {
        check += Number(p.amount);
        checkN += 1;
      }
    }
    return { cash, check, cashN, checkN };
  }, [payments]);

  const byRep = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) {
      const name = p.rep_name ?? "—";
      m.set(name, (m.get(name) ?? 0) + Number(p.amount));
    }
    return Array.from(m.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [payments]);

  const collected = Number(summary?.collected_total ?? 0);
  const ordersTotal = Number(summary?.orders_total ?? 0);
  const ordersCount = summary?.orders_count ?? 0;
  const expensesTotal = Number(summary?.expenses_total ?? 0);
  const net = Number(summary?.net ?? 0);
  const hasActivity = collected > 0 || ordersCount > 0 || expensesTotal > 0;

  // Open once the summary resolves — but only if yesterday had any activity.
  useEffect(() => {
    if (alreadySeen || handled.current) return;
    if (summary === undefined) return;
    handled.current = true;
    if (!hasActivity) {
      localStorage.setItem(seenKey, "1"); // quiet day — nothing to brief
      return;
    }
    setOpen(true);
  }, [alreadySeen, summary, hasActivity, seenKey]);

  const close = () => {
    setOpen(false);
    setDone(false);
    localStorage.setItem(seenKey, "1");
  };

  const dateLabel = yesterday.toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const catLabel = (cat: string) =>
    t(`adminBriefing.expenseCat.${cat}`, { defaultValue: cat });

  const bigStat = (icon: ReactNode, value: ReactNode, label: string) => (
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

  // A tappable headline that expands inline detail with a smooth height/opacity
  // animation. The chevron flips to signal expanded state.
  const expandable = (
    stepKey: string,
    head: ReactNode,
    body: ReactNode
  ): ReactNode => {
    const isOpen = !!detail[stepKey];
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleDetail(stepKey)}
          className="w-full rounded-2xl transition active:scale-[0.99]"
        >
          {head}
          <div className="mt-1 flex items-center justify-center gap-1 text-caption font-medium text-primary/70">
            {isOpen
              ? t("adminBriefing.lessDetails")
              : t("adminBriefing.moreDetails")}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">{body}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const detailRow = (label: ReactNode, amount: number, sub?: string) => (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">
        {label}
        {sub && (
          <span className="text-caption text-muted-foreground"> · {sub}</span>
        )}
      </span>
      <span className="shrink-0 text-body-sm font-bold text-foreground" dir="ltr">
        ₪ {money(amount)}
      </span>
    </div>
  );

  const steps: WizardStep[] = [
    {
      key: "hello",
      title: t("adminBriefing.greeting"),
      hint: `${t("adminBriefing.yesterdaySummary")} · ${dateLabel}`,
      canAdvance: true,
      content: expandable(
        "collected",
        bigStat(
          <Wallet className="h-7 w-7" />,
          <>₪ {money(collected)}</>,
          t("adminBriefing.collectedLabel")
        ),
        <>
          {detailRow(
            t("adminBriefing.cash"),
            split.cash,
            t("adminBriefing.paymentsCount", { count: split.cashN })
          )}
          {detailRow(
            t("adminBriefing.check"),
            split.check,
            t("adminBriefing.paymentsCount", { count: split.checkN })
          )}
          {byRep.length > 1 && (
            <>
              <p className="px-1 pt-1 text-caption font-semibold text-muted-foreground">
                {t("adminBriefing.byRep")}
              </p>
              {byRep.map((r) => detailRow(r.name, r.total))}
            </>
          )}
        </>
      ),
    },
    {
      key: "who",
      title: t("adminBriefing.whoTitle"),
      hint: t("adminBriefing.whoHint"),
      canAdvance: true,
      content:
        byCustomer.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-muted-foreground">
            {t("adminBriefing.noPayments")}
          </p>
        ) : (
          <div className="space-y-2">
            {byCustomer.map((c) => {
              const rows = payments.filter((p) => p.customer_name === c.name);
              const isOpen = openCustomer === c.name;
              return (
                <div
                  key={c.name}
                  className="overflow-hidden rounded-xl border border-border bg-background-subtle"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCustomer(isOpen ? null : c.name)
                    }
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition active:bg-muted/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-body-sm font-bold text-primary">
                      {c.count}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground">
                      {c.name}
                    </span>
                    <span
                      className="shrink-0 text-body-sm font-bold text-primary"
                      dir="ltr"
                    >
                      ₪ {money(c.total)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="rows"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 px-3 pb-2.5">
                          {rows.map((p, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 ps-12 text-caption"
                            >
                              <Badge
                                variant={
                                  p.method === "cash" ? "success" : "secondary"
                                }
                                size="sm"
                              >
                                {p.method === "cash"
                                  ? t("adminBriefing.cash")
                                  : t("adminBriefing.check")}
                              </Badge>
                              <span className="flex-1 truncate text-muted-foreground">
                                {p.rep_name}
                              </span>
                              <span
                                className="font-semibold text-foreground"
                                dir="ltr"
                              >
                                ₪ {money(Number(p.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ),
    },
    {
      key: "orders",
      title: t("adminBriefing.ordersTitle"),
      canAdvance: true,
      content: expandable(
        "orders",
        <div className="space-y-3">
          {bigStat(
            <ShoppingBag className="h-7 w-7" />,
            ordersCount,
            t("adminBriefing.ordersLabel")
          )}
          <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
            <span className="text-body-sm text-muted-foreground">
              {t("adminBriefing.ordersValue")}
            </span>
            <span className="text-body font-bold text-foreground" dir="ltr">
              ₪ {money(ordersTotal)}
            </span>
          </div>
        </div>,
        ordersLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (dayOrders ?? []).length === 0 ? (
          <p className="py-3 text-center text-body-sm text-muted-foreground">
            {t("orders.empty")}
          </p>
        ) : (
          (dayOrders ?? []).map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-background-subtle px-3 py-2.5"
            >
              <Badge
                variant={o.delivered_date ? "success" : "warning"}
                size="sm"
              >
                {o.delivered_date
                  ? t("orders.delivered")
                  : t("orders.pending")}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground">
                {o.customer_name}
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">
                {t("orders.itemsCount", { count: o.items.length })}
              </span>
              <span
                className="shrink-0 text-body-sm font-bold text-foreground"
                dir="ltr"
              >
                ₪ {money(Number(o.amount))}
              </span>
            </div>
          ))
        )
      ),
    },
    {
      key: "expenses",
      title: t("adminBriefing.expensesTitle"),
      hint: t("adminBriefing.expensesHint"),
      canAdvance: true,
      content: (
        <div className="space-y-3">
          {bigStat(
            <Receipt className="h-7 w-7" />,
            <>₪ {money(expensesTotal)}</>,
            t("adminBriefing.expensesLabel")
          )}
          {(summary?.expenses_by_category ?? []).length > 0 && (
            <div className="space-y-2">
              {(summary?.expenses_by_category ?? []).map((e) =>
                detailRow(
                  catLabel(e.category),
                  Number(e.amount),
                  t("adminBriefing.paymentsCount", { count: e.count })
                )
              )}
            </div>
          )}
          {/* Net: collected − spent */}
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
            <span className="text-body-sm font-semibold text-foreground">
              {t("adminBriefing.netLabel")}
            </span>
            <Badge variant={net >= 0 ? "success" : "warning"} size="lg">
              <span dir="ltr">₪ {money(net)}</span>
            </Badge>
          </div>
        </div>
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
      successMessage={t("adminBriefing.successTitle")}
      successHint={t("adminBriefing.successHint")}
      labels={{
        next: t("adminBriefing.next"),
        back: t("adminBriefing.back"),
        complete: t("adminBriefing.start"),
        done: t("adminBriefing.done"),
        close: t("adminBriefing.close"),
        stepCounter: (current, total) =>
          t("adminBriefing.step", { current, total }),
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
