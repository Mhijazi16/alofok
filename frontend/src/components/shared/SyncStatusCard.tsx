/**
 * Sync status dashboard card for the Sales profile tab.
 *
 * Shows per-data-type freshness with color-coded dots,
 * pending write queue count, cache size, and a manual Sync Now button.
 */

import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { RefreshCw, Check, AlertCircle, Database, Clock } from "lucide-react";
import { useCacheSync } from "@/hooks/useCacheSync";
import type { SyncTimestamps, SyncItemStatus } from "@/hooks/useCacheSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getRelativeTime(
  isoString: string | undefined,
  t: TFunction,
): string {
  if (!isoString) return t("sync.never");

  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return t("sync.justNow");

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("sync.justNow");

  const hours = Math.floor(minutes / 60);
  if (hours < 1) return t("sync.minutesAgo", { count: minutes });

  const days = Math.floor(hours / 24);
  if (days < 1) return t("sync.hoursAgo", { count: hours });

  return t("sync.daysAgo", { count: days });
}

function getFreshnessColor(isoString: string | undefined): string {
  if (!isoString) return "bg-destructive";

  const diffMs = Date.now() - new Date(isoString).getTime();
  const hours = diffMs / 3_600_000;

  if (hours < 1) return "bg-success";
  if (hours <= 6) return "bg-warning";
  return "bg-destructive";
}

// ---------------------------------------------------------------------------
// Sync row item
// ---------------------------------------------------------------------------

interface SyncRowProps {
  label: string;
  timestamp: string | undefined;
  status: SyncItemStatus;
  t: TFunction;
}

function SyncRow({ label, timestamp, status, t }: SyncRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Status indicator */}
      <div className="flex h-5 w-5 items-center justify-center">
        {status === "syncing" && <Spinner size="sm" color="primary" />}
        {status === "done" && (
          <Check className="h-4 w-4 text-success animate-in zoom-in duration-200" />
        )}
        {status === "error" && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        {status === "idle" && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${getFreshnessColor(timestamp)}`}
          />
        )}
      </div>

      {/* Label */}
      <span className="flex-1 text-body-sm font-medium text-foreground">
        {label}
      </span>

      {/* Relative time */}
      <span className="text-caption text-muted-foreground">
        {getRelativeTime(timestamp, t)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data type definitions
// ---------------------------------------------------------------------------

const SYNC_ITEMS: { key: keyof SyncTimestamps; localeKey: string }[] = [
  { key: "products", localeKey: "sync.catalog" },
  { key: "customers", localeKey: "sync.customers" },
  { key: "orders", localeKey: "sync.orders" },
  { key: "statements", localeKey: "sync.statements" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncStatusCard() {
  const { t } = useTranslation();
  const { syncState, syncAll } = useCacheSync();

  return (
    <Card variant="glass" className="animate-slide-up">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          {t("sync.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-0 p-4 pt-0">
        {/* Data type rows */}
        {SYNC_ITEMS.map((item) => (
          <SyncRow
            key={item.key}
            label={t(item.localeKey)}
            timestamp={syncState.timestamps[item.key]}
            status={syncState.statuses[item.key]}
            t={t}
          />
        ))}

        <Separator className="my-2" />

        {/* Pending queue */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-5 w-5 items-center justify-center">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="flex-1 text-body-sm text-muted-foreground">
            {t("sync.pending", { count: syncState.pendingCount })}
          </span>
        </div>

        {/* Cache size */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-5 w-5 items-center justify-center">
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="flex-1 text-body-sm text-muted-foreground">
            {t("sync.cacheSize")}
          </span>
          <span className="text-caption text-muted-foreground">
            {formatBytes(syncState.cacheSize)}
          </span>
        </div>

        <Separator className="my-2" />

        {/* Sync Now button */}
        <Button
          variant="outline"
          className="w-full mt-2"
          disabled={syncState.isSyncing}
          onClick={() => syncAll()}
        >
          <RefreshCw
            className={`h-4 w-4 ${syncState.isSyncing ? "animate-spin" : ""}`}
          />
          {syncState.isSyncing ? t("sync.syncing") : t("sync.syncNow")}
        </Button>
      </CardContent>
    </Card>
  );
}
