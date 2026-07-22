// Pure, framework-free adapter between the API's flat `OrderItem[]` shape and
// the create-flow's `CartItem` (needs the full `Product`). Used to seed the
// order-edit wizard's cart from an existing order and to serialize it back for
// `PUT /orders/{id}`. Kept side-effect-free so it can be unit-tested in isolation.

import type { OrderItem, CartItem, Product } from "@/services/salesApi";
import { cartKey, getUnitPrice } from "@/lib/cart";
import { getProductName } from "@/lib/product";

export interface HydratedOrder {
  cart: Map<string, CartItem>;
  /** Order lines whose product no longer exists — preserved verbatim, never dropped. */
  legacy: OrderItem[];
  /**
   * Original `unit_price` per `cartKey` for lines that existed in the order.
   * Used to preserve historical pricing: editing an order (e.g. changing a note
   * or quantity) must NOT silently reprice existing lines to the current catalog
   * price — that would change the order total and the customer's balance. Newly
   * added lines are absent here and get priced at the current catalog price.
   */
  prices: Map<string, number>;
}

/**
 * Split an order's lines into a hydrated cart (lines whose product still exists,
 * keyed by `cartKey`) and `legacy` lines (product deleted/unavailable). Lines that
 * collapse to the same cart key are merged by summing quantity. Also captures each
 * matched line's original `unit_price` so it can be preserved on save.
 */
export function hydrateOrderItems(
  items: OrderItem[],
  products: Product[]
): HydratedOrder {
  const byId = new Map(products.map((p) => [p.id, p]));
  const cart = new Map<string, CartItem>();
  const legacy: OrderItem[] = [];
  const prices = new Map<string, number>();

  for (const item of items ?? []) {
    const product = byId.get(item.product_id);
    if (!product) {
      legacy.push(item);
      continue;
    }
    const selectedOptions = item.selected_options?.length
      ? item.selected_options
      : undefined;
    const key = cartKey(product.id, selectedOptions);
    const existing = cart.get(key);
    if (existing) {
      cart.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        // Merged duplicate lines: keep the first note seen rather than dropping it.
        note: existing.note ?? item.note ?? undefined,
      });
    } else {
      cart.set(key, {
        product,
        quantity: item.quantity,
        selectedOptions,
        note: item.note ?? undefined,
      });
    }
    // Keep the first-seen historical price for this line (duplicates share it).
    if (!prices.has(key)) prices.set(key, item.unit_price);
  }

  return { cart, legacy, prices };
}

/**
 * Serialize a hydrated cart back to `OrderItem[]`, then append the untouched
 * `legacy` lines. Mirrors the create-flow serialization (see Sales/index.tsx).
 *
 * `originalPrices` (from `hydrateOrderItems`) preserves the historical
 * `unit_price` of lines that were already in the order; lines absent from it
 * (newly added during the edit) are priced at the current catalog price.
 */
export function serializeCart(
  cart: Map<string, CartItem>,
  legacy: OrderItem[],
  originalPrices?: Map<string, number>
): OrderItem[] {
  const items: OrderItem[] = Array.from(cart.entries()).map(([key, ci]) => ({
    product_id: ci.product.id,
    name: getProductName(ci.product),
    image_url: ci.product.image_urls?.[0] ?? null,
    quantity: ci.quantity,
    unit_price:
      originalPrices?.get(key) ?? getUnitPrice(ci.product, ci.selectedOptions),
    selected_options: ci.selectedOptions?.length ? ci.selectedOptions : null,
    note: ci.note?.trim() || null,
  }));
  return [...items, ...legacy];
}
