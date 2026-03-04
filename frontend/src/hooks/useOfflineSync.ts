import { useCallback, useEffect, useState } from "react";
import { syncQueue } from "@/lib/syncQueue";
import { checkImageQueue } from "@/lib/checkImageQueue";
import { salesApi, type OrderCreate, type PaymentCreate, type CheckData } from "@/services/salesApi";

/**
 * Extended payment payload shape used internally when an image was captured offline.
 * pending_image_id references a blob stored in the check_images IndexedDB store.
 */
interface OfflinePaymentPayload extends PaymentCreate {
  pending_image_id?: number;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshCount() {
    setPendingCount(await syncQueue.count());
  }

  const flush = useCallback(async () => {
    const items = await syncQueue.all();
    if (items.length === 0) return;

    setIsSyncing(true);
    for (const item of items) {
      try {
        if (item.type === "order") {
          await salesApi.createOrder(item.payload as OrderCreate);
        } else {
          const payload = item.payload as OfflinePaymentPayload;
          let finalPayload: PaymentCreate = payload;

          // If this queued payment has a pending image blob, upload it first
          if (payload.pending_image_id !== undefined) {
            const blob = await checkImageQueue.getImage(payload.pending_image_id);
            if (blob) {
              try {
                const { url } = await salesApi.uploadCheckImage(blob);
                // Merge image_url into the CheckData and strip pending_image_id
                const { pending_image_id: _id, ...rest } = payload;
                void _id; // suppress unused warning
                finalPayload = {
                  ...rest,
                  data: {
                    ...(rest.data as CheckData | undefined),
                    image_url: url,
                  },
                };
                // Remove blob from IndexedDB — no longer needed
                await checkImageQueue.removeImage(payload.pending_image_id);
              } catch {
                // Image upload failed — submit payment without image (non-fatal)
                console.warn(
                  "[useOfflineSync] Image upload failed for pending_image_id",
                  payload.pending_image_id,
                  "— submitting payment without image_url"
                );
                const { pending_image_id: _id, ...rest } = payload;
                void _id;
                finalPayload = rest;
              }
            } else {
              // Blob was already removed (duplicate flush), proceed without image
              const { pending_image_id: _id, ...rest } = payload;
              void _id;
              finalPayload = rest;
            }
          }

          await salesApi.createPayment(finalPayload);
        }
        await syncQueue.remove(item.id!);
      } catch {
        // Network still down or server error — stop and retry next time online
        break;
      }
    }
    setIsSyncing(false);
    await refreshCount();
  }, []);

  useEffect(() => {
    refreshCount();

    function handleOnline() {
      setIsOnline(true);
      flush();
    }
    function handleOffline() {
      setIsOnline(false);
      refreshCount();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  return { isOnline, isSyncing, pendingCount };
}
