import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft } from "@/lib/icons";
import { salesApi, type Customer } from "@/services/salesApi";
import type { CheckOut } from "@/services/adminApi";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckPhotoThumbnail } from "@/components/ui/check-photo-thumbnail";
import { CheckDetailDialog } from "@/components/ui/check-detail-dialog";
import { FadeIn } from "@/components/ui/fade-in";
import type { CheckData } from "@/services/salesApi";

interface ReturnedChecksViewProps {
  customer: Customer;
  onBack: () => void;
}

export function ReturnedChecksView({ customer, onBack }: ReturnedChecksViewProps) {
  const { t, i18n } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: checks, isLoading } = useQuery({
    queryKey: ["returned-checks", customer.id],
    queryFn: () => salesApi.getReturnedChecks(customer.id),
  });

  const formatCurrency = (amount: number, currency: string) =>
    amount.toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ` ${currency}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const selectedCheck: CheckOut | null =
    checks && selectedIndex !== null ? checks[selectedIndex] ?? null : null;

  return (
    <FadeIn animation="fade">
      <TopBar
        title={t("actions.returnedCheck")}
        subtitle={customer.name}
        backButton={{ onBack }}
      />

      <div className="space-y-3 p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !checks || checks.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title={t("returnedChecks.empty")}
            description={t("returnedChecks.emptyDesc")}
          />
        ) : (
          <>
            <p className="text-body-sm text-muted-foreground">
              {checks.length} {t("returnedChecks.count")}
            </p>
            {checks.map((check, index) => {
              const data = check.data as CheckData | null;
              return (
                <Card
                  key={check.id}
                  variant="glass"
                  className="cursor-pointer transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
                  onClick={() => setSelectedIndex(index)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Amount prominent */}
                        <div className="flex items-center gap-2">
                          <span className="text-body font-bold text-foreground">
                            {formatCurrency(Math.abs(check.amount), check.currency)}
                          </span>
                          <Badge variant="destructive" className="text-[10px]">
                            {t("checks.status.Returned")}
                          </Badge>
                        </div>
                        {/* Holder name */}
                        {data?.holder_name && (
                          <p className="text-body-sm text-foreground/80 font-medium">
                            {data.holder_name}
                          </p>
                        )}
                        {/* Bank + bank number */}
                        {data?.bank && (
                          <p className="text-caption text-muted-foreground">
                            {data.bank}
                            {data.bank_number && ` · #${data.bank_number}`}
                          </p>
                        )}
                        {/* Due date */}
                        {data?.due_date && (
                          <p className="text-caption text-muted-foreground">
                            {t("checks.dueDate")}: {data.due_date}
                          </p>
                        )}
                        {check.notes && (
                          <p className="text-caption text-muted-foreground/70 italic">
                            {check.notes}
                          </p>
                        )}
                        <p className="text-caption text-muted-foreground/50">
                          {formatDate(check.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckPhotoThumbnail imageUrl={data?.image_url} />
                        <ChevronLeft className="h-4 w-4 text-muted-foreground/40 shrink-0 rtl:rotate-0 ltr:rotate-180" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Check Detail Dialog — read-only (no action callbacks) */}
      <CheckDetailDialog
        check={selectedCheck}
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
        navigation={
          checks && checks.length > 1 && selectedIndex !== null
            ? {
                current: selectedIndex + 1,
                total: checks.length,
                onPrev: selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined,
                onNext:
                  selectedIndex < checks.length - 1
                    ? () => setSelectedIndex(selectedIndex + 1)
                    : undefined,
              }
            : undefined
        }
      />
    </FadeIn>
  );
}
