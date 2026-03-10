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
  type CartItem,
  type SelectedOption,
} from "@/services/salesApi";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";
import { cartKey } from "@/lib/cart";
import { salesApi } from "@/services/salesApi";
import { OptionPickerDialog } from "@/components/ui/option-picker-dialog";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";

interface OrderFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
  cart: Map<string, CartItem>;
  addToCart: (product: Product, qty?: number, selectedOptions?: SelectedOption[]) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  onViewCart?: () => void;
  onViewProduct?: (product: Product) => void;
}

export function OrderFlow({ customer, onBack, onDone: _onDone, cart, addToCart, updateCartQty, removeFromCart: _removeFromCart, onViewCart, onViewProduct }: OrderFlowProps) {
  const { t } = useTranslation();

  const [search, setSearch] = useState(
    () => sessionStorage.getItem("order-search") || ""
  );
  useEffect(() => {
    if (search) sessionStorage.setItem("order-search", search);
    else sessionStorage.removeItem("order-search");
  }, [search]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
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
  const applyQtyDelta = useCallback((key: string, delta: number) => {
    const existing = cart.get(key);
    if (!existing) return;
    const newQty = existing.quantity + delta;
    updateCartQty(key, newQty);
  }, [cart, updateCartQty]);

  // Sum all cart entries for a given product (across option combos)
  const productCartQty = useCallback((productId: string) => {
    let total = 0;
    for (const [, item] of cart) {
      if (item.product.id === productId) total += item.quantity;
    }
    return total;
  }, [cart]);

  const hasOptions = (p: Product) => !!p.options?.length;

  const handleAddClick = useCallback((product: Product) => {
    if (hasOptions(product)) {
      setPickerProduct(product);
    } else {
      addToCart(product);
    }
  }, [addToCart]);

  const productName = (p: Product) => getProductName(p);

  const renderProductCard = (product: Product, idx: number) => {
    const key = cartKey(product.id);
    const inCart = cart.get(key);
    const totalQty = productCartQty(product.id);
    const withOptions = hasOptions(product);

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
              {getCoverImage(product) ? (
                <img
                  src={getCoverImage(product)!}
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
              {!withOptions && inCart ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyQtyDelta(key, -1);
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
                      applyQtyDelta(key, 1);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Button
                    size="icon"
                    variant="glass"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddClick(product);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {withOptions && totalQty > 0 && (
                    <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground">
                      {totalQty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGridCard = (product: Product) => {
    const name = getProductName(product);
    const totalQty = productCartQty(product.id);

    return (
      <div
        key={product.id}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:bg-card-hover active:scale-[0.98]"
        onClick={() => onViewProduct?.(product)}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {getCoverImage(product) ? (
            <img
              src={getCoverImage(product)!}
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
                {product.discount_type === "percent" && product.discount_value
                  ? `${product.discount_value}%`
                  : t("catalog.discounted")}
              </Badge>
            )}
          </div>
          {totalQty > 0 && (
            <div className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {totalQty}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
              className="h-9 w-9 rounded-lg"
              title={viewMode === "grid" ? t("catalog.listView") : t("catalog.gridView")}
            >
              {viewMode === "grid" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
            </Button>
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
          value={search}
          placeholder={t("catalog.search")}
          onChange={setSearch}
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

      <OptionPickerDialog
        product={pickerProduct}
        onOpenChange={(open) => { if (!open) setPickerProduct(null); }}
        onAdd={(product, qty, options) => {
          addToCart(product, qty, options);
          setPickerProduct(null);
        }}
      />
    </div>
  );
}
