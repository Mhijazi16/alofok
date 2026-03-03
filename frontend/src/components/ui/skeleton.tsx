import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva(
  "animate-shimmer bg-muted bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]",
  {
    variants: {
      variant: {
        text: "h-4 w-full rounded-md",
        circle: "rounded-full",
        card: "h-32 w-full rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "text",
    },
  }
);

interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, style, ...props }, ref) => {
    const circleStyles =
      variant === "circle"
        ? { width: style?.width ?? "3rem", height: style?.height ?? style?.width ?? "3rem" }
        : undefined;

    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant }), className)}
        style={circleStyles ? { ...style, ...circleStyles } : style}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton, skeletonVariants };
export type { SkeletonProps };
