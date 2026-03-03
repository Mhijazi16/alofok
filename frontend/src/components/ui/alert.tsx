import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex gap-3 rounded-lg border-s-4 p-4 text-sm animate-slide-up",
  {
    variants: {
      variant: {
        default:
          "glass border-s-muted-foreground text-foreground",
        info:
          "glass border-s-info text-foreground",
        success:
          "glass border-s-success text-foreground",
        warning:
          "glass border-s-warning text-foreground",
        error:
          "glass border-s-destructive text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const VARIANT_ICONS: Record<string, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const VARIANT_ICON_COLORS: Record<string, string> = {
  default: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant,
      icon: iconProp,
      title,
      description,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const [dismissed, setDismissed] = React.useState(false);
    const variantKey = variant ?? "default";
    const Icon = iconProp ?? VARIANT_ICONS[variantKey];
    const iconColor = VARIANT_ICON_COLORS[variantKey];

    if (dismissed) return null;

    const handleDismiss = () => {
      setDismissed(true);
      onDismiss?.();
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant, className }))}
        {...props}
      >
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
        <div className="flex-1 space-y-1">
          {title && (
            <p className="text-body-sm font-semibold text-foreground">
              {title}
            </p>
          )}
          {description && (
            <p className="text-caption text-muted-foreground">{description}</p>
          )}
          {children}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert, alertVariants };
export type { AlertProps };
