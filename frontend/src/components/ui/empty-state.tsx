import * as React from "react";
import {
  Inbox,
  SearchX,
  WifiOff,
  AlertCircle,
  MapPinOff,
  PackageOpen,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface PresetConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

const presets: Record<string, PresetConfig> = {
  "no-data": {
    icon: Inbox,
    title: "No data yet",
    description: "There is no data to display at the moment.",
  },
  "no-results": {
    icon: SearchX,
    title: "No results found",
    description: "Try adjusting your search or filter criteria.",
  },
  offline: {
    icon: WifiOff,
    title: "You are offline",
    description:
      "Please check your internet connection and try again.",
  },
  error: {
    icon: AlertCircle,
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again later.",
  },
  "empty-route": {
    icon: MapPinOff,
    title: "No route assigned",
    description: "No customer route has been assigned to you yet.",
  },
  "no-products": {
    icon: PackageOpen,
    title: "No products",
    description: "No products have been added to the catalog yet.",
  },
};

type PresetName = keyof typeof presets;

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  preset?: PresetName;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: iconProp,
      title: titleProp,
      description: descriptionProp,
      action,
      preset,
      className,
      ...props
    },
    ref
  ) => {
    const presetConfig = preset ? presets[preset] : undefined;

    const Icon = iconProp ?? presetConfig?.icon ?? Inbox;
    const title = titleProp ?? presetConfig?.title;
    const description = descriptionProp ?? presetConfig?.description;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center px-6 py-12 text-center",
          className
        )}
        {...props}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        {title && (
          <h3 className="text-h3 text-foreground">{title}</h3>
        )}
        {description && (
          <p className="mt-1.5 max-w-sm text-body-sm text-muted-foreground">
            {description}
          </p>
        )}
        {action && (
          <Button
            variant="outline"
            onClick={action.onClick}
            className="mt-5"
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState, presets };
export type { EmptyStateProps, EmptyStateAction, PresetName };
