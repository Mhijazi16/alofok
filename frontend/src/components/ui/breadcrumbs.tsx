import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, className, ...props }, ref) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "ar";
    const SeparatorIcon = isRTL ? ChevronLeft : ChevronRight;

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("flex items-center gap-1", className)}
        {...props}
      >
        <ol className="flex items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <SeparatorIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {isLast ? (
                  <span className="text-body-sm text-foreground">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <a
                    href={item.href}
                    onClick={item.onClick}
                    className="text-body-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="text-body-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
);
Breadcrumbs.displayName = "Breadcrumbs";

export { Breadcrumbs };
export type { BreadcrumbsProps, BreadcrumbItem };
