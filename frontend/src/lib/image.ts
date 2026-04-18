export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  // Use relative path — Vite proxy forwards /static to the backend
  return path;
}

export function getCoverImage(product: {
  image_urls?: string[] | null;
}): string | null {
  return getImageUrl(product.image_urls?.[0]);
}

/** Sort products so those with images appear first (stable sort). */
export function sortProductsByImage<T extends { image_urls?: string[] | null }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    const aHas = (a.image_urls?.length ?? 0) > 0 ? 0 : 1;
    const bHas = (b.image_urls?.length ?? 0) > 0 ? 0 : 1;
    return aHas - bHas;
  });
}
