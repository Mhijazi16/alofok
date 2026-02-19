import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { adminApi } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import SalesStats from "./SalesStats";
import DebtStats from "./DebtStats";

type Tab = "sales" | "debt";

export default function AdminRoot() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("sales");
  const [reportSent, setReportSent] = useState(false);

  const sendEod = useMutation({
    mutationFn: adminApi.sendEodReport,
    onSuccess: () => setReportSent(true),
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "sales", label: t("admin.salesStats") },
    { key: "debt", label: t("admin.debtOverview") },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe pt-4 pb-3 border-b border-border bg-card">
        <h1 className="text-lg font-black text-primary">{t("admin.title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendEod.mutate(undefined)}
            disabled={sendEod.isPending || reportSent}
          >
            {reportSent
              ? t("admin.reportSent")
              : sendEod.isPending
              ? "…"
              : t("admin.sendReport")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dispatch(logout())}
          >
            {t("auth.logout")}
          </Button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-card">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {tab === "sales" && <SalesStats />}
        {tab === "debt" && <DebtStats />}
      </main>
    </div>
  );
}
