import * as React from "react";
import { RefreshCw, WifiOff } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface OfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  isSyncing,
  pendingCount,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);

  const shouldShow = !isOnline || isSyncing || pendingCount > 0;

  React.useEffect(() => {
    if (shouldShow) {
      setVisible(true);
    } else {
      // Delay hiding so the slide-down exit feels smooth
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [shouldShow]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "glass-strong fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground",
        shouldShow ? "animate-slide-down" : "animate-fade-out"
      )}
      role="status"
      aria-live="polite"
    >
      {!isOnline && (
        <>
          {/* Pulsing red dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span>{t("offline.disconnected", "You are offline")}</span>
        </>
      )}

      {isOnline && isSyncing && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>{t("offline.syncing", "Syncing data...")}</span>
        </>
      )}

      {pendingCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          {t("offline.pending", "{{count}} pending", { count: pendingCount })}
        </span>
      )}
    </div>
  );
};
OfflineBanner.displayName = "OfflineBanner";

export { OfflineBanner };
export type { OfflineBannerProps };
