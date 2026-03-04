import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  User,
  LogOut,
  Globe,
  Package,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";

import { Overview } from "./Overview";
import { SalesStats } from "./SalesStats";
import { DebtStats } from "./DebtStats";
import { ProductList } from "@/components/Designer/ProductList";
import { ProductForm } from "@/components/Designer/ProductForm";
import { AllCustomersView } from "@/components/Sales/AllCustomersView";
import { CustomerForm } from "@/components/Sales/CustomerForm";
import { CustomerDashboard } from "@/components/Sales/CustomerDashboard";
import { OrderFlow } from "@/components/Sales/OrderFlow";
import { PaymentFlow } from "@/components/Sales/PaymentFlow";
import { StatementView } from "@/components/Sales/StatementView";
import { adminApi } from "@/services/adminApi";
import { salesApi, type Customer, type Product as SalesProduct, type OrderItem, type CartItem, type SelectedOption } from "@/services/salesApi";
import { cartKey, optionsPrice } from "@/lib/cart";
import { syncQueue } from "@/lib/syncQueue";

type AdminView =
  | "overview" | "sales" | "debt"
  | "customers" | "addCustomer" | "customerDetail" | "editCustomer"
  | "order" | "payment" | "statement"
  | "products" | "addProduct"
  | "profile";

