import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBag,
  Clock,
  Receipt,
} from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RouteViewProps {
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer?: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"] as const;

function getTodayCode(): string {
  const jsDay = new Date().getDay(); // 0=Sun … 6=Sat
  const map: Record<number, string> = {
    0: "Sun",
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
  };
  const code = map[jsDay];
  // If today is Friday (no route), default to Saturday
  return code === "Fri" ? "Sat" : code;
}

function formatTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export function RouteView({ onSelectCustomer, onAddCustomer }: RouteViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [selectedDay, setSelectedDay] = useState(getTodayCode);
  const [search, setSearch] = useState("");

  // Compute actual calendar date for the selected day tab (current week)
  const selectedDate = useMemo(() => {
    const today = new Date();
    const todayJsDay = today.getDay(); // 0=Sun
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Sat: 6 };
    const targetJsDay = dayMap[selectedDay] ?? todayJsDay;
    const diff = targetJsDay - todayJsDay;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  }, [selectedDay]);

  // Fetch customers for selected day
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["route-day", selectedDay],
    queryFn: () => salesApi.getRouteByDay(selectedDay),
  });

  // Fetch delivery orders for the selected date
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["route-orders", selectedDate],
    queryFn: () => salesApi.getRouteOrders(selectedDate),
  });

  // Fetch unassigned orders for the selected date
  const { data: unassignedOrders, isLoading: unassignedLoading } = useQuery({
    queryKey: ["unassigned-orders", selectedDate, selectedDay],
    queryFn: () => salesApi.getUnassignedOrders(selectedDate, selectedDay),
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalCustomers = customers?.length ?? 0;
  const totalDebt = useMemo(
    () => customers?.reduce((sum, c) => sum + c.balance, 0) ?? 0,
    [customers]
  );
  const estimatedCollections = useMemo(
    () =>
      customers
        ?.filter((c) => c.balance > 0)
        .reduce((sum, c) => sum + Math.min(c.balance * 0.3, c.balance), 0) ?? 0,
    [customers]
  );

  const todayLabel = new Date().toLocaleDateString(
    isRTL ? "ar-EG" : "en-US",
    { month: "long", day: "numeric" }
  );

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("customer.todayRoute")}
        subtitle={todayLabel}
      />

      <div className="space-y-4 p-4">
        {/* ── Day Switcher ── */}
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
          <Tabs value={selectedDay} onValueChange={setSelectedDay}>
            <TabsList variant="pills" className="w-full justify-between">
              {DAYS.map((day) => (
                <TabsTrigger
                  key={day}
                  value={day}
                  className="flex-1 min-w-0"
                >
                  <span className="relative">
                    {t(`customer.days.${day}`)}
                    {day === getTodayCode() && (
                      <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            variant="glass"
            value={customersLoading ? "..." : totalCustomers}
            label={t("customer.totalCustomers")}
            icon={Users}
          />
          <StatCard
            variant="glass"
            value={customersLoading ? "..." : formatCurrency(totalDebt)}
            label={t("customer.todayDebt")}
            icon={TrendingDown}
          />
          <StatCard
            variant="glass"
            value={customersLoading ? "..." : formatCurrency(estimatedCollections)}
            label={t("customer.todayCollections")}
            icon={Wallet}
          />
        </div>

        {/* ── Search ── */}
        <SearchInput
          placeholder={t("customer.searchCustomers")}
          onSearch={setSearch}
        />

        {/* ── Customers Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-body-sm font-semibold text-foreground">
              {t("nav.customers")}
            </h3>
            {!customersLoading && (
              <Badge variant="secondary" size="sm">
                {totalCustomers}
              </Badge>
            )}
          </div>

          {customersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="card" className="h-20" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            search.trim() ? (
              <EmptyState preset="no-results" />
            ) : (
              <EmptyState preset="empty-route" />
            )
          ) : (
            <div className="space-y-2">
              {filtered.map((customer, idx) => {
                const balanceVariant: "success" | "warning" | "danger" =
                  customer.balance <= 0
                    ? "success"
                    : customer.balance < 5000
                      ? "warning"
                      : "danger";

                return (
                  <Card
                    key={customer.id}
                    variant="interactive"
                    className="animate-slide-up p-4"
                    style={{ animationDelay: `${idx * 50}ms` }}
                    onClick={() => onSelectCustomer(customer)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-h4 font-semibold text-foreground truncate">
                          {customer.name}
                        </p>
                        <p className="text-caption text-muted-foreground truncate">
                          {customer.city}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={balanceVariant} dot>
                          {formatCurrency(customer.balance)}
                        </Badge>
                        <ChevronIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Creative Separator ── */}
        <>
            <div className="relative flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
              <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-4 py-1.5 shadow-sm backdrop-blur-sm">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("customer.todayOrders")}
                </span>
                {orders && orders.length > 0 && (
                  <Badge variant="default" size="sm">
                    {orders.length}
                  </Badge>
                )}
              </div>
              <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
            </div>

            {/* ── Orders Section ── */}
            <div>
              {ordersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} variant="card" className="h-16" />
                  ))}
                </div>
              ) : !orders || orders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-body-sm text-muted-foreground">
                    {t("customer.noOrdersToday")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order, idx) => {
                    const itemCount = order.data?.items
                      ? (order.data.items as unknown[]).length
                      : 0;

                    return (
                      <Card
                        key={order.id}
                        variant="glass"
                        className="animate-slide-up overflow-hidden p-0"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        {/* Accent stripe */}
                        <div className="flex">
                          <div className="w-1 shrink-0 bg-primary/60 rounded-s-xl" />
                          <div className="flex-1 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-body-sm font-semibold text-foreground truncate">
                                  {order.customer_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-caption text-muted-foreground">
                                    {formatTime(order.created_at, i18n.language)}
                                  </span>
                                  {itemCount > 0 && (
                                    <>
                                      <span className="text-caption text-muted-foreground">·</span>
                                      <span className="text-caption text-muted-foreground">
                                        {itemCount} {t("catalog.itemCount")}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Badge variant="success" className="font-mono tabular-nums">
                                {formatCurrency(order.amount)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Unassigned Customers Orders Section ── */}
            {(unassignedOrders?.length ?? 0) > 0 && (
              <>
                <div className="relative flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-4 py-1.5 shadow-sm backdrop-blur-sm">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                      {t("customer.unassignedOrders")}
                    </span>
                    {unassignedOrders && unassignedOrders.length > 0 && (
                      <Badge variant="default" size="sm">
                        {unassignedOrders.length}
                      </Badge>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
                </div>

                {unassignedLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} variant="card" className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unassignedOrders && unassignedOrders.map((order, idx) => {
                      const itemCount = order.data?.items
                        ? (order.data.items as unknown[]).length
                        : 0;

                      return (
                        <Card
                          key={order.id}
                          variant="glass"
                          className="animate-slide-up overflow-hidden p-0"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          {/* Accent stripe */}
                          <div className="flex">
                            <div className="w-1 shrink-0 bg-amber-500/60 rounded-s-xl" />
                            <div className="flex-1 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-body-sm font-semibold text-foreground truncate">
                                    {order.customer_name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-caption text-muted-foreground">
                                      {formatTime(order.created_at, i18n.language)}
                                    </span>
                                    {itemCount > 0 && (
                                      <>
                                        <span className="text-caption text-muted-foreground">·</span>
                                        <span className="text-caption text-muted-foreground">
                                          {itemCount} {t("catalog.itemCount")}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="warning" className="font-mono tabular-nums">
                                  {formatCurrency(order.amount)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
      </div>

      {/* FAB — Add Customer */}
      {onAddCustomer && (
        <button
          onClick={onAddCustomer}
          className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
