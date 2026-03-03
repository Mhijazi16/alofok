import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchRootVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
  {
    variants: {
      size: {
        sm: "h-4 w-7",
        default: "h-5 w-9",
        lg: "h-6 w-11",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const switchThumbVariants = cva(
  "pointer-events-none block rounded-full bg-foreground shadow-lg ring-0 transition-transform duration-200 data-[state=unchecked]:translate-x-0",
  {
    variants: {
      size: {
        sm: "h-3 w-3 data-[state=checked]:translate-x-3 rtl:data-[state=checked]:-translate-x-3",
        default:
          "h-4 w-4 data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4",
        lg: "h-5 w-5 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchRootVariants> {}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(switchRootVariants({ size, className }))}
    {...props}
  >
    <SwitchPrimitive.Thumb className={cn(switchThumbVariants({ size }))} />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
export type { SwitchProps };
