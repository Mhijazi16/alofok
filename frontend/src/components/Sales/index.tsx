import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Package, User, Globe, LogOut, Info } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import type { Customer } from "@/services/salesApi";

import { RouteView } from "./RouteView";
import { CustomerDashboard } from "./CustomerDashboard";
import { OrderFlow } from "./OrderFlow";
import { PaymentFlow } from "./PaymentFlow";
import { StatementView } from "./StatementView";
import { CustomerForm } from "./CustomerForm";

type View =
  | "route"
  | "catalog"
  | "profile"
  | "customer"
  | "order"
  | "payment"
  | "statement"
  | "customerForm";

export default function SalesRoot() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const userId = useAppSelector((s) => s.auth.userId);
  const role = useAppSelector((s) => s.auth.role);

  const [view, setView] = useState<View>("route");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [editingCustomer, setEditingCustomer] = useState<
    Customer | undefined
  >();

  const navigateToCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setView("customer");
  }, []);

  const navigateBack = useCallback(() => {
    if (view === "customer") {
      setView("route");
      setSelectedCustomer(null);
    } else if (view === "customerForm") {
      // Go back to where we came from
      if (selectedCustomer) {
        setView("customer");
      } else {
        setView("route");
      }
      setEditingCustomer(undefined);
    } else if (
      view === "order" ||
      view === "payment" ||
      view === "statement"
    ) {
      setView("customer");
    }
  }, [view, selectedCustomer]);

  const navigateToAddCustomer = useCallback(() => {
    setEditingCustomer(undefined);
    setView("customerForm");
  }, []);

  const navigateToEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setView("customerForm");
  }, []);

  const handleCustomerAction = useCallback(
    (action: "order" | "payment" | "statement" | "check") => {
      if (action === "check") {
        // For returned checks, navigate to statement view where user can manage checks
        setView("statement");
      } else {
        setView(action);
      }
    },
    []
  );

  const handleOrderDone = useCallback(() => {
    setView("customer");
  }, []);

  const handlePaymentDone = useCallback(() => {
    setView("customer");
  }, []);

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  const isMainView =
    view === "route" || view === "catalog" || view === "profile";

  const bottomNavItems = [
    { icon: MapPin, label: t("nav.route"), value: "route" },
    { icon: Package, label: t("nav.catalog"), value: "catalog" },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const renderMainView = () => {
    switch (view) {
      case "route":
        return (
          <RouteView
            onSelectCustomer={navigateToCustomer}
            onAddCustomer={navigateToAddCustomer}
          />
        );

      case "catalog":
        return selectedCustomer ? (
          <OrderFlow
            customer={selectedCustomer}
            onBack={() => setView("route")}
            onDone={handleOrderDone}
          />
        ) : (
          <div className="animate-fade-in">
            <TopBar title={t("nav.catalog")} />
            <OrderFlow
              customer={{ id: "", name: "", city: "", assigned_day: "", balance: 0 }}
              onBack={() => setView("route")}
              onDone={() => setView("route")}
            />
          </div>
        );

      case "profile":
        return (
          <div className="animate-fade-in">
            <TopBar title={t("profile.title")} />
            <div className="space-y-4 p-4">
              {/* User Card */}
              <Card variant="glass" className="animate-slide-up">
                <CardContent className="flex items-center gap-4 p-5">
                  <Avatar
                    name={userId ?? "User"}
                    size="lg"
                    status="online"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-h3 font-bold text-foreground truncate">
                      {userId ?? t("nav.profile")}
                    </p>
                    <Badge variant="default" dot className="mt-1">
                      {role ?? "Sales"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card
                variant="glass"
                className="animate-slide-up"
                style={{ animationDelay: "60ms" }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-body-sm text-muted-foreground">
                    {t("nav.settings")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-0">
                  {/* Language toggle */}
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/15">
                      <Globe className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-body-sm font-medium text-foreground">
                        {t("profile.language")}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      {i18n.language === "ar"
                        ? t("profile.arabic")
                        : t("profile.english")}
                    </Badge>
                  </button>

                  <Separator />

                  {/* App version */}
                  <div className="flex w-full items-center gap-3 rounded-xl p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-start">
                      <p className="text-body-sm font-medium text-foreground">
                        {t("profile.version")}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      1.0.0
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Logout */}
              <Button
                variant="destructive"
                size="lg"
                className="w-full animate-slide-up"
                style={{ animationDelay: "120ms" }}
                onClick={() => dispatch(logout())}
              >
                <LogOut className="h-4 w-4" />
                {t("auth.logout")}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderSubView = () => {
    if (view === "customerForm") {
      return (
        <CustomerForm
          customer={editingCustomer}
          onBack={navigateBack}
          onDone={() => {
            setEditingCustomer(undefined);
            if (selectedCustomer) {
              setView("customer");
            } else {
              setView("route");
            }
          }}
        />
      );
    }

    if (!selectedCustomer) return null;

    switch (view) {
      case "customer":
        return (
          <CustomerDashboard
            customer={selectedCustomer}
            onBack={navigateBack}
            onAction={handleCustomerAction}
            onEditCustomer={navigateToEditCustomer}
          />
        );
      case "order":
        return (
          <OrderFlow
            customer={selectedCustomer}
            onBack={navigateBack}
            onDone={handleOrderDone}
          />
        );
      case "payment":
        return (
          <PaymentFlow
            customer={selectedCustomer}
            onBack={navigateBack}
            onDone={handlePaymentDone}
          />
        );
      case "statement":
        return (
          <StatementView
            customer={selectedCustomer}
            onBack={navigateBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AppShell
      bottomNav={
        isMainView ? (
          <BottomNav
            items={bottomNavItems}
            activeValue={view}
            onValueChange={(v) => setView(v as View)}
          />
        ) : undefined
      }
    >
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-8">
        <OfflineBanner
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
        />

        {isMainView ? renderMainView() : renderSubView()}
      </div>
    </AppShell>
  );
}
