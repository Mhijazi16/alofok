import * as React from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItem {
  icon: LucideIcon;
  label: string;
  value: string;
  badge?: number;
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarItem[];
  activeValue: string;
  onValueChange: (value: string) => void;
  footer?: React.ReactNode;
  logo?: React.ReactNode;
  /** Whether the sidebar starts collapsed on desktop */
  defaultCollapsed?: boolean;
  /** Mobile open state — controlled externally */
  mobileOpen?: boolean;
  /** Callback when the mobile overlay is closed */
  onMobileClose?: () => void;
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      items,
      activeValue,
      onValueChange,
      footer,
      logo,
      defaultCollapsed = false,
      mobileOpen = false,
      onMobileClose,
      className,
      ...props
    },
    ref
  ) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

    return (
      <>
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 glass md:hidden"
            onClick={onMobileClose}
          />
        )}

        {/* Sidebar */}
        <aside
          ref={ref}
          className={cn(
            // Base styles
            "flex flex-col border-e border-border bg-card",
            // Desktop: fixed, collapsible
            "hidden md:fixed md:inset-y-0 md:start-0 md:z-30 md:flex",
            collapsed ? "md:w-16" : "md:w-64",
            "transition-[width] duration-200",
            // Mobile: off-canvas overlay
            mobileOpen &&
              "fixed inset-y-0 start-0 z-50 flex w-64 animate-slide-in-right md:hidden rtl:animate-slide-in-left",
            !mobileOpen && "max-md:hidden",
            className
          )}
          {...props}
        >
          {/* Logo / Header area */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 md:h-16">
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0 flex-1">{logo}</div>
            )}

            {/* Mobile close */}
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = item.value === activeValue;
                const Icon = item.icon;
                const showLabel = !collapsed || mobileOpen;

                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => onValueChange(item.value)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm transition-colors",
                        isActive
                          ? "border-s-2 border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        collapsed && !mobileOpen && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {showLabel && (
                        <span className="flex-1 truncate text-start">
                          {item.label}
                        </span>
                      )}
                      {showLabel &&
                        item.badge != null &&
                        item.badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[0.625rem] font-bold text-primary">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      {!showLabel &&
                        item.badge != null &&
                        item.badge > 0 && (
                          <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          {footer && (
            <div
              className={cn(
                "shrink-0 border-t border-border p-3",
                collapsed && !mobileOpen && "flex items-center justify-center"
              )}
            >
              {footer}
            </div>
          )}
        </aside>
      </>
    );
  }
);
Sidebar.displayName = "Sidebar";

export { Sidebar };
export type { SidebarProps, SidebarItem };
