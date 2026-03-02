import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export function AppShell({
  children,
  topBar,
  bottomNav,
  sidebar,
  className,
}: AppShellProps) {
  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      {sidebar && (
        <aside className="hidden lg:block flex-shrink-0">{sidebar}</aside>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        {topBar}

        {/* Page content */}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            bottomNav && "pb-24",
            className
          )}
        >
          {children}
        </main>

        {/* Mobile bottom nav */}
        {bottomNav && <div>{bottomNav}</div>}
      </div>
    </div>
  );
}
