import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Minus,
  Trash2,
  ArrowDownToLine,
} from "@/lib/icons";
import {
  salesApi,
  type Customer,
  type Product,
  type PurchaseItem,
  type PurchaseCreate,
} from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FadeIn } from "@/components/ui/fade-in";

interface PurchaseFlowProps {
  customer: Customer;
  onBack: () => void;
  onComplete: () => void;
}

interface PurchaseCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function PurchaseFlow({ customer, onBack, onComplete }: PurchaseFlowProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineSync();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Map<string, PurchaseCartItem>>(new Map());
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const productName = useCallback(
    (p: Product) => getProductName(p),
    []
  );

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: salesApi.getProducts,
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


  const cartTotal = useMemo(
    () =>
      Array.from(cart.values()).reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      ),
    [cart]
  );

  const cartEntries = useMemo(() => Array.from(cart.entries()), [cart]);

  const updatePrice = useCallback((productId: string, price: string) => {
    const num = parseFloat(price);
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (existing) {
        next.set(productId, { ...existing, unitPrice: isNaN(num) ? 0 : num });
      }
      return next;
    });
  }, []);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      if (existing) {
        next.set(product.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(product.id, { product, quantity: 1, unitPrice: 0 });
      }
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
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

  const purchaseMutation = useMutation({
    mutationFn: salesApi.createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["route-day"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
      toast({ title: t("purchase.success"), variant: "success" });
      onComplete();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleSubmit = useCallback(async () => {
    const items: PurchaseItem[] = cartEntries.map(([, ci]) => ({
      product_id: ci.product.id,
      name: productName(ci.product),
      quantity: ci.quantity,
      unit_price: ci.unitPrice,
    }));

    const payload: PurchaseCreate = {
      customer_id: customer.id,
      items,
      notes: notes.trim() || undefined,
    };

    if (isOnline) {
      purchaseMutation.mutate(payload);
    } else {
      await syncQueue.push("purchase", payload);
      toast({ title: t("purchase.success"), variant: "success" });
      onComplete();
    }
    setConfirmOpen(false);
  }, [cartEntries, customer.id, notes, isOnline, purchaseMutation, productName, toast, t, onComplete]);

  const canSubmit = cart.size > 0 && cartEntries.every(([, ci]) => ci.unitPrice > 0 && ci.quantity > 0);

  return (
    <FadeIn animation="fade">
      <TopBar
        title={t("purchase.title")}
        subtitle={customer.name}
        backButton={{ onBack }}
      />

      <div className="space-y-4 p-4">
        {/* Search */}
        <SearchInput
          placeholder={t("catalog.search")}
          onSearch={setSearch}
        />

        {/* Product List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            preset="no-data"
            title={t("catalog.noResults")}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => {
              const inCart = cart.get(product.id);
              return (
                <Card
                  key={product.id}
                  variant="glass"
                  className="overflow-hidden"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Product image */}
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                        {getCoverImage(product) ? (
                          <img
                            src={getCoverImage(product)!}
                            alt={productName(product)}
                            className="h-full w-full rounded-lg object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-semibold text-foreground truncate">
                          {productName(product)}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {product.sku}
                        </p>
                      </div>

                      {/* Add button or quantity controls */}
                      {inCart ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQty(product.id, inCart.quantity - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="min-w-[2rem] text-center text-body-sm font-bold text-foreground">
                            {inCart.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQty(product.id, inCart.quantity + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 shrink-0 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => addToCart(product)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Price input (visible only when in cart) */}
                    {inCart && (
                      <div className="mt-2 flex items-center gap-3 ps-17">
                        <div className="flex-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder={t("purchase.enterPrice")}
                            value={inCart.unitPrice || ""}
                            onChange={(e) => updatePrice(product.id, e.target.value)}
                            className="h-9 text-body-sm"
                            min={0}
                            step="0.01"
                          />
                        </div>
                        <p className="text-body-sm font-bold text-primary whitespace-nowrap">
                          {formatCurrency(inCart.unitPrice * inCart.quantity)}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => removeFromCart(product.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Cart Summary */}
        {cart.size > 0 && (
          <>
            <Separator />

            <div className="space-y-3">
              <h3 className="text-h4 font-semibold text-foreground">
                {t("purchase.total")}
              </h3>

              {cartEntries.map(([id, ci]) => (
                <div key={id} className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground truncate me-2">
                    {productName(ci.product)} x{ci.quantity}
                  </span>
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {formatCurrency(ci.unitPrice * ci.quantity)}
                  </span>
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-foreground">
                  {t("purchase.total")}
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(cartTotal)}
                </span>
              </div>

              {/* Notes */}
              <Textarea
                placeholder={t("purchase.notes")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />

              {/* Submit */}
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmit || purchaseMutation.isPending}
                isLoading={purchaseMutation.isPending}
              >
                <ArrowDownToLine className="h-5 w-5 me-2" />
                {t("purchase.submit")}
              </Button>
            </div>
          </>
        )}

        {cart.size === 0 && !isLoading && (
          <p className="text-center text-body-sm text-muted-foreground py-4">
            {t("purchase.emptyCart")}
          </p>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("purchase.confirmTitle")}
        description={t("purchase.confirmMessage", {
          amount: formatCurrency(cartTotal),
          customer: customer.name,
        })}
        confirmLabel={t("actions.confirm")}
        onConfirm={handleSubmit}
        variant="default"
      />
    </FadeIn>
  );
}
