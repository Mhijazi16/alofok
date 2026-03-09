import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  User,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/useToast";
import { customerApi } from "@/services/customerApi";
import type { DraftOrderItem } from "@/services/customerApi";
import type { Product, CartItem, SelectedOption } from "@/services/salesApi";
import { cartKey, optionsPrice } from "@/lib/cart";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";

import { Dashboard } from "./Dashboard";
import { CatalogView } from "./CatalogView";
import { OrdersView } from "./OrdersView";
import { CustomerStatementView } from "./StatementView";
import { ProfileView } from "./ProfileView";

type View = "dashboard" | "catalog" | "cart" | "orders" | "profile" | "statement";

/* ------------------------------------------------------------------ */
/*  CartView — inline sub-component                                    */
/* ------------------------------------------------------------------ */
interface CartViewProps {
  cart: Map<string, CartItem>;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  onSubmitOrder: () => void;
  onBrowse: () => void;
}

function CartView({
  cart,
  updateCartQty,
  removeFromCart,
  clearCart,
  cartTotal,
  onSubmitOrder,
  onBrowse,
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
          action={{ label: t("portal.catalog"), onClick: onBrowse }}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 me-1" />
            {t("actions.delete")}
          </Button>
        }
      />

      <div className="space-y-3 p-4">
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
                        {formatCurrency(unitPrice)} × {ci.quantity}
                      </p>
                      <p className="text-body-sm font-bold text-primary mt-0.5">
                        {formatCurrency(unitPrice * ci.quantity)}
                      </p>
                    </div>

                    {/* Controls */}
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
            onClick={onSubmitOrder}
          >
            <ShoppingCart className="h-5 w-5 me-2" />
            {t("portal.submitDraft")}
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
/*  CustomerRoot                                                        */
/* ------------------------------------------------------------------ */
export default function CustomerRoot() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("dashboard");
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ---- Cart state persisted to localStorage ---- */
  const [cart, setCart] = useState<Map<string, CartItem>>(() => {
    try {
      const saved = localStorage.getItem("alofok-customer-cart");
      if (saved) {
        const entries = JSON.parse(saved) as [string, CartItem][];
        return new Map(entries);
      }
    } catch {
      /* ignore */
    }
    return new Map();
  });

  useEffect(() => {
    localStorage.setItem("alofok-customer-cart", JSON.stringify([...cart]));
  }, [cart]);

  /* ---- Cart helpers ---- */
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
          sum +
          ((item.product.discounted_price ?? item.product.price) + optionsPrice(item.selectedOptions)) * item.quantity,
        0
      ),
    [cart]
  );

  /* ---- Draft order mutation ---- */
  const draftMutation = useMutation({
    mutationFn: customerApi.createDraftOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      clearCart();
      toast({ title: t("portal.draftSubmitted"), variant: "success" });
      setView("orders");
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleSubmitOrder = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmOrder = useCallback(() => {
    const items: DraftOrderItem[] = Array.from(cart.values()).map((ci) => ({
      product_id: ci.product.id,
      name: getProductName(ci.product),
      image_url: ci.product.image_urls?.[0] ?? null,
      quantity: ci.quantity,
      unit_price: (ci.product.discounted_price ?? ci.product.price) + optionsPrice(ci.selectedOptions),
      selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    }));
    draftMutation.mutate({ items });
    setConfirmOpen(false);
  }, [cart, draftMutation]);

  /* ---- Navigation ---- */
  const handleNavigate = useCallback((v: string) => {
    setView(v as View);
  }, []);

  const bottomNavItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), value: "dashboard" },
    { icon: Package, label: t("portal.catalog"), value: "catalog" },
    {
      icon: ShoppingCart,
      label: t("cart.title"),
      value: "cart",
      badge: cart.size || undefined,
    },
    { icon: FileText, label: t("portal.orders"), value: "orders" },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const renderView = () => {
    switch (view) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;

      case "catalog":
        return (
          <CatalogView
            addToCart={addToCart}
            cartSize={cart.size}
            onViewCart={() => setView("cart")}
            cart={cart}
            updateCartQty={updateCartQty}
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
            onSubmitOrder={handleSubmitOrder}
            onBrowse={() => setView("catalog")}
          />
        );

      case "orders":
        return <OrdersView />;

      case "statement":
        return <CustomerStatementView />;

      case "profile":
        return <ProfileView />;

      default:
        return null;
    }
  };

  return (
    <AppShell
      bottomNav={
        <BottomNav
          items={bottomNavItems}
          activeValue={view}
          onValueChange={(v) => setView(v as View)}
        />
      }
    >
      <div className="max-w-2xl mx-auto w-full px-4">
        {renderView()}
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("portal.confirmDraftTitle")}
        description={t("portal.confirmDraftDesc")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={handleConfirmOrder}
        isLoading={draftMutation.isPending}
      />
    </AppShell>
  );
}
