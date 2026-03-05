import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Archive } from "lucide-react";

import { adminApi } from "@/services/adminApi";
import type { Customer } from "@/services/salesApi";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { PageContainer } from "@/components/layout/page-container";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CustomerForm } from "@/components/Sales/CustomerForm";
import { CustomerImport } from "./CustomerImport";

// Helper to convert null to undefined for Avatar src
const getAvatarSrc = (url: string | null | undefined): string | undefined => {
  return url ?? undefined;
};

type Mode = "list" | "add";

const VISIT_DAYS = [
  { value: "Sun", ar: "الأحد", en: "Sunday" },
  { value: "Mon", ar: "الاثنين", en: "Monday" },
  { value: "Tue", ar: "الثلاثاء", en: "Tuesday" },
  { value: "Wed", ar: "الأربعاء", en: "Wednesday" },
  { value: "Thu", ar: "الخميس", en: "Thursday" },
  { value: "Sat", ar: "السبت", en: "Saturday" },
];

const ASSIGNED_DAY_VALUES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"];

export function AdminCustomerPanel() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("list");
  const [csvOpen, setCsvOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>("All");
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const archiveMutation = useMutation({
    mutationFn: adminApi.archiveCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
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
    queryKey: ["admin-customers"],
    queryFn: adminApi.getAllCustomers,
  });

  const { data: salesReps } = useQuery({
    queryKey: ["sales-reps"],
    queryFn: adminApi.getSalesReps,
  });

  // Filter customers by day and search term
  const filteredCustomers = (customers ?? []).filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedDay === "All") {
      return matchesSearch;
    }
    return matchesSearch && customer.assigned_day === selectedDay;
  });

  // Group by assigned day for display
  const groupedByDay = ASSIGNED_DAY_VALUES.reduce(
    (acc, day) => {
      acc[day] = filteredCustomers.filter((c) => c.assigned_day === day);
      return acc;
    },
    {} as Record<string, Customer[]>
  );

  const getDayLabel = (day: string) => {
    const found = VISIT_DAYS.find((d) => d.value === day);
    return i18n.language === "ar" ? found?.ar : found?.en;
  };

  if (mode === "add") {
    return (
      <CustomerForm
        onDone={() => {
          setMode("list");
          queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
        }}
        onBack={() => setMode("list")}
        salesReps={salesReps}
        createFn={adminApi.createCustomer}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <TopBar title={t("nav.customers")} />

      <PageContainer>
        <div className="space-y-4">
          {/* CSV Import Toggle Button */}
          <div className="flex gap-2">
            <Button
              variant={csvOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setCsvOpen(!csvOpen)}
              className="w-full"
            >
              <Upload className="h-4 w-4" />
              {t("admin.importCsv") || "CSV Import"}
            </Button>
          </div>

          {/* CSV Import Section */}
          {csvOpen && <CustomerImport />}

          {/* Day Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button
              onClick={() => setSelectedDay("All")}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-caption font-medium transition-all ${
                selectedDay === "All"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card hover:border-primary/50"
              }`}
            >
              {t("filter.all") || "All"}
            </button>
            {ASSIGNED_DAY_VALUES.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-caption font-medium transition-all ${
                  selectedDay === day
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card hover:border-primary/50"
                }`}
              >
                {getDayLabel(day)}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <SearchInput
            placeholder={t("customer.searchCustomers") || "Search customers..."}
            value={searchTerm}
            onChange={setSearchTerm}
          />

          {/* Loading State */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("customer.noCustomers") || "No customers found"}</p>
            </div>
          ) : (
            /* Customers by Day */
            <div className="space-y-4">
              {ASSIGNED_DAY_VALUES.map((day) => {
                const dayCustomers = groupedByDay[day];
                if (dayCustomers.length === 0) return null;

                return (
                  <div key={day}>
                    <div className="text-body-sm font-semibold text-muted-foreground mb-2 px-2">
                      {getDayLabel(day)} ({dayCustomers.length})
                    </div>
                    <div className="space-y-2">
                      {dayCustomers.map((customer) => (
                        <Card key={customer.id} variant="glass" className="cursor-default">
                          <CardContent className="p-3 flex items-start gap-3">
                            <Avatar src={getAvatarSrc(customer.avatar_url)} name={customer.name} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-semibold text-foreground truncate">
                                {customer.name}
                              </p>
                              <p className="text-caption text-muted-foreground">{customer.city}</p>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                <Badge variant="secondary" size="sm">
                                  {getDayLabel(customer.assigned_day)}
                                </Badge>
                                {Number(customer.balance) !== 0 && (
                                  <Badge
                                    variant={Number(customer.balance) > 0 ? "destructive" : "success"}
                                    size="sm"
                                  >
                                    {Number(customer.balance) > 0 ? "+" : ""}
                                    {Number(customer.balance).toFixed(0)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setArchiveTarget(customer)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageContainer>

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

      {/* FAB - Add Customer */}
      <button
        onClick={() => setMode("add")}
        className="fixed right-4 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-primary/80 shadow-lg flex items-center justify-center text-white hover:shadow-xl transition-shadow"
        style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
