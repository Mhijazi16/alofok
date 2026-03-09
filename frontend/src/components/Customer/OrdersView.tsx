import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileText, ShoppingBag } from "lucide-react";
import { customerApi } from "@/services/customerApi";
import type { CustomerTransaction } from "@/services/customerApi";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime } from "@/lib/format";

export function OrdersView() {
  const { t } = useTranslation();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: customerApi.getOrders,
    staleTime: 60 * 1000,
  });

  const formatCurrency = (val: number) =>
    Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  const statusBadge = (tx: CustomerTransaction) => {
    if (tx.is_draft) {
      return (
        <Badge variant="warning" size="sm">
          {t("portal.draft")}
        </Badge>
      );
    }
    if (tx.status === "Confirmed" || tx.status === "confirmed") {
      return (
        <Badge variant="success" size="sm">
          {t("portal.confirmed")}
        </Badge>
      );
    }
    if (tx.status) {
      return (
        <Badge variant="outline" size="sm">
          {tx.status}
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm">
        {t("portal.confirmed")}
      </Badge>
    );
  };

  return (
    <div className="animate-fade-in">
      <TopBar title={t("portal.myOrders")} />

      <div className="space-y-3 p-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-24" />
          ))
        ) : !orders || orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={t("portal.noOrders")}
            description={t("portal.noOrdersDesc")}
            className="py-16"
          />
        ) : (
          orders.map((order, idx) => (
            <Card
              key={order.id}
              variant="glass"
              className="animate-slide-up overflow-hidden"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Icon + info */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 mt-0.5">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-bold text-foreground">
                        {formatCurrency(Math.abs(order.amount))}
                        <span className="ms-1.5 text-caption font-normal text-muted-foreground">
                          {order.currency}
                        </span>
                      </p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatDate(order.created_at)}
                        <span className="mx-1.5 opacity-40">·</span>
                        {formatTime(order.created_at)}
                      </p>
                      {order.notes && (
                        <p className="text-caption text-muted-foreground italic mt-1 truncate max-w-[180px]">
                          {order.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0 pt-0.5">
                    {statusBadge(order)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
