import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { salesApi, type Customer } from "@/services/salesApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Preset = "sinceZero" | "lastWeek" | "lastMonth" | "lastYear";

interface StatementViewProps {
  customer: Customer;
  onBack: () => void;
}

function dateRange(preset: Preset): {
  since_zero_balance?: boolean;
  start_date?: string;
  end_date?: string;
} {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];

  if (preset === "sinceZero") return { since_zero_balance: true };
  if (preset === "lastWeek") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return { start_date: iso(d), end_date: iso(today) };
  }
  if (preset === "lastMonth") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 1);
    return { start_date: iso(d), end_date: iso(today) };
  }
  // lastYear
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - 1);
  return { start_date: iso(d), end_date: iso(today) };
}

const TYPE_LABELS: Record<string, string> = {
  Order: "طلب",
  Payment_Cash: "نقدي",
  Payment_Check: "شيك",
  Check_Return: "شيك مرتجع",
};

export default function StatementView({
  customer,
  onBack,
}: StatementViewProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("sinceZero");

  const params = dateRange(preset);

  const { data: statement, isLoading } = useQuery({
    queryKey: ["statement", customer.id, preset],
    queryFn: () => salesApi.getStatement(customer.id, params),
  });

  const presets: { key: Preset; label: string }[] = [
    { key: "sinceZero", label: t("statement.sinceZero") },
    { key: "lastWeek", label: t("statement.lastWeek") },
    { key: "lastMonth", label: t("statement.lastMonth") },
    { key: "lastYear", label: t("statement.lastYear") },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold">{t("statement.title")}</h2>
          <p className="text-sm text-muted-foreground">{customer.name}</p>
        </div>
      </div>

      {/* Preset selector */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-border">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              preset === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))
        ) : !statement?.entries.length ? (
          <p className="text-center text-muted-foreground py-8">
            لا توجد معاملات
          </p>
        ) : (
          statement.entries.map(({ transaction: tx, running_balance }) => {
            const isDebit = Number(tx.amount) > 0;
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        tx.type === "Check_Return"
                          ? "danger"
                          : isDebit
                          ? "warning"
                          : "success"
                      }
                    >
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                    {tx.status === "Returned" && (
                      <Badge variant="danger">مرتجع</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>

                <div className="text-end">
                  <p
                    className={`font-bold ${
                      isDebit ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {isDebit ? "+" : ""}
                    {Number(tx.amount).toLocaleString("ar-SA")} {tx.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("statement.runningBalance")}:{" "}
                    {Number(running_balance).toLocaleString("ar-SA")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Closing balance footer */}
      {statement && (
        <div className="border-t border-border p-4 flex justify-between">
          <span className="font-semibold">{t("customer.balance")}</span>
          <span className="font-bold text-destructive text-lg">
            {Number(statement.closing_balance).toLocaleString("ar-SA")}
          </span>
        </div>
      )}
    </div>
  );
}
