import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, PlusCircle, Copy, Trash2 } from "lucide-react";

import { designerApi, type Product } from "@/services/designerApi";
import { useToast } from "@/hooks/useToast";
import { getCoverImage } from "@/lib/image";
import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ProductDetail } from "@/components/ui/product-detail";
import { ProductForm } from "./ProductForm";

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
  onAdd: () => void;
}

// ── Skeleton Loader ──────────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

export function ProductList({ onAdd }: ProductListProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogTab, setDialogTab] = useState<"details" | "edit">("details");

  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["products"],
    queryFn: designerApi.getProducts,
    staleTime: 10 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => designerApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("product.deletedSuccess"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => designerApi.duplicateProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("product.duplicatedSuccess"), variant: "success" });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
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

      <PageContainer maxWidth="full">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((product) => (
              <Card
                key={product.id}
                variant="interactive"
                className="group relative cursor-pointer overflow-hidden"
                onClick={() => {
                  setDialogProduct(product);
                  setDialogTab("details");
                }}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {getCoverImage(product) ? (
                    <img
                      src={getCoverImage(product)!}
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

                  {/* Per-card action buttons */}
                  <div className="absolute end-2 top-2 flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateMutation.mutate(product.id);
                      }}
                      title={t("actions.duplicate")}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-destructive hover:bg-black/80 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(product);
                      }}
                      title={t("actions.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

      {/* Single-product Delete Confirmation */}
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("product.delete")}
        description={t("product.confirmDelete")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Product Dialog (Details + Edit tabs) */}
      <Dialog
        open={dialogProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDialogProduct(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {dialogProduct && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isAr ? dialogProduct.name_ar : dialogProduct.name_en}
                </DialogTitle>
              </DialogHeader>

              <Tabs
                value={dialogTab}
                onValueChange={(v) => setDialogTab(v as "details" | "edit")}
              >
                <TabsList variant="segment" className="w-full">
                  <TabsTrigger value="details">
                    {t("product.detailsTab")}
                  </TabsTrigger>
                  <TabsTrigger value="edit">
                    {t("product.editTab")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <ProductDetail product={dialogProduct} embedded />
                </TabsContent>

                <TabsContent value="edit">
                  <ProductForm
                    product={dialogProduct}
                    embedded
                    onBack={() => setDialogProduct(null)}
                    onDone={() => {
                      setDialogProduct(null);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
