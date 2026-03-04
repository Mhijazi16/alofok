import type { SelectedOption } from "@/services/salesApi";

export function cartKey(productId: string, options?: SelectedOption[]): string {
  if (!options?.length) return productId;
  return `${productId}::${options.map((o) => `${o.name}:${o.value}`).sort().join("|")}`;
}

export function optionsPrice(options?: SelectedOption[]): number {
  if (!options?.length) return 0;
  return options.reduce((sum, o) => sum + o.price_modifier, 0);
}
