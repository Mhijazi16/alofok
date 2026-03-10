import type { Product, SelectedOption } from "@/services/salesApi";

export function cartKey(productId: string, options?: SelectedOption[]): string {
  if (!options?.length) return productId;
  return `${productId}::${options.map((o) => `${o.name}:${o.value}`).sort().join("|")}`;
}

/** Get the effective unit price for a cart item. */
export function getUnitPrice(product: Product, options?: SelectedOption[]): number {
  if (options?.length) {
    // Use the selected option's absolute price
    return options[0].price;
  }
  return product.discounted_price ?? product.price;
}

/** @deprecated Use getUnitPrice instead */
export function optionsPrice(options?: SelectedOption[]): number {
  if (!options?.length) return 0;
  return options.reduce((sum, o) => sum + o.price, 0);
}
