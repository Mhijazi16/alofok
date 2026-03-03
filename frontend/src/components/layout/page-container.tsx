import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  noPadding?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  full: "max-w-full",
};

export function PageContainer({
  children,
  className,
  maxWidth = "xl",
  noPadding = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full animate-fade-in",
        maxWidthClasses[maxWidth],
        !noPadding && "px-4 py-4 lg:px-6 lg:py-6",
        className
      )}
    >
      {children}
    </div>
  );
}
