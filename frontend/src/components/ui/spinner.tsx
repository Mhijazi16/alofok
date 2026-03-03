import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    },
    color: {
      primary: "text-primary",
      white: "text-white",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    size: "md",
    color: "primary",
  },
});

type SpinnerVariantProps = VariantProps<typeof spinnerVariants>;

interface SpinnerProps extends Omit<React.SVGAttributes<SVGSVGElement>, "color"> {
  size?: SpinnerVariantProps["size"];
  color?: SpinnerVariantProps["color"];
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size, color, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className={cn(spinnerVariants({ size, color, className }))}
        role="status"
        aria-label="Loading"
        {...props}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }
);
Spinner.displayName = "Spinner";

interface FullPageSpinnerProps extends SpinnerProps {
  /** Text to display below the spinner */
  label?: string;
}

const FullPageSpinner: React.FC<FullPageSpinnerProps> = ({
  label,
  size = "lg",
  color = "primary",
  ...props
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={size} color={color} {...props} />
        {label && (
          <p className="text-body-sm text-muted-foreground animate-pulse-slow">
            {label}
          </p>
        )}
      </div>
    </div>
  );
};
FullPageSpinner.displayName = "FullPageSpinner";

export { Spinner, FullPageSpinner, spinnerVariants };
export type { SpinnerProps, FullPageSpinnerProps };
