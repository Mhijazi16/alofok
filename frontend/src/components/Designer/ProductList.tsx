import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Tag, Star } from "lucide-react";
import { designerApi, type Product } from "@/services/designerApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductListProps {
  onAdd: () => void;
  onEdit: (product: Product) => void;
}

export default function ProductList({ onAdd, onEdit }: ProductListProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: designerApi.getProducts,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-3 border-b border-border bg-card">
        <h1 className="text-lg font-black text-primary">{t("app.name")}</h1>
        <Button size="sm" onClick={onAdd}>
          <Plus className="me-1 h-4 w-4" />
          {t("product.addNew")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : !products?.length ? (
          <p className="text-center text-muted-foreground py-12">
            {t("product.noProducts")}
          </p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              {/* Thumbnail */}
              <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-muted">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                    —
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <p className="font-semibold truncate">
                  {isAr ? p.name_ar : p.name_en}
                </p>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">
                    {Number(p.price).toLocaleString("ar-SA")}
                  </span>
                  {p.is_discounted && (
                    <Badge variant="warning">
                      <Tag className="me-1 h-3 w-3" />
                      {t("product.isDiscounted")}
                    </Badge>
                  )}
                  {p.is_bestseller && (
                    <Badge variant="default">
                      <Star className="me-1 h-3 w-3" />
                      {t("product.isBestseller")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Edit */}
              <button
                onClick={() => onEdit(p)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-accent"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
