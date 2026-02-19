import { WifiOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OfflineBannerProps {
  isSyncing: boolean;
  pendingCount: number;
}

export function OfflineBanner({ isSyncing, pendingCount }: OfflineBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-yellow-800 text-sm">
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" />
      )}
      <span>
        {isSyncing
          ? "جاري المزامنة…"
          : `${t("errors.offline")}${pendingCount > 0 ? ` · ${pendingCount} معلقة` : ""}`}
      </span>
    </div>
  );
}
