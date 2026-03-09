/**
 * Product name resolution utility.
 * Returns the localized product name based on current i18n language.
 */

import i18n from "@/i18n";

interface HasProductName {
  name_ar: string;
  name_en: string;
}

export function getProductName(product: HasProductName): string {
  return i18n.language === "ar" ? product.name_ar : product.name_en;
}
