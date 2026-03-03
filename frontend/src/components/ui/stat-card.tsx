import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const statCardVariants = cva(
  "rounded-2xl border border-border p-3 sm:p-5 transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-card",
        glass: "glass",
        gradient: "gradient-card",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatCardTrend {
  value: number;
  direction: "up" | "down";
}

interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  trend?: StatCardTrend;
  footer?: React.ReactNode;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { className, variant, value, label, icon: Icon, trend, footer, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(statCardVariants({ variant, className }))}
        {...props}
      >
        {Icon && (
          <div className="mb-2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/15">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
        )}
        <p className="text-body sm:text-h3 font-bold text-foreground break-words">{value}</p>
        <p className="mt-1 text-caption sm:text-body-sm text-muted-foreground">{label}</p>

        {trend && (
          <div className="mt-3 flex items-center gap-1">
            {trend.direction === "up" ? (
              <ArrowUp className="h-3.5 w-3.5 text-success" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={cn(
                "text-caption font-medium",
                trend.direction === "up"
                  ? "text-success"
                  : "text-destructive"
              )}
            >
              {trend.value}%
            </span>
          </div>
        )}

        {footer && <div className="mt-3 border-t border-border pt-3">{footer}</div>}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";

export { StatCard, statCardVariants };
export type { StatCardProps, StatCardTrend };
