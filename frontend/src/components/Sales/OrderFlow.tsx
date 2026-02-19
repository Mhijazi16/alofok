import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Minus, ShoppingCart } from "lucide-react";
import { salesApi, type Customer, type Product } from "@/services/salesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

export default function OrderFlow({ customer, onBack, onDone }: OrderFlowProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: salesApi.getProducts,
    staleTime: 10 * 60 * 1000,
  });

  const createOrder = useMutation({
    mutationFn: salesApi.createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-route"] });
      qc.invalidateQueries({ queryKey: ["insights", customer.id] });
      onDone();
    },
  });

  function getName(p: Product) {
    return isAr ? p.name_ar : p.name_en;
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function adjustQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function cartQty(productId: string) {
    return cart.find((i) => i.product.id === productId)?.quantity ?? 0;
  }

  const filtered = products?.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name_ar.includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  const bestsellers = filtered?.filter((p) => p.is_bestseller) ?? [];
  const discounted = filtered?.filter((p) => p.is_discounted) ?? [];
  const cartTotal = cart.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  async function submitOrder() {
    await createOrder.mutateAsync({
      customer_id: customer.id,
      items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.product.price,
      })),
    });
  }

  // ── Cart view ──────────────────────────────────────────────────────────────
  if (showCart) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button
            onClick={() => setShowCart(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">{t("actions.order")}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{getName(product)}</p>
                <p className="text-sm text-muted-foreground">
                  {Number(product.price).toLocaleString("ar-SA")} ×
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjustQty(product.id, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-bold">{quantity}</span>
                <button
                  onClick={() => adjustQty(product.id, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex justify-between mb-4">
            <span className="text-muted-foreground">المجموع</span>
            <span className="font-bold text-lg">
              {cartTotal.toLocaleString("ar-SA")}
            </span>
          </div>
          <Button
            className="w-full"
            onClick={submitOrder}
            disabled={createOrder.isPending || cart.length === 0}
          >
            {createOrder.isPending ? "…" : t("actions.confirm")}
          </Button>
          {createOrder.isError && (
            <p className="mt-2 text-sm text-destructive text-center">
              {t("errors.generic")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Product list ───────────────────────────────────────────────────────────
  function ProductRow({ p }: { p: Product }) {
    const qty = cartQty(p.id);
    return (
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-sm">{getName(p)}</p>
          <p className="text-xs text-muted-foreground">{p.sku}</p>
          <p className="text-sm font-bold text-primary">
            {Number(p.price).toLocaleString("ar-SA")}
          </p>
        </div>
        {qty === 0 ? (
          <Button size="sm" variant="outline" onClick={() => addToCart(p)}>
            {t("catalog.addToOrder")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustQty(p.id, -1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-5 text-center font-bold text-sm">{qty}</span>
            <button
              onClick={() => adjustQty(p.id, 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold flex-1">{customer.name}</h2>
        {cart.length > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center justify-center"
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -top-1.5 -start-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <Input
          placeholder={t("catalog.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Product sections */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : (
          <>
            {bestsellers.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {t("catalog.bestSellers")}
                </h3>
                <div className="flex flex-col gap-2">
                  {bestsellers.map((p) => (
                    <ProductRow key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}

            {discounted.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {t("catalog.discounted")}
                </h3>
                <div className="flex flex-col gap-2">
                  {discounted.map((p) => (
                    <ProductRow key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}

            {filtered
              ?.filter((p) => !p.is_bestseller && !p.is_discounted)
              .map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
          </>
        )}
      </div>

      {/* Floating cart button */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-border">
          <Button className="w-full" onClick={() => setShowCart(true)}>
            <ShoppingCart className="me-2 h-4 w-4" />
            {t("actions.order")} · {cartTotal.toLocaleString("ar-SA")}
          </Button>
        </div>
      )}
    </div>
  );
}
