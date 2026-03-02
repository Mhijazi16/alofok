import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  Users,
  User,
  LogOut,
  Globe,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { useToast } from "@/hooks/useToast";
import { adminApi } from "@/services/adminApi";

import { Overview } from "./Overview";
import { SalesStats } from "./SalesStats";
import { DebtStats } from "./DebtStats";
import { CustomerImport } from "./CustomerImport";

type AdminView = "overview" | "sales" | "debt" | "customers" | "profile";

export default function AdminPanel() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const userId = useAppSelector((s) => s.auth.userId);
  const role = useAppSelector((s) => s.auth.role);

  const [activeView, setActiveView] = useState<AdminView>("overview");

  const eodMutation = useMutation({
    mutationFn: () => adminApi.sendEodReport(),
    onSuccess: (data) => {
      toast({
        title: t("admin.reportSent"),
        description: `${data.date} — ${data.rows} rows`,
        variant: "success",
      });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const navItems = [
    { icon: LayoutDashboard, label: t("nav.overview"), value: "overview" },
    { icon: TrendingUp, label: t("nav.sales"), value: "sales" },
    { icon: AlertTriangle, label: t("nav.debt"), value: "debt" },
    { icon: Users, label: t("nav.customers"), value: "customers" },
    { icon: User, label: t("profile.title"), value: "profile" },
  ];

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <Overview />;
      case "sales":
        return <SalesStats />;
      case "debt":
        return <DebtStats />;
      case "customers":
        return <CustomerImport />;
      case "profile":
        return (
          <PageContainer>
            <div className="mx-auto max-w-md space-y-6">
              <h2 className="text-h2 font-bold text-foreground">
                {t("profile.title")}
              </h2>

              <Card variant="glass">
                <CardContent className="p-6 space-y-5">
                  {/* User info */}
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-semibold text-foreground truncate">
                        {userId ?? "—"}
                      </p>
                      <Badge variant="default" size="sm" className="mt-1">
                        {role ?? "—"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Language toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span className="text-body-sm">{t("profile.language")}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleLanguage}>
                      {i18n.language === "ar"
                        ? t("profile.english")
                        : t("profile.arabic")}
                    </Button>
                  </div>

                  <Separator />

                  {/* Version */}
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-muted-foreground">
                      {t("profile.version")}
                    </span>
                    <span className="text-foreground font-medium tabular-nums">
                      1.0.0
                    </span>
                  </div>

                  <Separator />

                  {/* Logout */}
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </PageContainer>
        );
      default:
        return <Overview />;
    }
  };

  return (
    <AppShell
      bottomNav={
        <BottomNav
          items={navItems}
          activeValue={activeView}
          onValueChange={(v) => setActiveView(v as AdminView)}
        />
      }
    >
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-8">
        {renderView()}
      </div>
    </AppShell>
  );
}
