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
  Sun,
  Moon,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  Check,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { AppShell } from "@/components/layout/app-shell";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/useTheme";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { salesApi, type Customer, type Product, type OrderItem, type CartItem, type SelectedOption } from "@/services/salesApi";
import { cartKey, optionsPrice } from "@/lib/cart";
import { syncQueue } from "@/lib/syncQueue";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";
import { toLocalDateStr } from "@/lib/utils";
import { OptionPickerDialog } from "@/components/ui/option-picker-dialog";

import { ProductDetail } from "@/components/ui/product-detail";
import { RouteView } from "./RouteView";
import { CustomerDashboard } from "./CustomerDashboard";
import { OrderFlow } from "./OrderFlow";
import { PaymentFlow } from "./PaymentFlow";
import { StatementView } from "./StatementView";
import { ReturnedChecksView } from "./ReturnedChecksView";
import { CustomerForm } from "./CustomerForm";
import { AllCustomersView } from "./AllCustomersView";
import { PurchaseFlow } from "./PurchaseFlow";
import { SyncStatusCard } from "@/components/shared/SyncStatusCard";

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
  | "returnedChecks"
  | "customerForm"
  | "productDetail"
  | "purchase";

/* ------------------------------------------------------------------ */
/*  CustomerSelector — dropdown card for picking order customer         */
/* ------------------------------------------------------------------ */
function CustomerSelector({
  customers,
  selected,
  onSelect,
}: {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (c: Customer) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
          selected
            ? "border-primary/50 bg-primary/5"
            : "border-border/50 bg-card/50"
        }`}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} size="sm" />
            <div className="flex-1 min-w-0 text-start">
              <p className="text-body-sm font-semibold text-foreground truncate">
                {selected.name}
              </p>
              <p className="text-caption text-muted-foreground">{selected.city}</p>
            </div>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-start text-body-sm text-muted-foreground">
              {t("cart.selectCustomer")}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <Card
          variant="glass"
          className="absolute inset-x-0 top-full mt-1 z-50 max-h-64 overflow-hidden flex flex-col shadow-xl border border-border"
        >
          <div className="p-2 border-b border-border/50">
            <SearchInput
              placeholder={t("customer.searchCustomers")}
              onSearch={setSearch}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-caption text-muted-foreground py-4">
                {t("customer.noCustomers")}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 ${
                    selected?.id === c.id ? "bg-primary/10" : ""
                  }`}
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-body-sm font-medium text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-caption text-muted-foreground">{c.city}</p>
                  </div>
                  {selected?.id === c.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </Card>
      )}
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
  selectedCustomer: Customer | null;
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
}

