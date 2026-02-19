import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface RouteViewProps {
  onSelectCustomer: (customer: Customer) => void;
}

function balanceVariant(balance: number) {
  if (balance <= 0) return "success" as const;
  if (balance < 5000) return "warning" as const;
  return "danger" as const;
}

export default function RouteView({ onSelectCustomer }: RouteViewProps) {
  const { t } = useTranslation();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["my-route"],
    queryFn: salesApi.getMyRoute,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!customers?.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">{t("customer.noCustomers")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {customers.map((customer) => (
        <button
          key={customer.id}
          onClick={() => onSelectCustomer(customer)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="font-semibold text-foreground">
              {customer.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {customer.city}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={balanceVariant(customer.balance)}>
              {Number(customer.balance).toLocaleString("ar-SA")}
            </Badge>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}
