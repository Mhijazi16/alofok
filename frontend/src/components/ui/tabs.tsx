import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Tabs (root)                                                        */
/* ------------------------------------------------------------------ */

const Tabs = TabsPrimitive.Root;

/* ------------------------------------------------------------------ */
/*  TabsList                                                           */
/* ------------------------------------------------------------------ */

const tabsListVariants = cva(
  "inline-flex items-center overflow-x-auto scrollbar-none",
  {
    variants: {
      variant: {
        underline:
          "gap-0 border-b border-border bg-transparent",
        pills:
          "gap-1 rounded-full bg-transparent p-0",
        segment:
          "gap-0 rounded-xl bg-muted p-1",
      },
    },
    defaultVariants: {
      variant: "underline",
    },
  }
);

type TabsListVariant = VariantProps<typeof tabsListVariants>["variant"];

const TabsVariantContext = React.createContext<TabsListVariant>("underline");

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

/* ------------------------------------------------------------------ */
/*  TabsTrigger                                                        */
/* ------------------------------------------------------------------ */

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        underline: cn(
          "relative px-4 py-2.5 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:text-primary",
          "data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:content-['']"
        ),
        pills: cn(
          "rounded-full px-4 py-2 text-muted-foreground",
          "hover:text-foreground hover:bg-accent",
          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        ),
        segment: cn(
          "flex-1 rounded-lg px-4 py-1.5 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        ),
      },
    },
    defaultVariants: {
      variant: "underline",
    },
  }
);

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant, className }))}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/* ------------------------------------------------------------------ */
/*  TabsContent                                                        */
/* ------------------------------------------------------------------ */

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
export type { TabsListProps, TabsListVariant };
