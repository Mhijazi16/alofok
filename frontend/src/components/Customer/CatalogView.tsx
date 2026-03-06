import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Minus,
  Star,
  Tag,
  LayoutGrid,
  List,
  ShoppingCart,
} from "lucide-react";
import { customerApi } from "@/services/customerApi";
import type { Product, SelectedOption } from "@/services/salesApi";
import { getCoverImage } from "@/lib/image";
import { cartKey } from "@/lib/cart";
import { OptionPickerDialog } from "@/components/ui/option-picker-dialog";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CatalogViewProps {
  addToCart: (product: Product, qty?: number, selectedOptions?: SelectedOption[]) => void;
  cartSize: number;
  onViewCart: () => void;
  cart: Map<string, { product: Product; quantity: number; selectedOptions?: SelectedOption[] }>;
  updateCartQty: (key: string, qty: number) => void;
}

export function CatalogView({
  addToCart,
  cartSize,
  onViewCart,
  cart,
  updateCartQty,
}: CatalogViewProps) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("portal-catalog-view") as "grid" | "list") || "grid"
  );

  useEffect(() => {
    localStorage.setItem("portal-catalog-view", viewMode);
  }, [viewMode]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["customer-catalog"],
    queryFn: customerApi.getCatalog,
    staleTime: 10 * 60 * 1000,
  });

  const productName = (p: Product) =>
    i18n.language === "ar" ? p.name_ar : p.name_en;

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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

  const bestSellers = useMemo(() => filtered.filter((p) => p.is_bestseller), [filtered]);
  const discounted = useMemo(() => filtered.filter((p) => p.is_discounted), [filtered]);

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

  const handleQtyDelta = (key: string, delta: number) => {
    const existing = cart.get(key);
    if (!existing) return;
    updateCartQty(key, existing.quantity + delta);
  };

  const renderListCard = (product: Product, idx: number) => {
    const key = cartKey(product.id);
    const inCart = cart.get(key);
    const totalQty = productCartQty(product.id);
    const withOptions = hasOptions(product);

    return (
      <Card
        key={product.id}
        variant="interactive"
        className="animate-slide-up overflow-hidden"
        style={{ animationDelay: `${idx * 35}ms` }}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted overflow-hidden">
              {getCoverImage(product) ? (
                <img
                  src={getCoverImage(product)!}
                  alt={productName(product)}
                  className="h-full w-full rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

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
                    {product.discount_type === "percent" && product.discount_value
                      ? `-${product.discount_value}%`
                      : t("catalog.discounted")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {product.discounted_price ? (
                  <>
                    <span className="text-body-sm font-bold text-primary">
                      {formatCurrency(product.discounted_price)}
                    </span>
                    <span className="text-caption text-muted-foreground line-through">
                      {formatCurrency(product.price)}
                    </span>
                  </>
                ) : (
                  <span className="text-body-sm font-bold text-primary">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {!withOptions && inCart ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQtyDelta(key, -1);
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
                      handleQtyDelta(key, 1);
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
    const name = productName(product);
    const totalQty = productCartQty(product.id);

    return (
      <div
        key={product.id}
        className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:bg-card-hover active:scale-[0.98]"
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
                <Tag className="h-3 w-3 me-0.5" />
                {product.discount_type === "percent" && product.discount_value
                  ? `-${product.discount_value}%`
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
          <Button
            variant={totalQty > 0 ? "outline" : "gradient"}
            size="sm"
            className="w-full mt-2"
            onClick={() => handleAddClick(product)}
          >
            <Plus className="h-3.5 w-3.5 me-1" />
            {totalQty > 0
              ? t("portal.addMore", { count: totalQty })
              : t("portal.addToCart")}
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: Product[], startIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <Separator label={title} />
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((p) => renderGridCard(p))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p, i) => renderListCard(p, startIdx + i))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("portal.catalog")}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={viewMode === "grid" ? t("catalog.listView") : t("catalog.gridView")}
            >
              {viewMode === "grid" ? (
                <List className="h-5 w-5" />
              ) : (
                <LayoutGrid className="h-5 w-5" />
              )}
            </button>
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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState preset="no-results" />
          ) : (
            <EmptyState preset="no-products" />
          )
        ) : (
          <div className="space-y-4">
            {renderSection(t("catalog.bestSellers"), bestSellers, 0)}
            {renderSection(t("catalog.discounted"), discounted, bestSellers.length)}
            {renderSection(
              t("catalog.allProducts"),
              filtered,
              bestSellers.length + discounted.length
            )}
          </div>
        )}
      </div>

      {/* Floating cart FAB */}
      {cartSize > 0 && (
        <button
          type="button"
          onClick={onViewCart}
          className={cn(
            "fixed bottom-24 end-4 z-50 flex items-center gap-2 rounded-2xl",
            "bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/30",
            "transition-all duration-200 hover:bg-primary/90 active:scale-95",
            "animate-scale-in"
          )}
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="text-body-sm font-bold">
            {t("portal.cartItems", { count: cartSize })}
          </span>
        </button>
      )}

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
