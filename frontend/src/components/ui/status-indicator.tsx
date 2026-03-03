import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusVariantMap = {
  online: "bg-success",
  offline: "bg-destructive",
  pending: "bg-warning",
  neutral: "bg-muted-foreground",
} as const;

const statusLabelColorMap = {
  online: "text-success",
  offline: "text-destructive",
  pending: "text-warning",
  neutral: "text-muted-foreground",
} as const;

type StatusVariant = keyof typeof statusVariantMap;

const statusDotVariants = cva("shrink-0 rounded-full", {
  variants: {
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const statusTextVariants = cva("font-medium leading-none", {
  variants: {
    size: {
      sm: "text-caption",
      md: "text-body-sm",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface StatusIndicatorProps
  extends VariantProps<typeof statusDotVariants> {
  /** The status variant controlling color and animation */
  variant: StatusVariant;
  /** Text label displayed next to the dot */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  variant,
  label,
  size,
  className,
}) => {
  const isPulsing = variant === "online" || variant === "pending";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative inline-flex">
        {isPulsing && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-75",
              statusVariantMap[variant]
            )}
          />
        )}
        <span
          className={cn(
            statusDotVariants({ size }),
            statusVariantMap[variant],
            "relative"
          )}
        />
      </span>
      {label && (
        <span
          className={cn(
            statusTextVariants({ size }),
            statusLabelColorMap[variant]
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
};
StatusIndicator.displayName = "StatusIndicator";

export { StatusIndicator };
export type { StatusIndicatorProps, StatusVariant };
