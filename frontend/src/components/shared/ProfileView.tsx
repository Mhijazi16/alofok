import { useTranslation } from "react-i18next";
import { Globe, LogOut, Info, Sun, Moon } from "@/lib/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TopBar } from "@/components/ui/top-bar";
import { useTheme } from "@/hooks/useTheme";

interface ProfileViewProps {
  /** Identity section rendered at the top (avatar, name, role badge) */
  identitySlot: React.ReactNode;
  /** Extra sections between settings and logout (e.g. SyncStatusCard) */
  extraSlot?: React.ReactNode;
  /** Logout handler */
  onLogout: () => void;
  /** Designer uses outline style logout */
  logoutVariant?: "destructive" | "outline";
  /** Extra className for the logout button (e.g. Designer's border-destructive styling) */
  logoutClassName?: string;
}

export function ProfileView({
  identitySlot,
  extraSlot,
  onLogout,
  logoutVariant = "destructive",
  logoutClassName,
}: ProfileViewProps) {
  const { t, i18n } = useTranslation();
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
        {/* Identity (role-specific) */}
        <Card variant="glass" className="animate-slide-up">
          {identitySlot}
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
            <Button
              variant="ghost"
              type="button"
              onClick={toggleLanguage}
              className="flex w-full items-center gap-3 rounded-xl p-3 justify-start h-auto"
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
            </Button>

            <Separator />

            {/* Theme toggle */}
            <Button
              variant="ghost"
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-xl p-3 justify-start h-auto"
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
            </Button>

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

        {/* Extra slot (e.g. SyncStatusCard) */}
        {extraSlot && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: "90ms" }}
          >
            {extraSlot}
          </div>
        )}

        {/* Logout */}
        <Button
          variant={logoutVariant}
          size="lg"
          className={
            logoutClassName ??
            "w-full animate-slide-up"
          }
          style={{ animationDelay: "150ms" }}
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </div>
  );
}
