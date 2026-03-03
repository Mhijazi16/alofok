import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  LogOut,
  Info,
  Phone,
  MapPin,
  DollarSign,
  User,
} from "lucide-react";
import { customerApi } from "@/services/customerApi";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";

export function ProfileView() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: customerApi.getProfile,
    staleTime: 2 * 60 * 1000,
  });

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  const formatCurrency = (val: number) =>
    Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="animate-fade-in">
      <TopBar title={t("profile.title")} />

      <div className="space-y-4 p-4">
        {/* Profile Card */}
        <Card variant="glass" className="animate-slide-up">
          <CardContent className="p-5">
            {isLoading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Skeleton variant="circle" className="h-16 w-16" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="h-5 w-32" />
                    <Skeleton variant="text" className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-h3 font-bold text-foreground truncate">
                      {profile?.name ?? t("portal.customer")}
                    </p>
                    <Badge variant="default" dot className="mt-1">
                      {t("portal.portalRole")}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Detail rows */}
                <div className="space-y-3">
                  {profile?.phone && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/15">
                        <Phone className="h-4 w-4 text-info" />
                      </div>
                      <div className="flex-1">
                        <p className="text-caption text-muted-foreground">
                          {t("customer.phone")}
                        </p>
                        <p className="text-body-sm font-medium text-foreground">
                          {profile.phone}
                        </p>
                      </div>
                    </div>
                  )}

                  {profile?.city && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                        <MapPin className="h-4 w-4 text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-caption text-muted-foreground">
                          {t("customer.city")}
                        </p>
                        <p className="text-body-sm font-medium text-foreground">
                          {profile.city}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-caption text-muted-foreground">
                        {t("portal.currentBalance")}
                      </p>
                      <p className="text-body-sm font-bold text-foreground">
                        {formatCurrency(profile?.balance ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Card */}
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
}
