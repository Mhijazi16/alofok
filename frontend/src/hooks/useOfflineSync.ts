import { useCallback, useEffect, useState } from "react";
import { syncQueue } from "@/lib/syncQueue";
import { salesApi, type OrderCreate, type PaymentCreate } from "@/services/salesApi";

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
          await salesApi.createPayment(item.payload as PaymentCreate);
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
