import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/hooks/useCart";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartPieIcon, UsersIcon, UserIcon, HomeIcon, DollarSignIcon } from "@/components/ui/animated-icon";

import { AppShell } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { ProfileView } from "@/components/shared/ProfileView";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";

import { getProductName } from "@/lib/product";
import { Overview } from "./Overview";
import { FinanceView } from "./FinanceView";
import { AdminChecksView } from "./AdminChecksView";
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
import { PurchaseFlow } from "@/components/Sales/PurchaseFlow";
import { adminApi } from "@/services/adminApi";
import { salesApi, type Customer, type Product as SalesProduct, type OrderItem, type CartItem } from "@/services/salesApi";
import { getUnitPrice } from "@/lib/cart";
import { syncQueue } from "@/lib/syncQueue";
import { toLocalDateStr } from "@/lib/utils";

type AdminView =
  | "overview" | "sales" | "debt"
  | "checks" | "finance"
  | "customers" | "addCustomer" | "customerDetail" | "editCustomer"
  | "order" | "payment" | "statement" | "purchase"
  | "products" | "addProduct"
  | "cashReport"
  | "profile";

export default function AdminPanel() {
  const { t } = useTranslation();
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
  const [hideNav, setHideNav] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [avatarSeed, setAvatarSeed] = useState(
    () => localStorage.getItem("alofok-avatar-seed") || userId || "admin"
  );
  useEffect(() => {
    localStorage.setItem("alofok-avatar-seed", avatarSeed);
  }, [avatarSeed]);

  /* ---- Cart state ---- */
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart } = useCart();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [customDeliveryDate, setCustomDeliveryDate] = useState(false);

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
      product_id: ci.product.id, name: getProductName(ci.product), quantity: ci.quantity,
      unit_price: getUnitPrice(ci.product, ci.selectedOptions),
      selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    }));
    const payload = {
      customer_id: selectedCustomer.id, items,
      delivery_date: deliveryDate ? toLocalDateStr(deliveryDate) : null,
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
    { icon: ChartPieIcon, label: t("nav.overview"), value: "overview" },
    { icon: HomeIcon, label: t("nav.products"), value: "products" },
    { icon: DollarSignIcon, label: t("nav.finance"), value: "finance" },
    { icon: UsersIcon, label: t("nav.customers"), value: "customers" },
    { icon: UserIcon, label: t("profile.title"), value: "profile" },
  ];

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <Overview onNavigate={(v) => setActiveView(v as AdminView)} />;
      case "finance":
        return <FinanceView onSelectionChange={setHideNav} />;
      case "sales":
        return <SalesStats onBack={() => setActiveView("overview")} />;
      case "debt":
        return <DebtStats onBack={() => setActiveView("overview")} />;
      case "checks":
        return <AdminChecksView />;
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
      case "purchase":
        return selectedCustomer ? (
          <PurchaseFlow
            customer={selectedCustomer}
            onBack={() => setActiveView("customerDetail")}
            onComplete={() => setActiveView("customerDetail")}
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
          <ProfileView
            identitySlot={
              <CardContent className="flex items-center gap-4 p-5">
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
              </CardContent>
            }
            onLogout={() => dispatch(logout())}
          />
        );
      default:
        return <Overview onNavigate={(v) => setActiveView(v as AdminView)} />;
    }
  };

  const isMainView = ["overview", "customers", "products", "addProduct", "finance", "checks", "profile"].includes(activeView);

  const bottomNavActiveValue =
    activeView === "sales" || activeView === "debt" ? "overview"
    : activeView === "checks" || activeView === "cashReport" ? "finance"
    : ["customerDetail", "addCustomer", "editCustomer", "order", "payment", "statement", "purchase"].includes(activeView) ? "customers"
    : activeView === "addProduct" ? "products"
    : activeView;

  return (
    <AppShell
      bottomNav={
        isMainView && !hideNav ? (
          <BottomNav
            items={navItems}
            activeValue={bottomNavActiveValue}
            onValueChange={(v) => setActiveView(v as AdminView)}
          />
        ) : undefined
      }
    >
      <div className="w-full">
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