function CartView({
  cart,
  updateCartQty,
  removeFromCart,
  clearCart,
  cartTotal,
  onPlaceOrder,
  onBrowse,
  selectedCustomer,
  customers,
  onSelectCustomer,
}: CartViewProps) {
  const { t } = useTranslation();

  const cartEntries = useMemo(() => Array.from(cart.entries()), [cart]);

  const productName = (p: Product) => getProductName(p);

  if (cartEntries.length === 0) {
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
        {/* Customer selector */}
        <CustomerSelector
          customers={customers}
          selected={selectedCustomer}
          onSelect={onSelectCustomer}
        />

        {/* Cart items */}
        <div className="space-y-2">
          {cartEntries.map(([key, ci], idx) => {
            const unitPrice = (ci.product.discounted_price ?? ci.product.price) + optionsPrice(ci.selectedOptions);
            return (
              <Card
                key={key}
                variant="glass"
                className="animate-slide-up overflow-hidden"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Product image */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                      {getCoverImage(ci.product) ? (
                        <img
                          src={getCoverImage(ci.product)!}
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
                      {ci.selectedOptions?.length ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {ci.selectedOptions.map((opt) => (
                            <Badge key={`${opt.name}:${opt.value}`} variant="outline" size="sm" className="text-[0.6rem]">
                              {opt.value}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatCurrency(unitPrice)} x {ci.quantity}
                      </p>
                      <p className="text-body-sm font-bold text-primary mt-0.5">
                        {formatCurrency(unitPrice * ci.quantity)}
                      </p>
                    </div>

                    {/* Quantity controls + remove */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => updateCartQty(key, ci.quantity - 1)}
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
                          onClick={() => updateCartQty(key, ci.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
  const productName = (p: Product) => getProductName(p);
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
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);

  const { data: allCustomers = [] } = useQuery({
    queryKey: ["my-customers"],
    queryFn: salesApi.getMyCustomers,
  });

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
  const addToCart = useCallback((product: Product, qty: number = 1, selectedOptions?: SelectedOption[]) => {
    setCart((prev) => {
      const next = new Map(prev);
      const key = cartKey(product.id, selectedOptions);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + qty });
      } else {
        next.set(key, { product, quantity: qty, selectedOptions });
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
          sum + ((item.product.discounted_price ?? item.product.price) + optionsPrice(item.selectedOptions)) * item.quantity,
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
        queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
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
      name: productName(ci.product),
      image_url: ci.product.image_urls?.[0] ?? null,
      quantity: ci.quantity,
      unit_price: (ci.product.discounted_price ?? ci.product.price) + optionsPrice(ci.selectedOptions),
      selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    }));

    const payload = {
      customer_id: selectedCustomer.id,
      items,
      delivery_date: deliveryDate
        ? toLocalDateStr(deliveryDate)
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
      view === "statement" ||
      view === "returnedChecks" ||
      view === "purchase"
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
    (action: "order" | "payment" | "statement" | "check" | "purchase") => {
      if (action === "check") {
        setView("returnedChecks");
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
    queryClient.invalidateQueries({ queryKey: ["collections"] });
    queryClient.invalidateQueries({ queryKey: ["route-day"] });
    setView("customer");
  }, [queryClient]);

  const navigateToProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setPrevViewBeforeProduct(view as View);
    setView("productDetail");
  }, [view]);

  const { isDark, toggleTheme } = useTheme();

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
            queryKey={["my-customers"]}
            queryFn={salesApi.getMyCustomers}
            onSelectCustomer={navigateToCustomer}
            onAddCustomer={navigateToAddCustomer}
            archiveFn={salesApi.archiveCustomer}
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
            selectedCustomer={selectedCustomer}
            customers={allCustomers}
            onSelectCustomer={setSelectedCustomer}
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

                  {/* Theme toggle */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15">
                      {isDark ? <Moon className="h-4 w-4 text-warning" /> : <Sun className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-body-sm font-medium text-foreground">
                        {t("profile.theme")}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      {isDark ? t("profile.darkMode") : t("profile.lightMode")}
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

              {/* Sync Status */}
              <div
                className="animate-slide-up"
                style={{ animationDelay: "90ms" }}
              >
                <SyncStatusCard />
              </div>

              {/* Logout */}
              <Button
                variant="destructive"
                size="lg"
                className="w-full animate-slide-up"
                style={{ animationDelay: "150ms" }}
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
        <>
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
                  if (selectedProduct.options?.length) {
                    setPickerProduct(selectedProduct);
                  } else {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                    setView(prevViewBeforeProduct);
                  }
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                {t("catalog.addToOrder")}
              </Button>
            }
          />
          <OptionPickerDialog
            product={pickerProduct}
            onOpenChange={(open) => { if (!open) setPickerProduct(null); }}
            onAdd={(product, qty, options) => {
              addToCart(product, qty, options);
              setPickerProduct(null);
              setSelectedProduct(null);
              setView(prevViewBeforeProduct);
            }}
          />
        </>
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
      case "returnedChecks":
        return (
          <ReturnedChecksView
            customer={selectedCustomer}
            onBack={navigateBack}
          />
        );
      case "purchase":
        return (
          <PurchaseFlow
            customer={selectedCustomer}
            onBack={navigateBack}
            onComplete={() => setView("customer")}
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
      <div className="w-full">
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
