import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

interface SeparatorProps
  extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  label?: string;
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    {
      className,
      orientation = "horizontal",
      decorative = true,
      label,
      ...props
    },
    ref
  ) => {
    if (label && orientation === "horizontal") {
      return (
        <div className="flex items-center gap-3">
          <SeparatorPrimitive.Root
            ref={ref}
            decorative={decorative}
            orientation="horizontal"
            className={cn("shrink bg-border h-[1px] flex-1", className)}
            {...props}
          />
          <span className="rounded-full bg-background px-3 py-0.5 text-caption text-muted-foreground whitespace-nowrap">
            {label}
          </span>
          <SeparatorPrimitive.Root
            decorative={decorative}
            orientation="horizontal"
            className={cn("shrink bg-border h-[1px] flex-1", className)}
          />
        </div>
      );
    }

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
export type { SeparatorProps };
