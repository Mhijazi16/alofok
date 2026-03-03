import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/15 text-destructive",
        outline: "border border-border text-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        info: "bg-info/15 text-info",
        danger: "bg-destructive/15 text-destructive",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.625rem]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const dotColorMap: Record<string, string> = {
  default: "bg-primary",
  secondary: "bg-secondary-foreground",
  destructive: "bg-destructive",
  outline: "bg-foreground",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, dot = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        badgeVariants({ variant, size }),
        dot && "gap-1.5",
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            dotColorMap[variant ?? "default"]
          )}
        />
      )}
      {children}
    </div>
  )
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
export type { BadgeProps };
