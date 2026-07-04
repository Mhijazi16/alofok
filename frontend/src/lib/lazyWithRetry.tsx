import { lazy, ComponentType } from "react";

const RELOAD_FLAG = "alofok_chunk_reloaded";

/**
 * Wraps React.lazy so that a failed dynamic import — almost always a stale
 * chunk hash after a new deploy (e.g. "error loading dynamically imported
 * module") — triggers a single hard reload instead of crashing to the
 * ErrorBoundary. The reload picks up a fresh index.html (Caddy serves it
 * no-cache) which points at the new chunk hashes.
 *
 * A sessionStorage guard prevents an infinite reload loop: we only auto-reload
 * once per session-of-failures. On any successful import the guard is cleared,
 * so a genuinely new stale-deploy later can reload again.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await importFn();
      window.sessionStorage.removeItem(RELOAD_FLAG);
      return module;
    } catch (error) {
      const alreadyReloaded =
        window.sessionStorage.getItem(RELOAD_FLAG) === "1";

      if (!alreadyReloaded) {
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Never resolve — keep Suspense fallback up until the reload happens.
        return new Promise<{ default: T }>(() => {});
      }

      // Reload already tried and it still failed: surface the real error.
      throw error;
    }
  });
}
