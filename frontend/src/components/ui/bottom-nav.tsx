import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  icon: LucideIcon;
  label: string;
  value: string;
  badge?: number;
}

interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  items: BottomNavItem[];
  activeValue: string;
  onValueChange: (value: string) => void;
}

const BottomNav = React.forwardRef<HTMLElement, BottomNavProps>(
  ({ items, activeValue, onValueChange, className, ...props }, ref) => {
    // Enforce max 5 items
    const visibleItems = items.slice(0, 5);

    return (
      <nav
        ref={ref}
        className={cn(
          "fixed z-40 bottom-2 inset-x-3 mx-auto max-w-lg rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl shadow-lg shadow-black/20 pb-safe",
          className
        )}
        {...props}
      >
        <div className="flex h-14 items-center justify-around">
          {visibleItems.map((item) => {
            const isActive = item.value === activeValue;
            const Icon = item.icon;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onValueChange(item.value)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  {isActive && (
                    <span className="absolute -inset-1.5 rounded-lg bg-primary/10" />
                  )}
                  <Icon
                    className={cn(
                      "relative h-5 w-5",
                      isActive && "fill-primary/20"
                    )}
                  />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold text-destructive-foreground">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[0.625rem] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }
);
BottomNav.displayName = "BottomNav";

export { BottomNav };
export type { BottomNavProps, BottomNavItem };
