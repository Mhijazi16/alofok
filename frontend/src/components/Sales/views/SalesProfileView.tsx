import { useTranslation } from "react-i18next";
import { Globe, LogOut, Info, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TopBar } from "@/components/ui/top-bar";
import { useTheme } from "@/hooks/useTheme";
import { useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { SyncStatusCard } from "@/components/shared/SyncStatusCard";

interface SalesProfileViewProps {
  userId: string | null;
  role: string | null;
  avatarSeed: string;
  onAvatarChange: (seed: string) => void;
}

export function SalesProfileView({
  userId,
  role,
  avatarSeed,
  onAvatarChange,
}: SalesProfileViewProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { isDark, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  return (
    <div className="animate-fade-in">
      <TopBar title={t("profile.title")} />
      <div className="space-y-4 p-4">
        {/* User Card */}
        <Card variant="glass" className="animate-slide-up">
          <CardContent className="flex items-center gap-4 p-5">
            <AvatarPicker
              currentSeed={avatarSeed}
              onSelect={onAvatarChange}
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

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15">
                {isDark ? (
                  <Moon className="h-4 w-4 text-warning" />
                ) : (
                  <Sun className="h-4 w-4 text-warning" />
                )}
              </div>
              <div className="flex-1 text-start">
                <p className="text-body-sm font-medium text-foreground">
                  {t("profile.theme")}
                </p>
              </div>
              <Badge variant="outline" size="sm">
                {isDark ? t("profile.darkMode") : t("profile.lightMode")}
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

        {/* Sync Status */}
        <div
          className="animate-slide-up"
          style={{ animationDelay: "90ms" }}
        >
          <SyncStatusCard />
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full animate-slide-up"
          style={{ animationDelay: "150ms" }}
          onClick={() => dispatch(logout())}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </div>
  );
}
