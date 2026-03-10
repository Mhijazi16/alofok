import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Users, UserPlus, Archive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/ui/top-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/useToast";
import type { Customer } from "@/services/salesApi";

const DAYS_LIST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface AllCustomersViewProps {
  queryKey: string[];
  queryFn: () => Promise<Customer[]>;
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer: () => void;
  showInteractive?: boolean;
  archiveFn?: (id: string) => Promise<unknown>;
}

export function AllCustomersView({
  queryKey,
  queryFn,
  onSelectCustomer,
  onAddCustomer,
  showInteractive = true,
  archiveFn,
}: AllCustomersViewProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRTL = i18n.language === "ar";
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const archiveMutation = useMutation({
    mutationFn: archiveFn!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      queryClient.invalidateQueries({ queryKey: ["route-day"] });
      toast({ title: t("customer.archiveSuccess"), variant: "success" });
      setArchiveTarget(null);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const { data: customers, isLoading } = useQuery({
    queryKey,
    queryFn,
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = customers;
    if (dayFilter !== "all") {
      list = list.filter((c) => c.assigned_day === dayFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      );
    }
    return list;
  }, [customers, search, dayFilter]);

  // Group by assigned_day
  const grouped = useMemo(() => {
    if (dayFilter !== "all") return null;
    const map = new Map<string, Customer[]>();
    for (const c of filtered) {
      const existing = map.get(c.assigned_day) ?? [];
      existing.push(c);
      map.set(c.assigned_day, existing);
    }
    return map;
  }, [filtered, dayFilter]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Order days based on language
  // Arabic: Sat, Sun, Mon (first line) + Tue, Wed, Thu (second line)
  // English: Sun, Mon, Tue, Wed, Thu, Sat (natural left-to-right order)
  const orderedDays = isRTL ? ["Sat", "Fri", "Sun", "Mon", "Tue", "Wed", "Thu"] : DAYS_LIST;

  const renderCustomerCard = (customer: Customer, idx: number) => {
    const balanceVariant: "success" | "warning" | "danger" =
      customer.balance <= 0
        ? "success"
        : customer.balance < 5000
          ? "warning"
          : "danger";

    const cardClass = showInteractive ? "variant-interactive cursor-pointer" : "variant-glass";
    const onClick = showInteractive ? () => onSelectCustomer(customer) : undefined;

    return (
      <Card
        key={customer.id}
        variant={cardClass as any}
        className="animate-slide-up p-4"
        style={{ animationDelay: `${idx * 40}ms` }}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold text-foreground truncate">
              {customer.name}
            </p>
            <p className="text-caption text-muted-foreground truncate">
              {customer.city}
              {customer.phone && ` · ${customer.phone}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={balanceVariant} dot size="sm">
              {formatCurrency(customer.balance)}
            </Badge>
            {archiveFn && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setArchiveTarget(customer); }}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
            {showInteractive && <ChevronIcon className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("customer.allCustomers")}
        subtitle={!isLoading ? `${customers?.length ?? 0} ${t("customer.totalCustomers").toLowerCase()}` : undefined}
        actions={
          <Button
            variant="default"
            size="icon"
            onClick={onAddCustomer}
            className="h-8 w-8 rounded-full"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        {/* Day filter pills */}
        <Tabs value={dayFilter} onValueChange={setDayFilter}>
          <TabsList variant="segment" className="flex flex-wrap gap-2">
            <TabsTrigger value="all" className="flex-1 min-w-20">
              {t("actions.viewAll")}
            </TabsTrigger>
            {orderedDays.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                className="flex-1 min-w-16"
              >
                {t(`customer.days.${day}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search */}
        <SearchInput
          placeholder={t("customer.searchCustomers")}
          onSearch={setSearch}
        />

        {/* Customer List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState preset="no-results" />
          ) : (
            <EmptyState
              icon={Users}
              title={t("customer.noCustomers")}
              action={{ label: t("customer.addNew"), onClick: onAddCustomer }}
            />
          )
        ) : grouped ? (
          // Grouped by day
          <div className="space-y-5">
            {orderedDays.filter((d) => grouped.has(d)).map((day) => {
              const dayCustomers = grouped.get(day)!;
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-caption font-semibold text-primary uppercase tracking-wider">
                      {t(`customer.days.${day}`)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                    <Badge variant="outline" size="sm">
                      {dayCustomers.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {dayCustomers.map((c, idx) => renderCustomerCard(c, idx))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat list (filtered by specific day)
          <div className="space-y-2">
            {filtered.map((c, idx) => renderCustomerCard(c, idx))}
          </div>
        )}
      </div>

      {archiveFn && (
        <ConfirmationDialog
          open={!!archiveTarget}
          onOpenChange={(open) => !open && setArchiveTarget(null)}
          title={t("customer.archiveConfirmTitle")}
          description={t("customer.archiveConfirmDesc", { name: archiveTarget?.name })}
          confirmLabel={t("customer.archive")}
          cancelLabel={t("actions.cancel")}
          variant="destructive"
          isLoading={archiveMutation.isPending}
          onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        />
      )}
    </div>
  );
}
