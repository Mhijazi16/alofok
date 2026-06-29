import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { AnimatedIconHandle } from "@/components/ui/animated-icon";

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
  /** Animated icon component — React.forwardRef component with AnimatedIconHandle */
  icon: React.ForwardRefExoticComponent<any & React.RefAttributes<AnimatedIconHandle>>;
  label: string;
  value: string;
  badge?: number;
}

interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  items: BottomNavItem[];
  activeValue: string;
  onValueChange: (value: string) => void;
}

const spring = { type: "spring", stiffness: 500, damping: 35 } as const;

function NavIcon({
  icon: Icon,
  active,
}: {
  icon: BottomNavItem["icon"];
  active: boolean;
}) {
  const iconRef = React.useRef<AnimatedIconHandle>(null);
  const prevActive = React.useRef(active);

  React.useEffect(() => {
    const handle = iconRef.current;
    // Only animated icons expose startAnimation; a raw lucide icon's ref is the
    // <svg> node (truthy but has no startAnimation) — guard so it can't throw.
    if (
      active &&
      !prevActive.current &&
      handle &&
      typeof handle.startAnimation === "function"
    ) {
      const t = setTimeout(() => handle.startAnimation(), 200);
      prevActive.current = active;
      return () => clearTimeout(t);
    }
    prevActive.current = active;
  }, [active]);

  return <Icon ref={iconRef} size={20} />;
}

/**
 * Floating pill-dock bottom navigation (21stock-style):
 * a centered, fully-rounded capsule that floats above the content.
 * Inactive tabs are icon-only; the active tab fills with a tinted pill and
 * its label slides in beside the icon. The whole dock auto-hides on scroll-down.
 */
const BottomNav = React.forwardRef<HTMLElement, BottomNavProps>(
  ({ items, activeValue, onValueChange, className, ...props }, ref) => {
    const visibleItems = items.slice(0, 6);
    const hidden = useScrollDirection();

    return (
      <nav
        ref={ref}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-transform duration-300",
          "bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))]",
          hidden &&
            "translate-y-[calc(100%+1.5rem+env(safe-area-inset-bottom,0px))]",
          className
        )}
        {...props}
      >
        <motion.div
          layout
          transition={spring}
          className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full border border-border/50 bg-background/80 px-1.5 py-1.5 shadow-lg shadow-black/25 backdrop-blur-xl"
        >
          {visibleItems.map((item) => {
            const isActive = item.value === activeValue;

            return (
              <motion.button
                key={item.value}
                layout
                transition={spring}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onValueChange(item.value)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full py-2.5 transition-colors duration-200",
                  isActive
                    ? "bg-primary/15 px-3 text-primary"
                    : "px-2 text-muted-foreground hover:text-foreground"
                )}
              >
                <motion.span
                  layout
                  className="relative flex shrink-0 items-center justify-center"
                >
                  <NavIcon icon={item.icon} active={isActive} />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold text-destructive-foreground">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </motion.span>
                <AnimatePresence initial={false} mode="popLayout">
                  {isActive && (
                    <motion.span
                      key={item.value + "-label"}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={spring}
                      className="overflow-hidden text-ellipsis whitespace-nowrap text-body-sm font-semibold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </motion.div>
      </nav>
    );
  }
);
BottomNav.displayName = "BottomNav";

export { BottomNav };
export type { BottomNavProps, BottomNavItem };
