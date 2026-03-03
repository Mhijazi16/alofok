import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Package,
  User,
  Users,
  Globe,
  LogOut,
  Info,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { salesApi, type Customer, type Product, type OrderItem } from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { getImageUrl } from "@/lib/image";

import { ProductDetail } from "@/components/ui/product-detail";
import { RouteView } from "./RouteView";
import { CustomerDashboard } from "./CustomerDashboard";
import { OrderFlow, type CartItem } from "./OrderFlow";
import { PaymentFlow } from "./PaymentFlow";
import { StatementView } from "./StatementView";
import { CustomerForm } from "./CustomerForm";

type View =
  | "route"
  | "catalog"
  | "cart"
  | "customers"
  | "profile"
  | "customer"
  | "order"
  | "payment"
  | "statement"
  | "customerForm"
  | "productDetail";

/* ------------------------------------------------------------------ */
/*  AllCustomersView — browse all rep's customers                      */
/* ------------------------------------------------------------------ */
const DAYS_LIST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"] as const;

interface AllCustomersViewProps {
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer: () => void;
}

function AllCustomersView({ onSelectCustomer, onAddCustomer }: AllCustomersViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("all");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["my-customers"],
    queryFn: salesApi.getMyCustomers,
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = customers;
    if (dayFilter !== "all") {
      list = list.filter((c) => c.assigned_day === dayFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      );
    }
    return list;
  }, [customers, search, dayFilter]);

  // Group by assigned_day
  const grouped = useMemo(() => {
    if (dayFilter !== "all") return null;
    const map = new Map<string, Customer[]>();
    for (const c of filtered) {
      const existing = map.get(c.assigned_day) ?? [];
      existing.push(c);
      map.set(c.assigned_day, existing);
    }
    return map;
  }, [filtered, dayFilter]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const renderCustomerCard = (customer: Customer, idx: number) => {
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
        style={{ animationDelay: `${idx * 40}ms` }}
        onClick={() => onSelectCustomer(customer)}
      >
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold text-foreground truncate">
              {customer.name}
            </p>
            <p className="text-caption text-muted-foreground truncate">
              {customer.city}
              {customer.phone && ` · ${customer.phone}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={balanceVariant} dot size="sm">
              {formatCurrency(customer.balance)}
            </Badge>
            <ChevronIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("customer.allCustomers")}
        subtitle={!isLoading ? `${customers?.length ?? 0} ${t("customer.totalCustomers").toLowerCase()}` : undefined}
      />

      <div className="space-y-4 p-4">
        {/* Day filter pills */}
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
          <Tabs value={dayFilter} onValueChange={setDayFilter}>
            <TabsList variant="segment" className="w-full">
              <TabsTrigger value="all" className="flex-1 min-w-0">
                {t("actions.viewAll")}
              </TabsTrigger>
              {DAYS_LIST.map((day) => (
                <TabsTrigger
                  key={day}
                  value={day}
                  className="flex-1 min-w-0"
                >
                  {t(`customer.days.${day}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Search */}
        <SearchInput
          placeholder={t("customer.searchCustomers")}
          onSearch={setSearch}
        />

        {/* Customer List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState preset="no-results" />
          ) : (
            <EmptyState
              icon={Users}
              title={t("customer.noCustomers")}
              action={{ label: t("customer.addNew"), onClick: onAddCustomer }}
            />
          )
        ) : grouped ? (
          // Grouped by day
          <div className="space-y-5">
            {DAYS_LIST.filter((d) => grouped.has(d)).map((day) => {
              const dayCustomers = grouped.get(day)!;
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-caption font-semibold text-primary uppercase tracking-wider">
                      {t(`customer.days.${day}`)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                    <Badge variant="outline" size="sm">
                      {dayCustomers.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {dayCustomers.map((c, idx) => renderCustomerCard(c, idx))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat list (filtered by specific day)
          <div className="space-y-2">
            {filtered.map((c, idx) => renderCustomerCard(c, idx))}
          </div>
        )}
      </div>

      {/* FAB — Add Customer */}
      <button
        onClick={onAddCustomer}
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CartView — full-page cart                                          */
/* ------------------------------------------------------------------ */
interface CartViewProps {
  cart: Map<string, CartItem>;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  onPlaceOrder: () => void;
  onBrowse: () => void;
  customerName: string | null;
}

function CartView({
  cart,
  updateCartQty,
  removeFromCart,
  clearCart,
  cartTotal,
  onPlaceOrder,
  onBrowse,
  customerName,
}: CartViewProps) {
  const { t, i18n } = useTranslation();

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const productName = (p: Product) =>
    i18n.language === "ar" ? p.name_ar : p.name_en;

  if (cartItems.length === 0) {
    return (
      <div className="animate-fade-in">
        <TopBar title={t("cart.title")} />
        <EmptyState
          icon={ShoppingCart}
          title={t("cart.empty")}
          description={t("cart.browseCatalog")}
          action={{ label: t("nav.catalog"), onClick: onBrowse }}
          className="py-16"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("cart.title")}
        actions={
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            <Trash2 className="h-4 w-4 me-1" />
            {t("actions.delete")}
          </Button>
        }
      />

      <div className="space-y-3 p-4">
        {/* Customer context */}
        {customerName && (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-body-sm text-muted-foreground">{customerName}</span>
          </div>
        )}

        {/* Cart items */}
        <div className="space-y-2">
          {cartItems.map((ci, idx) => (
            <Card
              key={ci.product.id}
              variant="glass"
              className="animate-slide-up overflow-hidden"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Product image */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                    {ci.product.image_url ? (
                      <img
                        src={getImageUrl(ci.product.image_url)!}
                        alt={productName(ci.product)}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-foreground truncate">
                      {productName(ci.product)}
                    </p>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      {formatCurrency(ci.product.discounted_price ?? ci.product.price)} x {ci.quantity}
                    </p>
                    <p className="text-body-sm font-bold text-primary mt-0.5">
                      {formatCurrency((ci.product.discounted_price ?? ci.product.price) * ci.quantity)}
                    </p>
                  </div>

                  {/* Quantity controls + remove */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(ci.product.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateCartQty(ci.product.id, ci.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[2rem] text-center text-body-sm font-bold text-foreground">
                        {ci.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateCartQty(ci.product.id, ci.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-body-sm text-muted-foreground px-1">
            <span>{t("cart.itemCount", { count: cart.size })}</span>
          </div>

          <StatCard
            variant="gradient"
            value={formatCurrency(cartTotal)}
            label={t("cart.subtotal")}
            icon={ShoppingCart}
          />

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={onPlaceOrder}
          >
            <ShoppingCart className="h-5 w-5 me-2" />
            {t("cart.placeOrder")}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onBrowse}
          >
            <Package className="h-4 w-4 me-2" />
            {t("cart.browseCatalog")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: Calculate auto delivery date                                */
/* ------------------------------------------------------------------ */
function getAutoDeliveryDate(customerAssignedDay: string): Date {
  const today = new Date();
  const daysMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const customerDayNum = daysMap[customerAssignedDay];
  const todayNum = today.getDay();

  if (customerDayNum === todayNum) {
    return today;
  }

  // Calculate days until next occurrence
  let daysUntil = (customerDayNum - todayNum + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

/* ------------------------------------------------------------------ */
/*  SalesRoot                                                          */
/* ------------------------------------------------------------------ */
export default function SalesRoot() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAppSelector((s) => s.auth.userId);
  const role = useAppSelector((s) => s.auth.role);

  const [view, setView] = useState<View>("route");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [editingCustomer, setEditingCustomer] = useState<
    Customer | undefined
  >();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [customDeliveryDate, setCustomDeliveryDate] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(
    () => localStorage.getItem("alofok-avatar-seed") || userId || "user"
  );
  useEffect(() => {
    localStorage.setItem("alofok-avatar-seed", avatarSeed);
  }, [avatarSeed]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [prevViewBeforeProduct, setPrevViewBeforeProduct] = useState<View>("catalog");

  /* ---- Cart state — lifted from OrderFlow for persistence ---- */
  const [cart, setCart] = useState<Map<string, CartItem>>(() => {
    try {
      const saved = localStorage.getItem("alofok-cart");
      if (saved) {
        const entries = JSON.parse(saved) as [string, CartItem][];
        return new Map(entries);
      }
    } catch {
      /* ignore */
    }
    return new Map();
  });

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem("alofok-cart", JSON.stringify([...cart]));
  }, [cart]);

  // Cart helper functions
  const addToCart = useCallback((product: Product, qty: number = 1) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      if (existing) {
        next.set(product.id, { ...existing, quantity: existing.quantity + qty });
      } else {
        next.set(product.id, { product, quantity: qty });
      }
      return next;
    });
  }, []);

  const updateCartQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(productId);
      } else {
        const existing = next.get(productId);
        if (existing) next.set(productId, { ...existing, quantity: qty });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);

  const cartTotal = useMemo(
    () =>
      Array.from(cart.values()).reduce(
        (sum, item) =>
          sum + (item.product.discounted_price ?? item.product.price) * item.quantity,
        0
      ),
    [cart]
  );

  /* ---- Order mutation (shared by CartView) ---- */
  const orderMutation = useMutation({
    mutationFn: salesApi.createOrder,
    onSuccess: () => {
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: ["my-route"] });
        queryClient.invalidateQueries({ queryKey: ["route-orders"] });
        queryClient.invalidateQueries({ queryKey: ["insights", selectedCustomer.id] });
        queryClient.invalidateQueries({ queryKey: ["statement", selectedCustomer.id] });
      }
      clearCart();
      toast({ title: t("catalog.orderSuccess"), variant: "success" });
      setView("customer");
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handlePlaceOrder = useCallback(() => {
    if (!selectedCustomer || !selectedCustomer.id) {
      toast({ title: t("cart.selectCustomer"), variant: "warning" });
      return;
    }
    setDeliveryDate(getAutoDeliveryDate(selectedCustomer.assigned_day));
    setCustomDeliveryDate(false);
    setConfirmOpen(true);
  }, [selectedCustomer, toast, t]);

  const handleConfirmOrder = useCallback(async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;

    const items: OrderItem[] = Array.from(cart.values()).map((ci) => ({
      product_id: ci.product.id,
      quantity: ci.quantity,
      unit_price: ci.product.discounted_price ?? ci.product.price,
    }));

    const payload = {
      customer_id: selectedCustomer.id,
      items,
      delivery_date: deliveryDate
        ? deliveryDate.toISOString().split("T")[0]
        : null,
    };

    if (isOnline) {
      orderMutation.mutate(payload);
    } else {
      await syncQueue.push("order", payload);
      clearCart();
      toast({ title: t("catalog.orderQueued"), variant: "success" });
      setView("customer");
    }
    setConfirmOpen(false);
    setDeliveryDate(undefined);
  }, [selectedCustomer, cart, isOnline, orderMutation, clearCart, toast, t, deliveryDate]);

  /* ---- Navigation helpers ---- */
  const navigateToCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setView("customer");
  }, []);

  const navigateBack = useCallback(() => {
    if (view === "customer") {
      setView("route");
      setSelectedCustomer(null);
    } else if (view === "customerForm") {
      if (selectedCustomer) {
        setView("customer");
      } else {
        setView("route");
      }
      setEditingCustomer(undefined);
    } else if (view === "productDetail") {
      setSelectedProduct(null);
      setView(prevViewBeforeProduct);
    } else if (
      view === "order" ||
      view === "payment" ||
      view === "statement"
    ) {
      setView("customer");
    }
  }, [view, selectedCustomer, prevViewBeforeProduct]);

  const navigateToAddCustomer = useCallback(() => {
    setEditingCustomer(undefined);
    setView("customerForm");
  }, []);

  const navigateToEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setView("customerForm");
  }, []);

  const handleCustomerAction = useCallback(
    (action: "order" | "payment" | "statement" | "check") => {
      if (action === "check") {
        setView("statement");
      } else {
        setView(action);
      }
    },
    []
  );

  const handleOrderDone = useCallback(() => {
    clearCart();
    setView("customer");
  }, [clearCart]);

  const handlePaymentDone = useCallback(() => {
    setView("customer");
  }, []);

  const navigateToProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setPrevViewBeforeProduct(view as View);
    setView("productDetail");
  }, [view]);

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  const isMainView =
    view === "route" || view === "catalog" || view === "cart" || view === "customers" || view === "profile";

  const bottomNavItems = [
    { icon: MapPin, label: t("nav.route"), value: "route" },
    { icon: Users, label: t("nav.customers"), value: "customers" },
    { icon: Package, label: t("nav.catalog"), value: "catalog" },
    { icon: ShoppingCart, label: t("cart.title"), value: "cart", badge: cart.size || undefined },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const renderMainView = () => {
    switch (view) {
      case "route":
        return (
          <RouteView
            onSelectCustomer={navigateToCustomer}
            onAddCustomer={navigateToAddCustomer}
          />
        );

      case "catalog":
        return selectedCustomer ? (
          <OrderFlow
            customer={selectedCustomer}
            onBack={() => setView("route")}
            onDone={handleOrderDone}
            cart={cart}
            addToCart={addToCart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            onViewCart={() => setView("cart")}
            onViewProduct={navigateToProduct}
          />
        ) : (
          <OrderFlow
            customer={{ id: "", name: "", city: "", assigned_day: "", balance: 0 }}
            onBack={() => setView("route")}
            onDone={() => setView("route")}
            cart={cart}
            addToCart={addToCart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            onViewCart={() => setView("cart")}
            onViewProduct={navigateToProduct}
          />
        );

      case "customers":
        return (
          <AllCustomersView
            onSelectCustomer={navigateToCustomer}
            onAddCustomer={navigateToAddCustomer}
          />
        );

      case "cart":
        return (
          <CartView
            cart={cart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            cartTotal={cartTotal}
            onPlaceOrder={handlePlaceOrder}
            onBrowse={() => setView("catalog")}
            customerName={selectedCustomer?.name ?? null}
          />
        );

      case "profile":
        return (
          <div className="animate-fade-in">
            <TopBar title={t("profile.title")} />
            <div className="space-y-4 p-4">
              {/* User Card */}
              <Card variant="glass" className="animate-slide-up">
                <CardContent className="flex items-center gap-4 p-5">
                  <AvatarPicker
                    currentSeed={avatarSeed}
                    onSelect={setAvatarSeed}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-h3 font-bold text-foreground truncate">
                      {userId ?? t("nav.profile")}
                    </p>
                    <Badge variant="default" dot className="mt-1">
                      {role ?? "Sales"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card
                variant="glass"
                className="animate-slide-up"
                style={{ animationDelay: "60ms" }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-body-sm text-muted-foreground">
                    {t("nav.settings")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-0">
                  {/* Language toggle */}
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/15">
                      <Globe className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-body-sm font-medium text-foreground">
                        {t("profile.language")}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      {i18n.language === "ar"
                        ? t("profile.arabic")
                        : t("profile.english")}
                    </Badge>
                  </button>

                  <Separator />

                  {/* App version */}
                  <div className="flex w-full items-center gap-3 rounded-xl p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-body-sm font-medium text-foreground">
                        {t("profile.version")}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      1.0.0
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Logout */}
              <Button
                variant="destructive"
                size="lg"
                className="w-full animate-slide-up"
                style={{ animationDelay: "120ms" }}
                onClick={() => dispatch(logout())}
              >
                <LogOut className="h-4 w-4" />
                {t("auth.logout")}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderSubView = () => {
    if (view === "customerForm") {
      return (
        <CustomerForm
          customer={editingCustomer}
          onBack={navigateBack}
          onDone={() => {
            setEditingCustomer(undefined);
            if (selectedCustomer) {
              setView("customer");
            } else {
              setView("route");
            }
          }}
        />
      );
    }

    if (view === "productDetail" && selectedProduct) {
      return (
        <ProductDetail
          product={selectedProduct}
          onBack={() => {
            setSelectedProduct(null);
            setView(prevViewBeforeProduct);
          }}
          actions={
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={() => {
                addToCart(selectedProduct);
                setSelectedProduct(null);
                setView(prevViewBeforeProduct);
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              {t("catalog.addToOrder")}
            </Button>
          }
        />
      );
    }

    if (!selectedCustomer) return null;

    switch (view) {
      case "customer":
        return (
          <CustomerDashboard
            customer={selectedCustomer}
            onBack={navigateBack}
            onAction={handleCustomerAction}
            onEditCustomer={navigateToEditCustomer}
          />
        );
      case "order":
        return (
          <OrderFlow
            customer={selectedCustomer}
            onBack={navigateBack}
            onDone={handleOrderDone}
            cart={cart}
            addToCart={addToCart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            onViewCart={() => setView("cart")}
            onViewProduct={navigateToProduct}
          />
        );
      case "payment":
        return (
          <PaymentFlow
            customer={selectedCustomer}
            onBack={navigateBack}
            onDone={handlePaymentDone}
          />
        );
      case "statement":
        return (
          <StatementView
            customer={selectedCustomer}
            onBack={navigateBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AppShell
      bottomNav={
        isMainView ? (
          <BottomNav
            items={bottomNavItems}
            activeValue={view}
            onValueChange={(v) => setView(v as View)}
          />
        ) : undefined
      }
    >
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-8">
        <OfflineBanner
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
        />

        {isMainView ? renderMainView() : renderSubView()}
      </div>

      {/* Order Confirmation Dialog with Delivery Date */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setDeliveryDate(undefined); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirm.orderTitle")}</DialogTitle>
            <DialogDescription>{t("confirm.orderDesc")}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="custom-delivery"
                checked={customDeliveryDate}
                onCheckedChange={(checked) => setCustomDeliveryDate(checked as boolean)}
              />
              <label htmlFor="custom-delivery" className="text-sm text-muted-foreground cursor-pointer">
                {t("catalog.customDeliveryDate") || "Set custom delivery date"}
              </label>
            </div>
            <FormField label={t("catalog.deliveryDate")}>
              <DatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                placeholder={t("catalog.selectDeliveryDate")}
                disabled={!customDeliveryDate}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setDeliveryDate(undefined); }} disabled={orderMutation.isPending}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleConfirmOrder} isLoading={orderMutation.isPending}>
              {t("actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
