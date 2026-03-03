import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Timeline (container)                                               */
/* ------------------------------------------------------------------ */

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {}

const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative space-y-0", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Timeline.displayName = "Timeline";

/* ------------------------------------------------------------------ */
/*  TimelineItem                                                       */
/* ------------------------------------------------------------------ */

const dotVariants = cva(
  "relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2",
  {
    variants: {
      variant: {
        default: "border-muted-foreground bg-background",
        success: "border-success bg-success/20",
        warning: "border-warning bg-warning/20",
        destructive: "border-destructive bg-destructive/20",
        info: "border-info bg-info/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TimelineItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dotVariants> {
  title?: string;
  timestamp?: string;
  description?: string;
  active?: boolean;
  isLast?: boolean;
}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  (
    {
      className,
      variant,
      title,
      timestamp,
      description,
      active = false,
      isLast = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("relative flex gap-3 pb-6", isLast && "pb-0", className)}
        {...props}
      >
        {/* Vertical connector line */}
        <div className="flex flex-col items-center">
          {/* Dot */}
          <span
            className={cn(
              dotVariants({ variant }),
              active && "animate-pulse-slow ring-2 ring-current ring-offset-2 ring-offset-background"
            )}
          />
          {/* Line */}
          {!isLast && (
            <div className="mt-1 w-0.5 flex-1 bg-border" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pb-1">
          <div className="flex items-baseline justify-between gap-2">
            {title && (
              <p className="text-body-sm font-medium text-foreground">
                {title}
              </p>
            )}
            {timestamp && (
              <span className="shrink-0 text-caption text-muted-foreground">
                {timestamp}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-caption text-muted-foreground">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    );
  }
);
TimelineItem.displayName = "TimelineItem";

export { Timeline, TimelineItem, dotVariants };
export type { TimelineProps, TimelineItemProps };
