import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Package, PlusCircle, MoreVertical, Pencil } from "lucide-react";

import { designerApi, type Product } from "@/services/designerApi";
import { getImageUrl } from "@/lib/image";
import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ProductListProps {
  onEdit: (product: Product) => void;
  onAdd: () => void;
}

// ── Skeleton Loader ──────────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProductList({ onEdit, onAdd }: ProductListProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [search, setSearch] = useState("");

  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["products"],
    queryFn: designerApi.getProducts,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filtered products based on search
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

  const productName = (p: Product) => (isAr ? p.name_ar : p.name_en);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar
        title={t("nav.products")}
        actions={
          <Button variant="gradient" size="sm" onClick={onAdd}>
            <PlusCircle className="h-4 w-4" />
            {t("nav.addProduct")}
          </Button>
        }
      />

      <PageContainer>
        {/* Stats row */}
        <div className="mb-4">
          <StatCard
            variant="glass"
            icon={Package}
            value={products?.length ?? 0}
            label={t("product.productCount")}
          />
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("catalog.search")}
          />
        </div>

        {/* Error state */}
        {isError && (
          <EmptyState
            preset="error"
            action={{ label: t("actions.retry"), onClick: () => refetch() }}
          />
        )}

        {/* Loading state */}
        {isLoading && <ProductGridSkeleton />}

        {/* Empty state – no products at all */}
        {!isLoading && !isError && products && products.length === 0 && (
          <EmptyState
            preset="no-products"
            action={{ label: t("product.addNew"), onClick: onAdd }}
          />
        )}

        {/* Empty state – search yielded nothing */}
        {!isLoading &&
          !isError &&
          products &&
          products.length > 0 &&
          filtered.length === 0 && <EmptyState preset="no-results" />}

        {/* Product grid */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {filtered.map((product) => (
              <Card
                key={product.id}
                variant="interactive"
                className="group relative overflow-hidden"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {product.image_url ? (
                    <img
                      src={getImageUrl(product.image_url)!}
                      alt={productName(product)}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted-foreground/10">
                        <Package className="h-7 w-7 text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  {/* Badges overlay */}
                  <div className="absolute start-2 top-2 flex flex-col gap-1">
                    {product.is_bestseller && (
                      <Badge variant="warning" size="sm">
                        {t("catalog.bestSellers")}
                      </Badge>
                    )}
                    {product.is_discounted && (
                      <Badge variant="success" size="sm">
                        {t("catalog.discounted")}
                      </Badge>
                    )}
                  </div>

                  {/* Context menu */}
                  <div className="absolute end-2 top-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Info */}
                <CardContent className="p-3 pt-3">
                  <p className="truncate text-body-sm font-semibold text-foreground">
                    {productName(product)}
                  </p>
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {product.sku}
                  </p>
                  <p className="mt-1.5 text-body-sm font-bold text-primary">
                    {formatPrice(product.price)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
