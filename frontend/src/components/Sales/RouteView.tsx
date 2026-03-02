import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingDown, Wallet, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { TopBar } from "@/components/ui/top-bar";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface RouteViewProps {
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer?: () => void;
}

export function RouteView({ onSelectCustomer, onAddCustomer }: RouteViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [search, setSearch] = useState("");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["my-route"],
    queryFn: salesApi.getMyRoute,
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalCustomers = customers?.length ?? 0;
  const totalDebt = useMemo(
    () => customers?.reduce((sum, c) => sum + c.balance, 0) ?? 0,
    [customers]
  );
  const estimatedCollections = useMemo(
    () =>
      customers
        ?.filter((c) => c.balance > 0)
        .reduce((sum, c) => sum + Math.min(c.balance * 0.3, c.balance), 0) ?? 0,
    [customers]
  );

  const today = new Date().toLocaleDateString(i18n.language === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const formatCurrency = (val: number) =>
    val.toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="animate-fade-in">
      <TopBar title={t("customer.todayRoute")} subtitle={today} />

      <div className="space-y-4 p-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            variant="glass"
            value={isLoading ? "..." : totalCustomers}
            label={t("customer.totalCustomers")}
            icon={Users}
          />
          <StatCard
            variant="glass"
            value={isLoading ? "..." : formatCurrency(totalDebt)}
            label={t("customer.todayDebt")}
            icon={TrendingDown}
          />
          <StatCard
            variant="glass"
            value={isLoading ? "..." : formatCurrency(estimatedCollections)}
            label={t("customer.todayCollections")}
            icon={Wallet}
          />
        </div>

        {/* Search */}
        <SearchInput
          placeholder={t("customer.searchCustomers")}
          onSearch={setSearch}
        />

        {/* Customer List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState preset="no-results" />
          ) : (
            <EmptyState preset="empty-route" />
          )
        ) : (
          <div className="space-y-3">
            {filtered.map((customer, idx) => {
              const balanceVariant: "success" | "warning" | "danger" =
                customer.balance <= 0
                  ? "success"
                  : customer.balance < 5000
                    ? "warning"
                    : "danger";

              return (
                <Card
                  key={customer.id}
                  variant="interactive"
                  className="animate-slide-up p-4"
                  style={{ animationDelay: `${idx * 60}ms` }}
                  onClick={() => onSelectCustomer(customer)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={customer.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-h4 font-semibold text-foreground truncate">
                        {customer.name}
                      </p>
                      <p className="text-caption text-muted-foreground truncate">
                        {customer.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={balanceVariant} dot>
                        {formatCurrency(customer.balance)}
                      </Badge>
                      <ChevronIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {onAddCustomer && (
        <button
          onClick={onAddCustomer}
          className="fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
