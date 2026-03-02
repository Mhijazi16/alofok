import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Trash2,
  Star,
  Tag,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  salesApi,
  type Customer,
  type Product,
  type OrderItem,
} from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { getImageUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";


interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

function ProductGridCard({
  product,
  expanded,
  onToggle,
  onAddToCart,
  cartQty,
}: {
  product: Product;
  expanded: boolean;
  onToggle: () => void;
  onAddToCart: (product: Product, qty: number) => void;
  cartQty: number;
}) {
  const { t, i18n } = useTranslation();
  const [qty, setQty] = useState(1);
  const lang = i18n.language;
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const description = lang === "ar" ? product.description_ar : product.description_en;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300">
      {/* Image */}
      <button onClick={onToggle} className="w-full text-start">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={getImageUrl(product.image_url)!}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-2 start-2 flex flex-col gap-1">
            {product.is_bestseller && (
              <Badge variant="warning" className="text-[0.6rem]">
                <Star className="h-3 w-3 me-0.5" /> {t("catalog.bestSellers")}
              </Badge>
            )}
            {product.is_discounted && (
              <Badge variant="success" className="text-[0.6rem]">
                <Tag className="h-3 w-3 me-0.5" />{" "}
                {product.discount_percentage
                  ? `${product.discount_percentage}%`
                  : t("catalog.discounted")}
              </Badge>
            )}
          </div>
          {/* Cart indicator */}
          {cartQty > 0 && (
            <div className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {cartQty}
            </div>
          )}
        </div>
        {/* Info below image */}
        <div className="p-3">
          <p className="text-body-sm font-medium text-foreground truncate">
            {name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {product.discounted_price ? (
              <>
                <span className="text-primary font-bold text-body-sm">
                  {new Intl.NumberFormat(lang, {
                    style: "currency",
                    currency: "ILS",
                  }).format(product.discounted_price)}
                </span>
                <span className="text-muted-foreground line-through text-caption">
                  {new Intl.NumberFormat(lang, {
                    style: "currency",
                    currency: "ILS",
                  }).format(product.price)}
                </span>
              </>
            ) : (
              <span className="text-primary font-bold text-body-sm">
                {new Intl.NumberFormat(lang, {
                  style: "currency",
                  currency: "ILS",
                }).format(product.price)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expandable section */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-border p-3 space-y-3">
          {description && (
            <p className="text-caption text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          {product.unit && product.unit !== "piece" && (
            <Badge variant="outline" className="text-[0.6rem]">
              {t(`product.unitOptions.${product.unit}`)}
            </Badge>
          )}
          {/* Quantity picker */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-body-sm font-medium w-8 text-center">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="gradient"
            size="sm"
            className="w-full"
            onClick={() => {
              onAddToCart(product, qty);
              setQty(1);
            }}
          >
            <ShoppingCart className="h-4 w-4 me-1.5" />
            {t("catalog.addToOrder")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrderFlow({ customer, onBack, onDone }: OrderFlowProps) {
  const { t, i18n } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("catalog-view") as "grid" | "list") || "grid"
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("catalog-view", viewMode);
  }, [viewMode]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: salesApi.getProducts,
  });

  const orderMutation = useMutation({
    mutationFn: salesApi.createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
      toast({ title: t("catalog.orderSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
  const cartCount = useMemo(
    () => cartItems.reduce((s, i) => s + i.quantity, 0),
    [cartItems]
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cartItems]
  );

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name_ar.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const bestSellers = useMemo(
    () => filtered.filter((p) => p.is_bestseller),
    [filtered]
  );
  const discounted = useMemo(
    () => filtered.filter((p) => p.is_discounted),
    [filtered]
  );
  const allProducts = filtered;

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

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, { ...existing, quantity: newQty });
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

  const formatCurrency = (val: number) =>
    val.toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleSubmit = async () => {
    const items: OrderItem[] = cartItems.map((ci) => ({
      product_id: ci.product.id,
      quantity: ci.quantity,
      unit_price: ci.product.price,
    }));

    const payload = { customer_id: customer.id, items };

    if (isOnline) {
      orderMutation.mutate(payload);
    } else {
      await syncQueue.push("order", payload);
      toast({ title: t("catalog.orderQueued"), variant: "success" });
      onDone();
    }
    setConfirmOpen(false);
  };

  const productName = (p: Product) =>
    i18n.language === "ar" ? p.name_ar : p.name_en;

  const renderProductCard = (product: Product, idx: number) => {
    const inCart = cart.get(product.id);

    return (
      <Card
        key={product.id}
        variant="interactive"
        className="animate-slide-up overflow-hidden"
        style={{ animationDelay: `${idx * 40}ms` }}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Product image or placeholder */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
              {product.image_url ? (
                <img
                  src={getImageUrl(product.image_url)!}
                  alt={productName(product)}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-foreground truncate">
                {productName(product)}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" size="sm">
                  {product.sku}
                </Badge>
                {product.is_bestseller && (
                  <Badge variant="warning" size="sm">
                    <Star className="h-2.5 w-2.5 me-0.5" />
                    {t("catalog.bestSellers")}
                  </Badge>
                )}
                {product.is_discounted && (
                  <Badge variant="success" size="sm">
                    <Tag className="h-2.5 w-2.5 me-0.5" />
                    {t("catalog.discounted")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-body-sm font-bold text-primary">
                {formatCurrency(product.price)}
              </p>
            </div>

            {/* Add/Qty controls */}
            <div className="shrink-0">
              {inCart ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateQty(product.id, -1);
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="min-w-[1.5rem] text-center text-body-sm font-bold text-foreground">
                    {inCart.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateQty(product.id, 1);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="glass"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSection = (
    title: string,
    items: Product[],
    startIdx: number
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <Separator label={title} />
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((p) => (
              <ProductGridCard
                key={p.id}
                product={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId((prev) => (prev === p.id ? null : p.id))}
                onAddToCart={(product, qty) => addToCart(product, qty)}
                cartQty={cart.get(p.id)?.quantity ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p, i) => renderProductCard(p, startIdx + i))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("actions.order")}
        subtitle={customer.name}
        backButton={{ onBack }}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={viewMode === "grid" ? t("catalog.listView") : t("catalog.gridView")}
            >
              {viewMode === "grid" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
            </button>
            <Button
              variant="glass"
              size="sm"
              className="relative"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <SearchInput
          placeholder={t("catalog.search")}
          onSearch={setSearch}
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : allProducts.length === 0 ? (
          search.trim() ? (
            <EmptyState preset="no-results" />
          ) : (
            <EmptyState preset="no-products" />
          )
        ) : (
          <div className="space-y-4">
            {renderSection(t("catalog.bestSellers"), bestSellers, 0)}
            {renderSection(
              t("catalog.discounted"),
              discounted,
              bestSellers.length
            )}
            {renderSection(
              t("catalog.allProducts"),
              allProducts,
              bestSellers.length + discounted.length
            )}
          </div>
        )}
      </div>

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("catalog.cart")} ({cartCount} {t("catalog.itemCount")})
            </DialogTitle>
            <DialogDescription>{customer.name}</DialogDescription>
          </DialogHeader>

          {cartItems.length === 0 ? (
            <EmptyState
              preset="no-data"
              title={t("catalog.cartEmpty")}
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {cartItems.map((ci) => (
                <div
                  key={ci.product.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {ci.product.image_url ? (
                      <img
                        src={getImageUrl(ci.product.image_url)!}
                        alt={productName(ci.product)}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-foreground truncate">
                      {productName(ci.product)}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {formatCurrency(ci.product.price)} x {ci.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQty(ci.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="min-w-[1.5rem] text-center text-body-sm font-bold">
                      {ci.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQty(ci.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(ci.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              <Separator />

              <StatCard
                variant="gradient"
                value={formatCurrency(cartTotal)}
                label={t("catalog.total")}
                icon={ShoppingCart}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)}>
              {t("actions.close")}
            </Button>
            <Button
              variant="gradient"
              disabled={cartItems.length === 0}
              onClick={() => {
                setCartOpen(false);
                setConfirmOpen(true);
              }}
            >
              {t("catalog.confirmOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirm.orderTitle")}
        description={t("confirm.orderDesc")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={handleSubmit}
        isLoading={orderMutation.isPending}
      />
    </div>
  );
}
