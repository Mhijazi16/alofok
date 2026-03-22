import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Package,
  FileText,
  BookOpen,
  ChevronRight,
} from "@/lib/icons";
import { customerApi } from "@/services/customerApi";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useTranslation();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: customerApi.getProfile,
    staleTime: 2 * 60 * 1000,
  });

  const formatCurrency = (val: number) =>
    Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const quickActions: {
    view: string;
    icon: typeof Package;
    label: string;
    accent: string;
    iconBg: string;
  }[] = [
    {
      view: "catalog",
      icon: Package,
      label: t("portal.browseCatalog"),
      accent: "hover:border-primary/50",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      view: "orders",
      icon: BookOpen,
      label: t("portal.myOrders"),
      accent: "hover:border-info/50",
      iconBg: "bg-info/15 text-info",
    },
    {
      view: "statement",
      icon: FileText,
      label: t("portal.myStatement"),
      accent: "hover:border-violet-500/50",
      iconBg: "bg-violet-500/15 text-violet-400",
    },
  ];

  return (
    <div className="animate-fade-in space-y-5 p-4">
      {/* Greeting */}
      <div className="animate-slide-up space-y-0.5">
        <p className="text-caption text-muted-foreground">{t("portal.welcome")}</p>
        {isLoading ? (
          <Skeleton variant="text" className="h-7 w-40" />
        ) : (
          <h1 className="text-h2 font-bold text-foreground">
            {profile?.name ?? t("portal.customer")}
          </h1>
        )}
      </div>

      {/* Balance Card */}
      {isLoading ? (
        <Skeleton variant="card" className="h-28 animate-slide-up" />
      ) : (
        <StatCard
          variant="gradient"
          value={formatCurrency(profile?.balance ?? 0)}
          label={t("portal.currentBalance")}
          icon={DollarSign}
          className="animate-slide-up"
          style={{ animationDelay: "60ms" }}
          footer={
            profile?.city ? (
              <span className="text-caption text-foreground/70">
                {profile.city}
                {profile.assigned_day ? ` · ${profile.assigned_day}` : ""}
              </span>
            ) : undefined
          }
        />
      )}

      {/* Quick Actions */}
      <div
        className="animate-slide-up space-y-2"
        style={{ animationDelay: "120ms" }}
      >
        <p className="text-body-sm font-medium text-muted-foreground px-0.5">
          {t("portal.quickActions")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.view}
                variant="interactive"
                className={cn(
                  "animate-scale-in",
                  action.accent
                )}
                style={{ animationDelay: `${(idx + 2) * 60}ms` }}
                onClick={() => onNavigate(action.view)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      action.iconBg
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="flex-1 text-body-sm font-semibold text-foreground">
                    {action.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
