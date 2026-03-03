import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Star,
  Tag,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  type Customer,
  type Product,
} from "@/services/salesApi";
import { getImageUrl } from "@/lib/image";
import { salesApi } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
  cart: Map<string, CartItem>;
  addToCart: (product: Product, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  onViewCart?: () => void;
  onViewProduct?: (product: Product) => void;
}

export function OrderFlow({ customer, onBack, onDone: _onDone, cart, addToCart, updateCartQty, removeFromCart: _removeFromCart, onViewCart, onViewProduct }: OrderFlowProps) {
  const { t, i18n } = useTranslation();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("catalog-view") as "grid" | "list") || "grid"
  );
  useEffect(() => {
    localStorage.setItem("catalog-view", viewMode);
  }, [viewMode]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: salesApi.getProducts,
  });

  const cartCount = useMemo(
    () => Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0),
    [cart]
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

  // Helper to apply delta-based quantity updates using the prop
  const applyQtyDelta = useCallback((productId: string, delta: number) => {
    const existing = cart.get(productId);
    if (!existing) return;
    const newQty = existing.quantity + delta;
    updateCartQty(productId, newQty);
  }, [cart, updateCartQty]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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
                      applyQtyDelta(product.id, -1);
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
                      applyQtyDelta(product.id, 1);
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

  const renderGridCard = (product: Product) => {
    const name = i18n.language === "ar" ? product.name_ar : product.name_en;
    const cartQty = cart.get(product.id)?.quantity ?? 0;

    return (
      <div
        key={product.id}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:bg-card-hover active:scale-[0.98]"
        onClick={() => onViewProduct?.(product)}
      >
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
          {cartQty > 0 && (
            <div className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {cartQty}
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-body-sm font-medium text-foreground truncate">{name}</p>
          <div className="flex items-center gap-2 mt-1">
            {product.discounted_price ? (
              <>
                <span className="text-primary font-bold text-body-sm">
                  {formatCurrency(product.discounted_price)}
                </span>
                <span className="text-muted-foreground line-through text-caption">
                  {formatCurrency(product.price)}
                </span>
              </>
            ) : (
              <span className="text-primary font-bold text-body-sm">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
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
            {items.map((p) => renderGridCard(p))}
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
              onClick={() => onViewCart?.()}
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

    </div>
  );
}
