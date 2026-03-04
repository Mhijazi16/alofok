import { useTranslation } from "react-i18next";
import {
  Package,
  Star,
  Tag,
  Weight,
  Layers,
  Box,
  Settings2,
} from "lucide-react";
import type { Product } from "@/services/salesApi";
import { getCoverImage } from "@/lib/image";
import { TopBar } from "@/components/ui/top-bar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

function discountBadgeLabel(product: Product): string | null {
  if (!product.is_discounted || !product.discount_value) return null;
  if (product.discount_type === "percent") return `${product.discount_value}%`;
  if (product.discount_type === "fixed") return formatPrice(product.discount_value);
  return null;
}

interface ProductDetailProps {
  product: Product;
  onBack?: () => void;
  /** Renders at the bottom — "Edit" for Designer, "Add to Cart" for Sales */
  actions?: React.ReactNode;
  /** When true, skip TopBar and use a smaller hero image */
  embedded?: boolean;
}

export function ProductDetail({ product, onBack, actions, embedded }: ProductDetailProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const name = isAr ? product.name_ar : product.name_en;
  const description = isAr ? product.description_ar : product.description_en;
  const coverUrl = getCoverImage(product);

  const stockColor =
    (product.stock_qty ?? 0) > 10
      ? "text-success"
      : (product.stock_qty ?? 0) > 0
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="animate-fade-in">
      {!embedded && onBack && (
        <TopBar
          title={name}
          backButton={{ onBack }}
        />
      )}

      {/* Hero image */}
      <div className={cn("relative w-full overflow-hidden bg-muted", embedded ? "aspect-video" : "aspect-square")}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-20 w-20 text-muted-foreground/20" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute start-3 top-3 flex flex-col gap-1.5">
          {product.is_bestseller && (
            <Badge variant="warning">
              <Star className="h-3 w-3 me-1" />
              {t("catalog.bestSellers")}
            </Badge>
          )}
          {product.is_discounted && (
            <Badge variant="success">
              <Tag className="h-3 w-3 me-1" />
              {discountBadgeLabel(product) ?? t("catalog.discounted")}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-4">
        {/* Name + SKU */}
        <div>
          <h2 className="text-h3 font-bold text-foreground">{name}</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {product.sku}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-3">
          {product.is_discounted && product.discounted_price ? (
            <>
              <span className="text-h2 font-bold text-primary">
                {formatPrice(product.discounted_price)}
              </span>
              <span className="text-body text-muted-foreground line-through">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            <span className="text-h2 font-bold text-primary">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <div>
            <p className="text-body text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Stock */}
          {product.stock_qty != null && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Box className="h-4 w-4" />
                <span className="text-caption">{t("product.stockQty")}</span>
              </div>
              <p className={cn("mt-1 text-body font-bold", stockColor)}>
                {product.stock_qty}
              </p>
            </div>
          )}

          {/* Unit */}
          {product.unit && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <span className="text-caption">{t("product.unit")}</span>
              </div>
              <p className="mt-1 text-body font-bold text-foreground">
                {t(`product.unitOptions.${product.unit}`)}
              </p>
            </div>
          )}

          {/* Weight */}
          {product.weight != null && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Weight className="h-4 w-4" />
                <span className="text-caption">{t("product.weight")}</span>
              </div>
              <p className="mt-1 text-body font-bold text-foreground">
                {product.weight} kg
              </p>
            </div>
          )}

          {/* Category */}
          {product.category && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-caption">{t("product.category")}</span>
              </div>
              <p className="mt-1 text-body font-bold text-foreground">
                {product.category}
              </p>
            </div>
          )}
        </div>

        {/* Trademark */}
        {product.trademark && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-caption text-muted-foreground">
              {t("product.trademark")}
            </p>
            <p className="mt-1 text-body font-bold text-foreground">
              {product.trademark}
            </p>
          </div>
        )}

        {/* Options */}
        {product.options && product.options.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              <span className="text-caption">{t("product.options")}</span>
            </div>
            <div className="space-y-3">
              {product.options.map((opt) => (
                <div key={opt.id ?? opt.name} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-body-sm font-semibold text-foreground mb-1.5">
                    {opt.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {opt.values.map((v) => (
                      <Badge key={v.label} variant="outline" size="sm">
                        {v.label}
                        {v.price_modifier !== 0 && (
                          <span className="ms-1 text-primary">
                            {v.price_modifier > 0 ? "+" : ""}
                            {formatPrice(v.price_modifier)}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        {actions && <div className="pt-2 pb-4">{actions}</div>}
      </div>
    </div>
  );
}
