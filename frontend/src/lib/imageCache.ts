/**
 * Product image blob caching via idb-keyval dedicated store.
 *
 * Images are stored as Blobs keyed by their URL string in a separate
 * IndexedDB database (`alofok-images`) to keep them isolated from
 * the React Query cache and the sync queue DB.
 */

import { get, set, keys, clear, createStore } from "idb-keyval";

const imageStore = createStore("alofok-images", "blobs");

/**
 * Cache product image blobs into IndexedDB.
 * Skips URLs already cached. Uses Promise.allSettled so one failure
 * does not block the rest.
 */
export async function cacheProductImages(
  imageUrls: string[]
): Promise<void> {
  const results = await Promise.allSettled(
    imageUrls.map(async (url) => {
      // Skip if already cached
      const existing = await get<Blob>(url, imageStore);
      if (existing) return;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${url} (${response.status})`);
      }
      const blob = await response.blob();
      await set(url, blob, imageStore);
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(
      `[imageCache] ${failures.length}/${imageUrls.length} images failed to cache`,
      failures.map((r) => (r as PromiseRejectedResult).reason)
    );
  }
}

/**
 * Get an offline-ready object URL for a cached image.
 * Caller is responsible for revoking the URL via URL.revokeObjectURL()
 * when the component unmounts to prevent memory leaks.
 */
export async function getOfflineImageUrl(
  url: string
): Promise<string | null> {
  try {
    const blob = await get<Blob>(url, imageStore);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get approximate total size of cached images in bytes.
 */
export async function getImageCacheSize(): Promise<number> {
  try {
    const allKeys = await keys(imageStore);
    let total = 0;
    for (const key of allKeys) {
      const blob = await get<Blob>(key, imageStore);
      if (blob) {
        total += blob.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Clear all cached images from IndexedDB.
 */
export async function clearImageCache(): Promise<void> {
  await clear(imageStore);
}
