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
