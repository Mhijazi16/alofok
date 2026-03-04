import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckPhotoThumbnail } from "@/components/ui/check-photo-thumbnail";
import type { CheckData } from "@/services/salesApi";

interface ReturnedChecksViewProps {
  customer: Customer;
  onBack: () => void;
}

export function ReturnedChecksView({ customer, onBack }: ReturnedChecksViewProps) {
  const { t, i18n } = useTranslation();

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

  return (
    <div className="animate-fade-in">
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
            {checks.map((check) => {
              const data = check.data as CheckData | null;
              return (
                <Card key={check.id} variant="glass">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-body-sm font-semibold text-foreground">
                            {formatCurrency(Math.abs(check.amount), check.currency)}
                          </span>
                          <Badge variant="destructive" className="text-[10px]">
                            {t("checkStatus.Returned")}
                          </Badge>
                        </div>
                        {data?.bank && (
                          <p className="text-caption text-muted-foreground">
                            {data.bank}
                            {data.branch_number && ` · ${t("branchNumber")}: ${data.branch_number}`}
                          </p>
                        )}
                        {data?.account_number && (
                          <p className="text-caption text-muted-foreground">
                            {t("accountNumber")}: {data.account_number}
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
                      <CheckPhotoThumbnail imageUrl={data?.image_url} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
