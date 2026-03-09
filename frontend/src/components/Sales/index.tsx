import { useState, useCallback, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Package, User, Users, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OptionPickerDialog } from "@/components/ui/option-picker-dialog";
import { ProductDetail } from "@/components/ui/product-detail";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { useAppSelector } from "@/store";
import { salesApi, type Customer, type Product, type OrderItem } from "@/services/salesApi";
import { optionsPrice } from "@/lib/cart";
import { syncQueue } from "@/lib/syncQueue";
import { getProductName } from "@/lib/product";
import { toLocalDateStr } from "@/lib/utils";

import { CartView, getAutoDeliveryDate } from "./views/CartView";
import { SalesProfileView } from "./views/SalesProfileView";
import { RouteView } from "./RouteView";
import { CustomerDashboard } from "./CustomerDashboard";
import { OrderFlow } from "./OrderFlow";
import { PaymentFlow } from "./PaymentFlow";
import { StatementView } from "./StatementView";
import { ReturnedChecksView } from "./ReturnedChecksView";
import { CustomerForm } from "./CustomerForm";
import { AllCustomersView } from "./AllCustomersView";
import { PurchaseFlow } from "./PurchaseFlow";

type View =
  | "route" | "catalog" | "cart" | "customers" | "profile"
  | "customer" | "order" | "payment" | "statement"
  | "returnedChecks" | "customerForm" | "productDetail" | "purchase";

