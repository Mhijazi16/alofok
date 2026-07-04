import { describe, it, expect } from "vitest";
import { hydrateOrderItems, serializeCart } from "./orderCart";
import { cartKey } from "@/lib/cart";
import type { OrderItem, Product } from "@/services/salesApi";

// Minimal Product factory — only the fields the adapter touches.
function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    name_ar: overrides.name_ar ?? "منتج",
    name_en: overrides.name_en ?? "Product",
    sku: overrides.sku ?? "SKU",
    price: overrides.price ?? 100,
    is_discounted: overrides.is_discounted ?? false,
    is_bestseller: overrides.is_bestseller ?? false,
    image_urls: overrides.image_urls ?? ["/img/p.png"],
    discounted_price: overrides.discounted_price ?? null,
    options: overrides.options ?? null,
    ...overrides,
  } as Product;
}

describe("hydrateOrderItems / serializeCart", () => {
  it("round-trips a matched line preserving quantity, options and unit_price", () => {
    const product = makeProduct({ id: "p1", price: 250 });
    const items: OrderItem[] = [
      {
        product_id: "p1",
        name: "Product",
        image_url: "/img/p.png",
        quantity: 4,
        unit_price: 250,
        selected_options: null,
      },
    ];

    const { cart, legacy } = hydrateOrderItems(items, [product]);
    expect(cart.size).toBe(1);
    expect(legacy).toHaveLength(0);

    const out = serializeCart(cart, legacy);
    expect(out).toHaveLength(1);
    expect(out[0].product_id).toBe("p1");
    expect(out[0].quantity).toBe(4);
    expect(out[0].unit_price).toBe(250);
    expect(out[0].selected_options).toBeNull();
  });

  it("preserves selected options and prices them from the option", () => {
    const product = makeProduct({
      id: "p2",
      price: 100,
      options: [
        {
          name: "Size",
          sort_order: 0,
          values: [{ label: "L", price: 130, cost: 0, quantity: 0 }],
        },
      ],
    });
    const items: OrderItem[] = [
      {
        product_id: "p2",
        name: "Product",
        image_url: null,
        quantity: 2,
        unit_price: 130,
        selected_options: [{ name: "Size", value: "L", price: 130 }],
      },
    ];

    const { cart, legacy } = hydrateOrderItems(items, [product]);
    expect(cart.size).toBe(1);
    const item = Array.from(cart.values())[0];
    expect(item.selectedOptions).toEqual([{ name: "Size", value: "L", price: 130 }]);

    const out = serializeCart(cart, legacy);
    expect(out[0].unit_price).toBe(130);
    expect(out[0].selected_options).toEqual([{ name: "Size", value: "L", price: 130 }]);
  });

  it("keeps unmatched (deleted-product) lines as legacy through both directions", () => {
    const known = makeProduct({ id: "known", price: 50 });
    const items: OrderItem[] = [
      {
        product_id: "known",
        name: "Known",
        image_url: null,
        quantity: 1,
        unit_price: 50,
        selected_options: null,
      },
      {
        product_id: "gone",
        name: "Deleted Product",
        image_url: "/img/gone.png",
        quantity: 3,
        unit_price: 77,
        selected_options: null,
      },
    ];

    const { cart, legacy } = hydrateOrderItems(items, [known]);
    expect(cart.size).toBe(1);
    expect(legacy).toHaveLength(1);
    expect(legacy[0].product_id).toBe("gone");

    const out = serializeCart(cart, legacy);
    // legacy line survives verbatim and is appended after cart items
    const goneLine = out.find((i) => i.product_id === "gone");
    expect(goneLine).toEqual(items[1]);
    expect(out).toHaveLength(2);
  });

  it("an order of only-legacy lines still yields cart.size + legacy.length >= 1", () => {
    const items: OrderItem[] = [
      {
        product_id: "gone1",
        name: "Gone 1",
        image_url: null,
        quantity: 1,
        unit_price: 10,
        selected_options: null,
      },
    ];

    const { cart, legacy } = hydrateOrderItems(items, []);
    expect(cart.size).toBe(0);
    expect(legacy).toHaveLength(1);
    expect(cart.size + legacy.length).toBeGreaterThanOrEqual(1);

    const out = serializeCart(cart, legacy);
    expect(out).toEqual(items);
  });

  it("preserves the historical unit_price of existing lines, ignoring current catalog price", () => {
    const product = makeProduct({ id: "p1", price: 300 }); // catalog price has since risen
    const items: OrderItem[] = [
      { product_id: "p1", name: "Product", image_url: null, quantity: 2, unit_price: 250, selected_options: null },
    ];
    const { cart, legacy, prices } = hydrateOrderItems(items, [product]);

    // Without overrides the line reprices to the current catalog price...
    expect(serializeCart(cart, legacy)[0].unit_price).toBe(300);
    // ...but with the captured historical prices it stays at what was ordered.
    expect(serializeCart(cart, legacy, prices)[0].unit_price).toBe(250);
  });

  it("prices newly-added lines at current catalog while preserving existing ones", () => {
    const existing = makeProduct({ id: "old", price: 300 });
    const added = makeProduct({ id: "new", price: 80 });
    const items: OrderItem[] = [
      { product_id: "old", name: "Old", image_url: null, quantity: 1, unit_price: 250, selected_options: null },
    ];
    const { cart, legacy, prices } = hydrateOrderItems(items, [existing, added]);
    // Simulate the user adding a brand-new product during the edit.
    cart.set(cartKey("new"), { product: added, quantity: 3, selectedOptions: undefined });

    const out = serializeCart(cart, legacy, prices);
    expect(out.find((i) => i.product_id === "old")!.unit_price).toBe(250); // preserved
    expect(out.find((i) => i.product_id === "new")!.unit_price).toBe(80); // current
  });

  it("merges duplicate cart-key lines by summing quantity", () => {
    const product = makeProduct({ id: "dup", price: 20 });
    const items: OrderItem[] = [
      { product_id: "dup", name: "Dup", image_url: null, quantity: 2, unit_price: 20, selected_options: null },
      { product_id: "dup", name: "Dup", image_url: null, quantity: 5, unit_price: 20, selected_options: null },
    ];
    const { cart } = hydrateOrderItems(items, [product]);
    expect(cart.size).toBe(1);
    expect(Array.from(cart.values())[0].quantity).toBe(7);
  });
});
