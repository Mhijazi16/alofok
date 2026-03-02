import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, PlusCircle, User, LogOut, Globe } from "lucide-react";

import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import type { Product } from "@/services/designerApi";

import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { ProductList } from "./ProductList";
import { ProductForm } from "./ProductForm";

// ── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "create" | "edit" | "profile";

const APP_VERSION = "1.0.0";

// ── Component ────────────────────────────────────────────────────────────────

export default function DesignerShell() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { userId, role } = useAppSelector((s) => s.auth);

  const [view, setView] = useState<View>("list");
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(
    undefined
  );

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const handleNav = (value: string) => {
    if (value === "list" || value === "create" || value === "profile") {
      setView(value as View);
      setEditingProduct(undefined);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setView("edit");
  };

  const handleAdd = () => {
    setEditingProduct(undefined);
    setView("create");
  };

  const handleFormDone = () => {
    setEditingProduct(undefined);
    setView("list");
  };

  const handleFormBack = () => {
    setEditingProduct(undefined);
    setView("list");
  };

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  // ── BottomNav items ────────────────────────────────────────────────────────

  const navItems = [
    { icon: Package, label: t("nav.products"), value: "list" },
    { icon: PlusCircle, label: t("nav.addProduct"), value: "create" },
    { icon: User, label: t("nav.profile"), value: "profile" },
  ];

  const activeNavValue =
    view === "edit" ? "list" : view === "create" ? "create" : view;

  // ── Profile view ───────────────────────────────────────────────────────────

  const profileView = (
    <PageContainer>
      <div className="mx-auto max-w-md space-y-4 pt-4">
        {/* User card */}
        <Card variant="glass">
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <Avatar
              size="lg"
              name={userId ?? "Designer"}
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
        </Card>

        {/* Settings */}
        <Card variant="glass">
          <CardContent className="p-0">
            {/* Language toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex w-full items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-accent"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-body-sm font-medium text-foreground">
                  {t("profile.language")}
                </p>
                <p className="text-caption text-muted-foreground">
                  {i18n.language === "ar"
                    ? t("profile.arabic")
                    : t("profile.english")}
                </p>
              </div>
            </button>

            <Separator />

            {/* Version */}
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-body-sm text-muted-foreground">
                {t("profile.version")}
              </p>
              <p className="text-body-sm font-medium text-foreground">
                {APP_VERSION}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          size="lg"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </PageContainer>
  );

  // ── Main content router ────────────────────────────────────────────────────

  let content: React.ReactNode;

  switch (view) {
    case "list":
      content = <ProductList onEdit={handleEdit} onAdd={handleAdd} />;
      break;
    case "create":
      content = (
        <ProductForm onBack={handleFormBack} onDone={handleFormDone} />
      );
      break;
    case "edit":
      content = (
        <ProductForm
          product={editingProduct}
          onBack={handleFormBack}
          onDone={handleFormDone}
        />
      );
      break;
    case "profile":
      content = profileView;
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
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-8">
        {content}
      </div>
    </AppShell>
  );
}
