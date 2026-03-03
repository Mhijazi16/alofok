import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressTrackVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-muted/30",
  {
    variants: {
      size: {
        sm: "h-1",
        default: "h-2",
        lg: "h-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const progressIndicatorColors = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

type ProgressColor = keyof typeof progressIndicatorColors;

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressTrackVariants> {
  /** Color variant of the progress fill */
  color?: ProgressColor;
  /** Show a label with text and percentage above the bar */
  label?: string;
  /** Whether to show the percentage text next to the label */
  showPercentage?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value,
      size,
      color = "primary",
      label,
      showPercentage = true,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max(value ?? 0, 0), 100);

    return (
      <div className="w-full">
        {label && (
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption text-muted-foreground">{label}</span>
            {showPercentage && (
              <span className="text-caption text-muted-foreground tabular-nums">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(progressTrackVariants({ size, className }))}
          value={percentage}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              progressIndicatorColors[color]
            )}
            style={{ width: `${percentage}%` }}
          />
        </ProgressPrimitive.Root>
      </div>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export type { ProgressProps, ProgressColor };
