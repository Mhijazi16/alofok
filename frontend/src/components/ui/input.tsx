import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-card text-foreground shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      inputSize: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-3 py-2 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  }
);

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  error?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, startIcon, endIcon, inputSize, ...props }, ref) => {
    if (startIcon || endIcon) {
      return (
        <div
          className={cn(
            "relative flex items-center",
            className
          )}
        >
          {startIcon && (
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ inputSize }),
              error &&
                "border-destructive focus-visible:ring-destructive",
              startIcon && "ps-10",
              endIcon && "pe-10",
              "border-border"
            )}
            ref={ref}
            {...props}
          />
          {endIcon && (
            <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground">
              {endIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          inputVariants({ inputSize }),
          error &&
            "border-destructive focus-visible:ring-destructive",
          "border-border",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
export type { InputProps };