export default function AdminPanel() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const userId = useAppSelector((s) => s.auth.userId);
  const role = useAppSelector((s) => s.auth.role);

  const { data: salesReps = [] } = useQuery({
    queryKey: ["admin-sales-reps"],
    queryFn: adminApi.getSalesReps,
  });

  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [avatarSeed, setAvatarSeed] = useState(
    () => localStorage.getItem("alofok-avatar-seed") || userId || "admin"
  );
  useEffect(() => {
    localStorage.setItem("alofok-avatar-seed", avatarSeed);
  }, [avatarSeed]);

  /* ---- Cart state ---- */
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [customDeliveryDate, setCustomDeliveryDate] = useState(false);

  const addToCart = useCallback((product: SalesProduct, qty: number = 1, selectedOptions?: SelectedOption[]) => {
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
      if (qty <= 0) { next.delete(productId); }
      else {
        const existing = next.get(productId);
        if (existing) next.set(productId, { ...existing, quantity: qty });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => { const next = new Map(prev); next.delete(productId); return next; });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);

  /* ---- Order mutation ---- */
  const orderMutation = useMutation({
    mutationFn: salesApi.createOrder,
    onSuccess: () => {
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: ["insights", selectedCustomer.id] });
        queryClient.invalidateQueries({ queryKey: ["statement", selectedCustomer.id] });
      }
      clearCart();
      toast({ title: t("catalog.orderSuccess"), variant: "success" });
      setActiveView("customerDetail");
    },
    onError: () => { toast({ title: t("toast.error"), variant: "error" }); },
  });

  const handleConfirmOrder = useCallback(async () => {
    if (!selectedCustomer) return;
    const items: OrderItem[] = Array.from(cart.values()).map((ci) => ({
      product_id: ci.product.id, quantity: ci.quantity,
      unit_price: (ci.product.discounted_price ?? ci.product.price) + optionsPrice(ci.selectedOptions),
      selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    }));
    const payload = {
      customer_id: selectedCustomer.id, items,
      delivery_date: deliveryDate ? deliveryDate.toISOString().split("T")[0] : null,
    };
    if (isOnline) { orderMutation.mutate(payload); }
    else {
      await syncQueue.push("order", payload);
      clearCart();
      toast({ title: t("catalog.orderQueued"), variant: "success" });
      setActiveView("customerDetail");
    }
    setConfirmOpen(false);
    setDeliveryDate(undefined);
  }, [selectedCustomer, cart, isOnline, orderMutation, clearCart, toast, t, deliveryDate]);

  const navItems = [
    { icon: LayoutDashboard, label: t("nav.overview"), value: "overview" },
    { icon: Package, label: t("nav.products"), value: "products" },
    { icon: Users, label: t("nav.customers"), value: "customers" },
    { icon: User, label: t("profile.title"), value: "profile" },
  ];

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <Overview />;
      case "sales":
        return <SalesStats />;
      case "debt":
        return <DebtStats />;
      case "customers":
        return (
          <AllCustomersView
            queryKey={["admin-customers"]}
            queryFn={adminApi.getAllCustomers}
            onSelectCustomer={(customer) => {
              setSelectedCustomer(customer);
              setActiveView("customerDetail");
            }}
            onAddCustomer={() => setActiveView("addCustomer")}
            showInteractive={true}
          />
        );
      case "customerDetail":
        return selectedCustomer ? (
          <CustomerDashboard
            customer={selectedCustomer}
            onBack={() => {
              setSelectedCustomer(null);
              setActiveView("customers");
            }}
            onAction={(action) => {
              if (action === "check") setActiveView("statement");
              else setActiveView(action as AdminView);
            }}
            onEditCustomer={(customer) => {
              setEditingCustomer(customer);
              setActiveView("editCustomer");
            }}
          />
        ) : null;
      case "order":
        return selectedCustomer ? (
          <OrderFlow
            customer={selectedCustomer}
            onBack={() => setActiveView("customerDetail")}
            onDone={() => { clearCart(); setActiveView("customerDetail"); }}
            cart={cart}
            addToCart={addToCart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            onViewCart={() => {}}
            onViewProduct={() => {}}
          />
        ) : null;
      case "payment":
        return selectedCustomer ? (
          <PaymentFlow
            customer={selectedCustomer}
            onBack={() => setActiveView("customerDetail")}
            onDone={() => setActiveView("customerDetail")}
          />
        ) : null;
      case "statement":
        return selectedCustomer ? (
          <StatementView
            customer={selectedCustomer}
            onBack={() => setActiveView("customerDetail")}
          />
        ) : null;
      case "editCustomer":
        return editingCustomer ? (
          <CustomerForm
            customer={editingCustomer}
            salesReps={salesReps}
            createFn={adminApi.updateCustomer.bind(null, editingCustomer.id)}
            onDone={() => {
              setEditingCustomer(undefined);
              setActiveView("customerDetail");
              queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
            }}
            onBack={() => {
              setEditingCustomer(undefined);
              setActiveView("customerDetail");
            }}
          />
        ) : null;
      case "addCustomer":
        return (
          <CustomerForm
            salesReps={salesReps}
            onDone={() => {
              setActiveView("customers");
              queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
            }}
            onBack={() => setActiveView("customers")}
            createFn={adminApi.createCustomer}
          />
        );
      case "products":
        return (
          <ProductList
            onAdd={() => setActiveView("addProduct")}
          />
        );
      case "addProduct":
        return (
          <ProductForm
            onDone={() => setActiveView("products")}
            onBack={() => setActiveView("products")}
          />
        );
      case "profile":
        return (
          <PageContainer>
            <div className="mx-auto max-w-md space-y-6">
              <h2 className="text-h2 font-bold text-foreground">
                {t("profile.title")}
              </h2>

              <Card variant="glass">
                <CardContent className="p-6 space-y-5">
                  {/* User info */}
                  <div className="flex items-center gap-4">
                    <AvatarPicker
                      currentSeed={avatarSeed}
                      onSelect={setAvatarSeed}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-semibold text-foreground truncate">
                        {userId ?? "—"}
                      </p>
                      <Badge variant="default" size="sm" className="mt-1">
                        {role ?? "—"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Language toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span className="text-body-sm">{t("profile.language")}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleLanguage}>
                      {i18n.language === "ar"
                        ? t("profile.english")
                        : t("profile.arabic")}
                    </Button>
                  </div>

                  <Separator />

                  {/* Version */}
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-muted-foreground">
                      {t("profile.version")}
                    </span>
                    <span className="text-foreground font-medium tabular-nums">
                      1.0.0
                    </span>
                  </div>

                  <Separator />

                  {/* Logout */}
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </PageContainer>
        );
      default:
        return <Overview />;
    }
  };

  const isMainView = ["overview", "customers", "products", "addProduct", "profile"].includes(activeView);

  const bottomNavActiveValue =
    activeView === "sales" || activeView === "debt" ? "overview"
    : ["customerDetail", "addCustomer", "editCustomer", "order", "payment", "statement"].includes(activeView) ? "customers"
    : activeView === "addProduct" ? "products"
    : activeView;

  return (
    <AppShell
      bottomNav={
        isMainView ? (
          <BottomNav
            items={navItems}
            activeValue={bottomNavActiveValue}
            onValueChange={(v) => setActiveView(v as AdminView)}
          />
        ) : undefined
      }
    >
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-8">
        {renderView()}
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
                id="admin-custom-delivery"
                checked={customDeliveryDate}
                onCheckedChange={(checked) => setCustomDeliveryDate(checked as boolean)}
              />
              <label htmlFor="admin-custom-delivery" className="text-sm text-muted-foreground cursor-pointer">
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
