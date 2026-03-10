import { useState, useCallback, useEffect, useMemo } from "react";
import type { Product, CartItem, SelectedOption } from "@/services/salesApi";
import { cartKey, getUnitPrice } from "@/lib/cart";

interface UseCartOptions {
  /** localStorage key for persistence. Omit or pass null to skip persistence. */
  storageKey?: string | null;
}

interface UseCartReturn {
  cart: Map<string, CartItem>;
  addToCart: (product: Product, qty?: number, selectedOptions?: SelectedOption[]) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  cartTotal: number;
}

export function useCart(options?: UseCartOptions): UseCartReturn {
  const storageKey = options?.storageKey ?? null;

  const [cart, setCart] = useState<Map<string, CartItem>>(() => {
    if (!storageKey) return new Map();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const entries = JSON.parse(saved) as [string, CartItem][];
        return new Map(entries);
      }
    } catch {
      /* ignore */
    }
    return new Map();
  });

  // Persist cart to localStorage when storageKey is provided
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify([...cart]));
    }
  }, [cart, storageKey]);

  const addToCart = useCallback(
    (product: Product, qty: number = 1, selectedOptions?: SelectedOption[]) => {
      setCart((prev) => {
        const next = new Map(prev);
        const key = cartKey(product.id, selectedOptions);
        const existing = next.get(key);
        if (existing) {
          next.set(key, { ...existing, quantity: existing.quantity + qty });
        } else {
          next.set(key, { product, quantity: qty, selectedOptions });
        }
        return next;
      });
    },
    []
  );

  const updateCartQty = useCallback((key: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(key);
      } else {
        const existing = next.get(key);
        if (existing) next.set(key, { ...existing, quantity: qty });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);

  const cartTotal = useMemo(
    () =>
      Array.from(cart.values()).reduce(
        (sum, item) =>
          sum + getUnitPrice(item.product, item.selectedOptions) * item.quantity,
        0
      ),
    [cart]
  );

  return { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartTotal };
}
