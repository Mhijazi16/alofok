import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Package, User } from "lucide-react";

import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";

import { AppShell } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/ui/bottom-nav";
import { CardContent } from "@/components/ui/card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { ProfileView } from "@/components/shared/ProfileView";

import { ProductList } from "./ProductList";
import { ProductForm } from "./ProductForm";

// ── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "create" | "profile";

// ── Component ────────────────────────────────────────────────────────────────

export default function DesignerShell() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { userId, role } = useAppSelector((s) => s.auth);

  const [view, setView] = useState<View>("list");
  const [avatarSeed, setAvatarSeed] = useState(
    () => localStorage.getItem("alofok-avatar-seed") || userId || "designer"
  );
  useEffect(() => {
    localStorage.setItem("alofok-avatar-seed", avatarSeed);
  }, [avatarSeed]);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const handleNav = (value: string) => {
    if (value === "list" || value === "create" || value === "profile") {
      setView(value as View);
    }
  };

  const handleAdd = () => {
    setView("create");
  };

  const handleFormDone = () => {
    setView("list");
  };

  const handleFormBack = () => {
    setView("list");
  };

  // ── BottomNav items ────────────────────────────────────────────────────────

  const navItems = [
    { icon: Package, label: t("nav.products"), value: "list" },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const activeNavValue = view === "create" ? "list" : view;

  // ── Main content router ────────────────────────────────────────────────────

  let content: React.ReactNode;

  switch (view) {
    case "list":
      content = <ProductList onAdd={handleAdd} />;
      break;
    case "create":
      content = (
        <ProductForm onBack={handleFormBack} onDone={handleFormDone} />
      );
      break;
    case "profile":
      content = (
        <ProfileView
          identitySlot={
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <AvatarPicker
                currentSeed={avatarSeed}
                onSelect={setAvatarSeed}
              />
              <div className="text-center">
                <p className="text-h3 font-bold text-foreground">
                  {userId ?? "—"}
                </p>
                <p className="text-body-sm text-muted-foreground">
                  {t("profile.role")}: {role ?? "Designer"}
                </p>
              </div>
            </CardContent>
          }
          onLogout={() => dispatch(logout())}
          logoutVariant="outline"
          logoutClassName="w-full animate-slide-up border-destructive/30 text-destructive hover:bg-destructive/10"
        />
      );
      break;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      bottomNav={
        <BottomNav
          items={navItems}
          activeValue={activeNavValue}
          onValueChange={handleNav}
        />
      }
    >
      <div className="w-full">
        {content}
      </div>
    </AppShell>
  );
}
