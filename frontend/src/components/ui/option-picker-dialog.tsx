import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Minus, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCoverImage } from "@/lib/image";
import { optionsPrice } from "@/lib/cart";
import type { Product, SelectedOption } from "@/services/salesApi";

interface OptionPickerDialogProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (product: Product, qty: number, options: SelectedOption[]) => void;
}

export function OptionPickerDialog({
  product,
  onOpenChange,
  onAdd,
}: OptionPickerDialogProps) {
  const { t, i18n } = useTranslation();
  const [selections, setSelections] = useState<Record<string, SelectedOption>>(
    {}
  );
  const [qty, setQty] = useState(1);

  const options = product?.options ?? [];

  const allSelected = options.length > 0 && options.every((og) => selections[og.name]);

  const selectedList = useMemo(
    () => Object.values(selections),
    [selections]
  );

  const basePrice = product
    ? (product.discounted_price ?? product.price)
    : 0;
  const total = (basePrice + optionsPrice(selectedList)) * qty;

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const productName = product
    ? i18n.language === "ar"
      ? product.name_ar
      : product.name_en
    : "";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelections({});
      setQty(1);
    }
    onOpenChange(open);
  };

  const handleAdd = () => {
    if (!product || !allSelected) return;
    onAdd(product, qty, selectedList);
    setSelections({});
    setQty(1);
  };

  return (
    <Dialog open={!!product} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("product.selectOptions")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("product.selectOptions")}
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Product header */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted overflow-hidden">
                {getCoverImage(product) ? (
                  <img
                    src={getCoverImage(product)!}
                    alt={productName}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-foreground truncate">
                  {productName}
                </p>
                <p className="text-caption text-muted-foreground">
                  {formatCurrency(basePrice)}
                </p>
              </div>
            </div>

            {/* Option groups */}
            {options.map((og) => (
              <div key={og.name} className="space-y-2">
                <p className="text-body-sm font-medium text-foreground">
                  {og.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {og.values.map((v) => {
                    const isSelected =
                      selections[og.name]?.value === v.label;
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() =>
                          setSelections((prev) => ({
                            ...prev,
                            [og.name]: {
                              name: og.name,
                              value: v.label,
                              price_modifier: v.price_modifier,
                            },
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-medium"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        {v.label}
                        {v.price_modifier !== 0 && (
                          <Badge
                            variant={v.price_modifier > 0 ? "default" : "success"}
                            size="sm"
                            className="text-[0.6rem]"
                          >
                            {v.price_modifier > 0 ? "+" : ""}
                            {formatCurrency(v.price_modifier)}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <p className="text-body-sm font-medium text-foreground">
                {t("catalog.qty")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[2rem] text-center text-body-sm font-bold text-foreground">
                  {qty}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => setQty((q) => q + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
              <span className="text-body-sm text-muted-foreground">
                {t("product.totalPrice")}
              </span>
              <span className="text-body-sm font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleAdd} disabled={!allSelected}>
            {t("product.addToCart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
