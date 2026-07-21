import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Clock,
  Receipt,
  Check,
  Undo2,
  Trash2,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  Hash,
  CalendarDays,
} from "@/lib/icons";
import { salesApi, type Customer, type OrderWithCustomer, type CollectionPayment } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";
import { toLocalDateStr } from "@/lib/utils";
import { ExpenseCard, REP_CATEGORIES } from "@/components/shared/ExpenseCard";
import { FadeIn } from "@/components/ui/fade-in";
import { OrderEditWizard } from "./OrderEditWizard";

interface RouteViewProps {
  onSelectCustomer: (customer: Customer) => void;
}

const DAY_CODES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getDayCode(date: Date): string {
  return DAY_CODES[date.getDay()];
}

function toDateStr(date: Date): string {
  return toLocalDateStr(date);
}

function generateDateRange(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  // 2 weeks back + 4 weeks forward
  for (let i = -14; i <= 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const TODAY_INDEX = 14; // index of today in the 43-day range

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

const CARDS_PER_PAGE = 6;
const SWIPE_THRESHOLD = 50;

/**
 * Delivery state of an order card. Undelivered orders used to be marked only
 * by the ABSENCE of the green "delivered" badge, which the rep kept missing —
 * so pending now gets its own amber badge with a pulsing dot.
 */
function DeliveryStatusBadge({ delivered }: { delivered: boolean }) {
  const { t } = useTranslation();
  if (delivered) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <Check className="h-3 w-3" />
        {t("order.delivered")}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
      </span>
      {t("order.notDelivered")}
    </Badge>
  );
}

/** Accent stripe colour for an order card — amber shouts "still pending". */
function deliveryStripe(delivered: boolean): string {
  return delivered ? "bg-emerald-500" : "bg-amber-500";
}

/**
 * Paginates the route's customer cards so reps don't endlessly scroll.
 * Swipe left/right (RTL-aware) to flip pages; a dots indicator shows position.
 */
function CustomerPager({
  customers,
  isRTL,
  onSelectCustomer,
  ChevronIcon,
}: {
  customers: Customer[];
  isRTL: boolean;
  onSelectCustomer: (customer: Customer) => void;
  ChevronIcon: typeof ChevronLeft;
}) {
  const { t } = useTranslation();
  // [pageIndex, slideDirection] — direction drives the enter/exit x offset.
  const [[page, dir], setPage] = useState<[number, number]>([0, 0]);
  const pageCount = Math.max(1, Math.ceil(customers.length / CARDS_PER_PAGE));

  // Clamp when the list shrinks (search typed, day switched).
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => {
    if (page !== safePage) setPage([safePage, 0]);
  }, [safePage, page]);

  const pageItems = customers.slice(
    safePage * CARDS_PER_PAGE,
    safePage * CARDS_PER_PAGE + CARDS_PER_PAGE
  );

  const paginate = useCallback(
    (delta: number) => {
      setPage(([p]) => {
        const next = Math.min(Math.max(p + delta, 0), pageCount - 1);
        return next === p ? [p, 0] : [next, delta];
      });
    },
    [pageCount]
  );

  // ── Swipe detection (mirrors swipeable-card.tsx) ──
  const startX = useRef(0);
  const startY = useRef(0);
  const swiped = useRef(false);

  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    swiped.current = false;
  }, []);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const dx = e.clientX - startX.current;
      const dy = Math.abs(e.clientY - startY.current);
      if (Math.abs(dx) <= SWIPE_THRESHOLD || dy > Math.abs(dx)) return;
      swiped.current = true; // suppress the click that follows a swipe
      // dx<0 = swipe left, dx>0 = swipe right; RTL inverts next/prev.
      const forward = isRTL ? dx > 0 : dx < 0;
      paginate(forward ? 1 : -1);
    },
    [isRTL, paginate]
  );

  // RTL flips the horizontal travel so "forward" moves the natural way.
  const rtlSign = isRTL ? -1 : 1;
  const enterX = (dir > 0 ? 60 : dir < 0 ? -60 : 0) * rtlSign;

  return (
    <div>
      <div
        className="overflow-hidden touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.stopPropagation(); // don't open a customer right after a swipe
            swiped.current = false;
          }
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={safePage}
            initial={{ opacity: 0, x: enterX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -enterX }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-2"
          >
            {pageItems.map((customer) => {
              const balanceNum = Number(customer.balance);
              const balanceVariant: "success" | "warning" | "danger" =
                balanceNum <= 0
                  ? "success"
                  : balanceNum < 5000
                    ? "warning"
                    : "danger";

              return (
                <Card
                  key={customer.id}
                  variant="interactive"
                  className="p-4"
                  onClick={() => onSelectCustomer(customer)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={customer.avatar_url ?? undefined} name={customer.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-h4 font-semibold text-foreground truncate">
                        {customer.name}
                      </p>
                      <p className="text-caption text-muted-foreground truncate">
                        {customer.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(customer.returned_checks_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          <Badge variant="warning" size="sm">
                            {customer.returned_checks_count}
                          </Badge>
                        </div>
                      )}
                      <Badge variant={balanceVariant} dot>
                        {formatCurrency(balanceNum)}
                      </Badge>
                      <ChevronIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dots indicator ── */}
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("route.pageLabel", { page: i + 1 })}
              aria-current={i === safePage}
              onClick={() => setPage([i, i > safePage ? 1 : -1])}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === safePage ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RouteView({ onSelectCustomer }: RouteViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateRange = useMemo(() => generateDateRange(), []);
  const [selectedIdx, setSelectedIdx] = useState(TODAY_INDEX);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [confirmDeliverOrder, setConfirmDeliverOrder] = useState<OrderWithCustomer | null>(null);
  const [confirmUndeliverOrder, setConfirmUndeliverOrder] = useState<OrderWithCustomer | null>(null);

  // ── Multi-select state ──
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedOrderIds.size > 0;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bulkAction, setBulkAction] = useState<"delete" | "deliver" | "undeliver" | null>(null);

  const toggleSelection = useCallback((id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  const startLongPress = useCallback((id: string) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedOrderIds((prev) => new Set(prev).add(id));
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const selectedDateObj = dateRange[selectedIdx];
  const selectedDay = getDayCode(selectedDateObj);
  const selectedDate = toDateStr(selectedDateObj);

  // Auto-scroll today into view on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayEl = scrollRef.current.children[TODAY_INDEX] as HTMLElement;
      if (todayEl) {
        todayEl.scrollIntoView({ inline: "center", block: "nearest" });
      }
    }
  }, []);

  // Fetch customers for selected day
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["route-day", selectedDay, selectedDate],
    queryFn: () => salesApi.getRouteByDay(selectedDay, selectedDate),
  });

  // Fetch all delivery orders for the selected date (single query)
  const { data: allOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["delivery-orders", selectedDate, selectedDay],
    queryFn: () => salesApi.getDeliveryOrders(selectedDate, selectedDay),
  });

  // Split into route vs bonus (off-route) orders client-side
  const orders = useMemo(
    () => allOrders?.filter((o) => o.is_route !== false) ?? [],
    [allOrders]
  );
  const bonusOrders = useMemo(
    () => allOrders?.filter((o) => o.is_route === false) ?? [],
    [allOrders]
  );

  // How many of the day's orders are still waiting to be delivered — surfaced
  // in the section headers so the rep sees it without scanning every card.
  const pendingCount = useMemo(
    () => orders.filter((o) => !(o as any).delivered_date).length,
    [orders]
  );
  const pendingBonusCount = useMemo(
    () => bonusOrders.filter((o) => !(o as any).delivered_date).length,
    [bonusOrders]
  );

  // Delivery confirmation mutation
  const deliveryMutation = useMutation({
    mutationFn: (orderId: string) => salesApi.confirmOrderDelivery(orderId),
    onSuccess: () => {
      setConfirmDeliverOrder(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  // Undeliver mutation
  const undeliverMutation = useMutation({
    mutationFn: (orderId: string) => salesApi.undeliverOrder(orderId),
    onSuccess: () => {
      setConfirmUndeliverOrder(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  // Bulk mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => salesApi.deleteOrder(id))),
    onSuccess: () => {
      clearSelection();
      setBulkAction(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const bulkDeliverMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => salesApi.confirmOrderDelivery(id))),
    onSuccess: () => {
      clearSelection();
      setBulkAction(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const bulkUndeliverMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => salesApi.undeliverOrder(id))),
    onSuccess: () => {
      clearSelection();
      setBulkAction(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleBulkConfirm = () => {
    const ids = Array.from(selectedOrderIds);
    if (bulkAction === "delete") bulkDeleteMutation.mutate(ids);
    else if (bulkAction === "deliver") bulkDeliverMutation.mutate(ids);
    else if (bulkAction === "undeliver") bulkUndeliverMutation.mutate(ids);
  };

  const isBulkPending = bulkDeleteMutation.isPending || bulkDeliverMutation.isPending || bulkUndeliverMutation.isPending;

  const handleConfirmDelivery = (order: OrderWithCustomer) => {
    setConfirmDeliverOrder(order);
  };

  const handleUndeliver = (order: OrderWithCustomer) => {
    setConfirmUndeliverOrder(order);
  };

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
    () => customers?.reduce((sum, c) => sum + Number(c.balance), 0) ?? 0,
    [customers]
  );
  const { data: todayCollections } = useQuery({
    queryKey: ["collections", selectedDate],
    queryFn: () => salesApi.getCollections(selectedDate),
  });

  // ── Today's payments popup (tap the collections stat) ──
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<CollectionPayment | null>(null);

  const { data: collectionPayments, isLoading: collectionsLoading } = useQuery({
    queryKey: ["collections-details", selectedDate],
    queryFn: () => salesApi.getCollectionsDetails(selectedDate),
    enabled: collectionsOpen,
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => salesApi.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections-details"] });
      queryClient.invalidateQueries({ queryKey: ["route-day"] });
      queryClient.invalidateQueries({ queryKey: ["my-customers"] });
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      setPaymentToDelete(null);
      toast({ title: t("payment.paymentDeleted"), variant: "success" });
    },
    onError: () => {
      setPaymentToDelete(null);
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const todayLabel = new Date().toLocaleDateString(
    isRTL ? "ar-EG" : "en-US",
    { month: "long", day: "numeric" }
  );

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <FadeIn animation="fade">
      <TopBar
        title={t("customer.todayRoute")}
        subtitle={todayLabel}
      />

      <div className="space-y-4 p-4">
        {/* ── Date Switcher ── */}
        <div className="-mx-4">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto overflow-y-hidden px-4 py-1 scrollbar-none snap-x snap-mandatory touch-pan-x overscroll-x-contain"
        >
          {dateRange.map((date, idx) => {
            const isToday = idx === TODAY_INDEX;
            const isSelected = idx === selectedIdx;
            const dayCode = getDayCode(date);
            const dayNum = date.getDate();
            const isPast = idx < TODAY_INDEX;

            return (
              <Button
                key={idx}
                variant="ghost"
                onClick={() => setSelectedIdx(idx)}
                className={`
                  flex flex-col items-center justify-center shrink-0 snap-center
                  w-[calc(20%-0.3rem)] min-w-[3.5rem] rounded-xl py-2 px-1 h-auto
                  transition-all duration-200
                  ${isSelected
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105 hover:bg-primary/90"
                    : isToday
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                      : isPast
                        ? "bg-card/50 text-muted-foreground"
                        : "bg-card text-foreground"
                  }
                `}
              >
                <span className={`text-[10px] font-medium leading-none ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {t(`customer.days.${dayCode}`)}
                </span>
                <span className={`text-lg font-bold leading-tight mt-0.5 ${isSelected ? "" : ""}`}>
                  {dayNum}
                </span>
                {isToday && !isSelected && (
                  <span className="h-1 w-1 rounded-full bg-primary mt-0.5" />
                )}
                {isToday && isSelected && (
                  <span className="h-1 w-1 rounded-full bg-primary-foreground mt-0.5" />
                )}
              </Button>
            );
          })}
        </div>
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
            value={formatCurrency(todayCollections ?? 0)}
            label={t("customer.todayCollections")}
            icon={Wallet}
            role="button"
            tabIndex={0}
            onClick={() => setCollectionsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setCollectionsOpen(true);
            }}
            className="cursor-pointer hover:bg-card-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* ── Expense Card ── */}
        <ExpenseCard categories={REP_CATEGORIES} date={toDateStr(dateRange[selectedIdx])} />

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
              <FadeIn animation="scale">
                <EmptyState
                  preset="empty-route"
                  title={t("route.noCustomers")}
                  description={t("route.noCustomersDesc")}
                />
              </FadeIn>
            )
          ) : (
            <CustomerPager
              customers={filtered}
              isRTL={isRTL}
              onSelectCustomer={onSelectCustomer}
              ChevronIcon={ChevronIcon}
            />
          )}
        </div>

        {/* ── Bonus Orders (shown first when no today orders) ── */}
        {!ordersLoading && (!orders || orders.length === 0) && (bonusOrders?.length ?? 0) > 0 && (
          <>
            <div className="relative flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
              <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-4 py-1.5 shadow-sm backdrop-blur-sm">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("customer.bonusOrders")}
                </span>
                <Badge variant="default" size="sm">
                  {bonusOrders!.length}
                </Badge>
                {pendingBonusCount > 0 && (
                  <Badge variant="warning" size="sm">
                    {t("order.pendingCount", { count: pendingBonusCount })}
                  </Badge>
                )}
              </div>
              <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
            </div>
            <div className="space-y-2">
              {bonusOrders!.map((order, idx) => {
                const itemCount = (order.data as any)?.items
                  ? ((order.data as any).items as unknown[]).length
                  : 0;
                const isDelivered = !!(order as any).delivered_date;
                const isSelected = selectedOrderIds.has(order.id);
                return (
                  <FadeIn key={order.id} delay={idx * 0.06}>
                  <Card
                    variant="glass"
                    className={`overflow-hidden p-0 transition-all ${isSelected ? "border-primary ring-2 ring-primary/30" : ""}`}
                  >
                    <div className="flex">
                      <div className={`w-1 shrink-0 rounded-s-xl ${deliveryStripe(isDelivered)}`} />
                      <div className="flex-1 p-3">
                        <div
                          className="flex items-center justify-between gap-3 cursor-pointer select-none"
                          onPointerDown={() => startLongPress(order.id)}
                          onPointerUp={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelection(order.id);
                            } else {
                              setSelectedOrder(order);
                              setOrderModalOpen(true);
                            }
                          }}
                        >
                          {selectionMode && (
                            <FadeIn animation="fade" className="shrink-0">
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </FadeIn>
                          )}
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
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="warning" className="font-mono tabular-nums">
                              {formatCurrency(order.amount)}
                            </Badge>
                            <DeliveryStatusBadge delivered={isDelivered} />
                          </div>
                        </div>
                        {!selectionMode && (
                          !isDelivered ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelivery(order);
                              }}
                              isLoading={deliveryMutation.isPending}
                            >
                              {t("order.confirmDelivery")}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndeliver(order);
                              }}
                              isLoading={undeliverMutation.isPending}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              {t("order.undeliver")}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                  </FadeIn>
                );
              })}
            </div>
          </>
        )}

        {/* ── Creative Separator (Today Orders) ── */}
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
                {pendingCount > 0 && (
                  <Badge variant="warning" size="sm">
                    {t("order.pendingCount", { count: pendingCount })}
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
                    const itemCount = (order.data as any)?.items
                      ? ((order.data as any).items as unknown[]).length
                      : 0;

                    const isDelivered = !!(order as any).delivered_date;
                    const isSelected = selectedOrderIds.has(order.id);

                    return (
                      <FadeIn key={order.id} delay={idx * 0.06}>
                      <Card
                        variant="glass"
                        className={`overflow-hidden p-0 transition-all ${isSelected ? "border-primary ring-2 ring-primary/30" : ""}`}
                      >
                        {/* Accent stripe */}
                        <div className="flex">
                          <div className={`w-1 shrink-0 rounded-s-xl ${deliveryStripe(isDelivered)}`} />
                          <div className="flex-1 p-3">
                            <div
                              className="flex items-center justify-between gap-3 cursor-pointer select-none"
                              onPointerDown={() => startLongPress(order.id)}
                              onPointerUp={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              onClick={() => {
                                if (selectionMode) {
                                  toggleSelection(order.id);
                                } else {
                                  setSelectedOrder(order);
                                  setOrderModalOpen(true);
                                }
                              }}
                            >
                              {selectionMode && (
                                <FadeIn animation="fade" className="shrink-0">
                                  {isSelected ? (
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Square className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </FadeIn>
                              )}
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
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="success" className="font-mono tabular-nums">
                                  {formatCurrency(order.amount)}
                                </Badge>
                                <DeliveryStatusBadge delivered={isDelivered} />
                              </div>
                            </div>
                            {!selectionMode && (
                              !isDelivered ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-3"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmDelivery(order);
                                  }}
                                  isLoading={deliveryMutation.isPending}
                                >
                                  {t("order.confirmDelivery")}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-3"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUndeliver(order);
                                  }}
                                  isLoading={undeliverMutation.isPending}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  {t("order.undeliver")}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </Card>
                      </FadeIn>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Bonus Orders Section (only when today orders exist, otherwise shown above) ── */}
            {orders && orders.length > 0 && (bonusOrders?.length ?? 0) > 0 && (
              <>
                <div className="relative flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-4 py-1.5 shadow-sm backdrop-blur-sm">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                      {t("customer.bonusOrders")}
                    </span>
                    {bonusOrders && bonusOrders.length > 0 && (
                      <Badge variant="default" size="sm">
                        {bonusOrders.length}
                      </Badge>
                    )}
                    {pendingBonusCount > 0 && (
                      <Badge variant="warning" size="sm">
                        {t("order.pendingCount", { count: pendingBonusCount })}
                      </Badge>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-e from-transparent via-border to-transparent" />
                </div>

                {ordersLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} variant="card" className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bonusOrders && bonusOrders.map((order, idx) => {
                      const itemCount = (order.data as any)?.items
                        ? ((order.data as any).items as unknown[]).length
                        : 0;

                      const isDelivered = !!(order as any).delivered_date;
                      const isSelected = selectedOrderIds.has(order.id);

                      return (
                        <FadeIn key={order.id} delay={idx * 0.06}>
                        <Card
                          variant="glass"
                          className={`overflow-hidden p-0 transition-all ${isSelected ? "border-primary ring-2 ring-primary/30" : ""}`}
                        >
                          {/* Accent stripe */}
                          <div className="flex">
                            <div className={`w-1 shrink-0 rounded-s-xl ${deliveryStripe(isDelivered)}`} />
                            <div className="flex-1 p-3">
                              <div
                                className="flex items-center justify-between gap-3 cursor-pointer select-none"
                                onPointerDown={() => startLongPress(order.id)}
                                onPointerUp={cancelLongPress}
                                onPointerCancel={cancelLongPress}
                                onPointerLeave={cancelLongPress}
                                onClick={() => {
                                  if (selectionMode) {
                                    toggleSelection(order.id);
                                  } else {
                                    setSelectedOrder(order);
                                    setOrderModalOpen(true);
                                  }
                                }}
                              >
                                {selectionMode && (
                                  <FadeIn animation="fade" className="shrink-0">
                                    {isSelected ? (
                                      <CheckSquare className="h-5 w-5 text-primary" />
                                    ) : (
                                      <Square className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </FadeIn>
                                )}
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
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="warning" className="font-mono tabular-nums">
                                    {formatCurrency(order.amount)}
                                  </Badge>
                                  <DeliveryStatusBadge delivered={isDelivered} />
                                </div>
                              </div>
                              {!selectionMode && (
                                !isDelivered ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmDelivery(order);
                                    }}
                                    isLoading={deliveryMutation.isPending}
                                  >
                                    {t("order.confirmDelivery")}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUndeliver(order);
                                    }}
                                    isLoading={undeliverMutation.isPending}
                                  >
                                    <Undo2 className="h-3.5 w-3.5" />
                                    {t("order.undeliver")}
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        </Card>
                        </FadeIn>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>

        {/* ── Bulk Action Bar ── */}
        {selectionMode && (
          <FadeIn>
          <div className="fixed bottom-6 inset-x-0 z-50">
            <div className="mx-4 flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 p-3 shadow-lg backdrop-blur-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-body-sm font-medium text-foreground whitespace-nowrap">
                {t("order.selectedCount", { count: selectedOrderIds.size })}
              </span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction("undeliver")}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction("deliver")}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkAction("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          </FadeIn>
        )}
      </div>

      {/* Order edit wizard */}
      <OrderEditWizard
        order={selectedOrder}
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
      />

      {/* Confirm Delivery Dialog */}
      <ConfirmationDialog
        open={!!confirmDeliverOrder}
        onOpenChange={(open) => { if (!open) setConfirmDeliverOrder(null); }}
        title={t("order.confirmDelivery")}
        description={t("order.confirmDeliveryMessage")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => confirmDeliverOrder && deliveryMutation.mutate(confirmDeliverOrder.id)}
        isLoading={deliveryMutation.isPending}
      />

      {/* Confirm Undeliver Dialog */}
      <ConfirmationDialog
        open={!!confirmUndeliverOrder}
        onOpenChange={(open) => { if (!open) setConfirmUndeliverOrder(null); }}
        title={t("order.undeliver")}
        description={t("order.undeliverMessage")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => confirmUndeliverOrder && undeliverMutation.mutate(confirmUndeliverOrder.id)}
        isLoading={undeliverMutation.isPending}
      />

      {/* Bulk Action Confirmation Dialog */}
      <ConfirmationDialog
        open={!!bulkAction}
        onOpenChange={(open) => { if (!open) setBulkAction(null); }}
        title={
          bulkAction === "delete" ? t("order.bulkDelete")
          : bulkAction === "deliver" ? t("order.bulkDeliver")
          : t("order.bulkUndeliver")
        }
        description={
          bulkAction === "delete" ? t("order.bulkDeleteMessage", { count: selectedOrderIds.size })
          : bulkAction === "deliver" ? t("order.bulkDeliverMessage", { count: selectedOrderIds.size })
          : t("order.bulkUndeliverMessage", { count: selectedOrderIds.size })
        }
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        variant={bulkAction === "delete" ? "destructive" : "default"}
        onConfirm={handleBulkConfirm}
        isLoading={isBulkPending}
      />

      {/* ── Today's collections breakdown ── */}
      <Dialog open={collectionsOpen} onOpenChange={setCollectionsOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("collections.title")}</DialogTitle>
            <DialogDescription>
              {t("collections.subtitle", {
                amount: formatCurrency(todayCollections ?? 0),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {collectionsLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="card" className="h-16" />
                ))}
              </div>
            ) : !collectionPayments || collectionPayments.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={t("collections.empty")}
                className="py-10"
              />
            ) : (
              <div className="space-y-2 py-1">
                {collectionPayments.map((p) => (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                        {p.type === "Payment_Check" ? (
                          <Receipt className="h-5 w-5" />
                        ) : (
                          <Wallet className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-semibold text-foreground truncate">
                          {p.customer_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant={p.type === "Payment_Check" ? "info" : "success"} size="sm">
                            {p.type === "Payment_Check" ? t("payment.check") : t("payment.collect.methodCash")}
                          </Badge>
                          <span className="text-caption text-muted-foreground">
                            {formatTime(p.created_at, i18n.language)}
                          </span>
                        </div>
                        {p.type === "Payment_Check" && p.data && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
                            {p.data.check_number && (
                              <span className="inline-flex items-center gap-1" title={t("payment.checkNumber")}>
                                <Hash className="h-3 w-3 shrink-0" />
                                <span dir="ltr">{p.data.check_number}</span>
                              </span>
                            )}
                            {p.data.due_date && (
                              <span className="inline-flex items-center gap-1" title={t("payment.dueDate")}>
                                <CalendarDays className="h-3 w-3 shrink-0" />
                                <span dir="ltr">{p.data.due_date}</span>
                              </span>
                            )}
                            {p.data.bank && (
                              <span className="truncate">{p.data.bank}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-body-sm font-bold text-foreground" dir="ltr">
                        ₪ {formatCurrency(Math.abs(p.amount))}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-destructive"
                        onClick={() => setPaymentToDelete(p)}
                        title={t("payment.deletePayment")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!paymentToDelete}
        onOpenChange={(open) => { if (!open) setPaymentToDelete(null); }}
        title={t("payment.deletePayment")}
        description={
          paymentToDelete
            ? t("payment.deletePaymentConfirm", {
                name: paymentToDelete.customer_name,
                amount: formatCurrency(Math.abs(paymentToDelete.amount)),
              })
            : ""
        }
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        variant="destructive"
        onConfirm={() => {
          if (paymentToDelete) deletePaymentMutation.mutate(paymentToDelete.id);
        }}
        isLoading={deletePaymentMutation.isPending}
      />
    </FadeIn>
  );
}
