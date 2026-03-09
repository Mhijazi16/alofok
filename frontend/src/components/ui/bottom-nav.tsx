import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function useScrollDirection() {
  const [hidden, setHidden] = React.useState(false);
  const lastY = React.useRef(0);

  React.useEffect(() => {
    const threshold = 10;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < threshold) return;
      setHidden(y > lastY.current && y > 60);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

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
    const hidden = useScrollDirection();

    return (
      <nav
        ref={ref}
        className={cn(
          "fixed z-40 inset-x-3 mx-auto max-w-lg rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl shadow-lg shadow-black/20 transition-transform duration-300",
          "bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          hidden && "translate-y-[calc(100%+2rem+env(safe-area-inset-bottom,0px))]",
          className
        )}
        {...props}
      >
        <div className="flex h-16 items-center justify-around">
          {visibleItems.map((item) => {
            const isActive = item.value === activeValue;
            const Icon = item.icon;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onValueChange(item.value)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-2 inset-y-1 rounded-xl bg-primary/10" />
                )}
                <div className="relative">
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
                <span className="relative text-[0.625rem] font-medium leading-tight">
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
