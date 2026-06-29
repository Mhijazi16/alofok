import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "alofok-install-dismissed";

/**
 * App-wide install nudge. On Android/desktop it captures the native
 * `beforeinstallprompt` event and offers a one-tap Install button; on iOS
 * (which has no such event) it shows Add-to-Home-Screen instructions. Hidden
 * when already running standalone or once dismissed.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    const apple = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);

    if (apple) {
      if (sessionStorage.getItem(DISMISS_KEY) === "true") return;
      setIsIOS(true);
      setShow(true);
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const installed = () => setShow(false);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  }, [deferred]);

  const dismiss = useCallback(() => {
    (isIOS ? sessionStorage : localStorage).setItem(DISMISS_KEY, "true");
    setShow(false);
  }, [isIOS]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <img src="/pwa-192x192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-foreground">
          {t("pwa.installTitle")}
        </p>
        <p className="text-caption text-muted-foreground">
          {isIOS ? t("pwa.installIosHint") : t("pwa.installHint")}
        </p>
      </div>
      {!isIOS && (
        <Button size="sm" onClick={install} className="shrink-0">
          <Download className="h-4 w-4" />
          {t("pwa.install")}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
        aria-label={t("actions.cancel")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
