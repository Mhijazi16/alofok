import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: string;
  error?: string;
  description?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, error, description, required, htmlFor, className, children }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1.5", className)}>
        {label && (
          <label
            htmlFor={htmlFor}
            className="block text-body-sm font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="ms-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        {description && (
          <p className="text-caption text-muted-foreground">{description}</p>
        )}
        {children}
        {error && (
          <p className="text-caption text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
export type { FormFieldProps };
