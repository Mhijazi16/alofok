import * as React from "react";
import { ArrowLeft, ArrowRight } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  subtitle?: string;
  backButton?: {
    onBack: () => void;
  };
  actions?: React.ReactNode;
}

const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  ({ title, subtitle, backButton, actions, className, ...props }, ref) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "ar";
    const BackIcon = isRTL ? ArrowRight : ArrowLeft;

    return (
      <header
        ref={ref}
        className={cn(
          "sticky top-0 z-40",
          // Full-bleed: break out of any parent container
          "left-0 right-0 w-screen -mx-[calc((100vw-100%)/2)]",
          "border-b border-border/50 bg-background/80 backdrop-blur-md",
          className
        )}
        {...props}
      >
        <div className="pt-safe" />
        <div className="flex h-12 items-center gap-3 px-4">
          {/* Back button */}
          {backButton && (
            <button
              type="button"
              onClick={backButton.onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            >
              <BackIcon className="h-4 w-4" />
            </button>
          )}

          {/* Title area */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-body font-semibold text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-caption text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          )}
        </div>
      </header>
    );
  }
);
TopBar.displayName = "TopBar";

export { TopBar };
export type { TopBarProps };