/* ------------------------------------------------------------------ */
/*  SalesRoot                                                          */
/* ------------------------------------------------------------------ */
export default function SalesRoot() {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAppSelector((s) => s.auth.userId);
  const role = useAppSelector((s) => s.auth.role);

  const [view, setView] = useState<View>("route");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [customDeliveryDate, setCustomDeliveryDate] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(() => localStorage.getItem("alofok-avatar-seed") || userId || "user");
  useEffect(() => { localStorage.setItem("alofok-avatar-seed", avatarSeed); }, [avatarSeed]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [prevViewBeforeProduct, setPrevViewBeforeProduct] = useState<View>("catalog");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);

  const { data: allCustomers = [] } = useQuery({ queryKey: ["my-customers"], queryFn: salesApi.getMyCustomers });
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartTotal } = useCart({ storageKey: "alofok-cart" });

  /* ---- Order mutation ---- */
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
    onError: () => { toast({ title: t("toast.error"), variant: "error" }); },
  });

  const handlePlaceOrder = useCallback(() => {
    if (!selectedCustomer?.id) { toast({ title: t("cart.selectCustomer"), variant: "warning" }); return; }
    setDeliveryDate(getAutoDeliveryDate(selectedCustomer.assigned_day));
    setCustomDeliveryDate(false);
    setConfirmOpen(true);
  }, [selectedCustomer, toast, t]);

  const handleConfirmOrder = useCallback(async () => {
    if (!selectedCustomer?.id) return;
    const items: OrderItem[] = Array.from(cart.values()).map((ci) => ({
      product_id: ci.product.id,
      name: getProductName(ci.product),
      image_url: ci.product.image_urls?.[0] ?? null,
      quantity: ci.quantity,
      unit_price: (ci.product.discounted_price ?? ci.product.price) + optionsPrice(ci.selectedOptions),
      selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    }));
    const payload = { customer_id: selectedCustomer.id, items, delivery_date: deliveryDate ? toLocalDateStr(deliveryDate) : null };
    if (isOnline) { orderMutation.mutate(payload); } else {
      await syncQueue.push("order", payload);
      clearCart();
      toast({ title: t("catalog.orderQueued"), variant: "success" });
      setView("customer");
    }
    setConfirmOpen(false);
    setDeliveryDate(undefined);
  }, [selectedCustomer, cart, isOnline, orderMutation, clearCart, toast, t, deliveryDate]);

  /* ---- Navigation helpers ---- */
  const navigateToCustomer = useCallback((customer: Customer) => { setSelectedCustomer(customer); setView("customer"); }, []);
  const navigateBack = useCallback(() => {
    if (view === "customer") { setView("route"); setSelectedCustomer(null); }
    else if (view === "customerForm") { selectedCustomer ? setView("customer") : setView("route"); setEditingCustomer(undefined); }
    else if (view === "productDetail") { setSelectedProduct(null); setView(prevViewBeforeProduct); }
    else if (["order", "payment", "statement", "returnedChecks", "purchase"].includes(view)) { setView("customer"); }
  }, [view, selectedCustomer, prevViewBeforeProduct]);
  const navigateToProduct = useCallback((product: Product) => { setSelectedProduct(product); setPrevViewBeforeProduct(view as View); setView("productDetail"); }, [view]);
  const handleCustomerAction = useCallback((action: "order" | "payment" | "statement" | "check" | "purchase") => { setView(action === "check" ? "returnedChecks" : action); }, []);

  const isMainView = ["route", "catalog", "cart", "customers", "profile"].includes(view);
  const bottomNavItems = [
    { icon: MapPin, label: t("nav.route"), value: "route" },
    { icon: Users, label: t("nav.customers"), value: "customers" },
    { icon: Package, label: t("nav.catalog"), value: "catalog" },
    { icon: ShoppingCart, label: t("cart.title"), value: "cart", badge: cart.size || undefined },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const renderMainView = () => {
    switch (view) {
      case "route": return <RouteView onSelectCustomer={navigateToCustomer} />;
      case "catalog": {
        const cust = selectedCustomer ?? { id: "", name: "", city: "", assigned_day: "", balance: 0 };
        const done = selectedCustomer ? () => { clearCart(); setView("customer"); } : () => setView("route");
        return <OrderFlow customer={cust} onBack={() => setView("route")} onDone={done} cart={cart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} onViewCart={() => setView("cart")} onViewProduct={navigateToProduct} />;
      }
      case "customers": return <AllCustomersView queryKey={["my-customers"]} queryFn={salesApi.getMyCustomers} onSelectCustomer={navigateToCustomer} onAddCustomer={() => { setEditingCustomer(undefined); setView("customerForm"); }} archiveFn={salesApi.archiveCustomer} />;
      case "cart": return <CartView cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} clearCart={clearCart} cartTotal={cartTotal} onPlaceOrder={handlePlaceOrder} onBrowse={() => setView("catalog")} selectedCustomer={selectedCustomer} customers={allCustomers} onSelectCustomer={setSelectedCustomer} />;
      case "profile": return <SalesProfileView userId={userId} role={role} avatarSeed={avatarSeed} onAvatarChange={setAvatarSeed} />;
      default: return null;
    }
  };

  const renderSubView = () => {
    if (view === "customerForm") return <CustomerForm customer={editingCustomer} onBack={navigateBack} onDone={() => { setEditingCustomer(undefined); setView(selectedCustomer ? "customer" : "route"); }} />;
    if (view === "productDetail" && selectedProduct) return (
      <>
        <ProductDetail product={selectedProduct} onBack={() => { setSelectedProduct(null); setView(prevViewBeforeProduct); }} actions={<Button variant="gradient" size="lg" className="w-full" onClick={() => { if (selectedProduct.options?.length) setPickerProduct(selectedProduct); else { addToCart(selectedProduct); setSelectedProduct(null); setView(prevViewBeforeProduct); } }}><ShoppingCart className="h-4 w-4" />{t("catalog.addToOrder")}</Button>} />
        <OptionPickerDialog product={pickerProduct} onOpenChange={(open) => { if (!open) setPickerProduct(null); }} onAdd={(product, qty, options) => { addToCart(product, qty, options); setPickerProduct(null); setSelectedProduct(null); setView(prevViewBeforeProduct); }} />
      </>
    );
    if (!selectedCustomer) return null;
    switch (view) {
      case "customer": return <CustomerDashboard customer={selectedCustomer} onBack={navigateBack} onAction={handleCustomerAction} onEditCustomer={(c) => { setEditingCustomer(c); setView("customerForm"); }} />;
      case "order": return <OrderFlow customer={selectedCustomer} onBack={navigateBack} onDone={() => { clearCart(); setView("customer"); }} cart={cart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} onViewCart={() => setView("cart")} onViewProduct={navigateToProduct} />;
      case "payment": return <PaymentFlow customer={selectedCustomer} onBack={navigateBack} onDone={() => { queryClient.invalidateQueries({ queryKey: ["collections"] }); queryClient.invalidateQueries({ queryKey: ["route-day"] }); setView("customer"); }} />;
      case "statement": return <StatementView customer={selectedCustomer} onBack={navigateBack} />;
      case "returnedChecks": return <ReturnedChecksView customer={selectedCustomer} onBack={navigateBack} />;
      case "purchase": return <PurchaseFlow customer={selectedCustomer} onBack={navigateBack} onComplete={() => setView("customer")} />;
      default: return null;
    }
  };

  return (
    <AppShell bottomNav={isMainView ? <BottomNav items={bottomNavItems} activeValue={view} onValueChange={(v) => setView(v as View)} /> : undefined}>
      <div className="w-full">
        <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        {isMainView ? renderMainView() : renderSubView()}
      </div>
      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setDeliveryDate(undefined); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirm.orderTitle")}</DialogTitle>
            <DialogDescription>{t("confirm.orderDesc")}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="custom-delivery" checked={customDeliveryDate} onCheckedChange={(checked) => setCustomDeliveryDate(checked as boolean)} />
              <label htmlFor="custom-delivery" className="text-sm text-muted-foreground cursor-pointer">{t("catalog.customDeliveryDate") || "Set custom delivery date"}</label>
            </div>
            <FormField label={t("catalog.deliveryDate")}>
              <DatePicker value={deliveryDate} onChange={setDeliveryDate} placeholder={t("catalog.selectDeliveryDate")} disabled={!customDeliveryDate} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setDeliveryDate(undefined); }} disabled={orderMutation.isPending}>{t("actions.cancel")}</Button>
            <Button onClick={handleConfirmOrder} isLoading={orderMutation.isPending}>{t("actions.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
