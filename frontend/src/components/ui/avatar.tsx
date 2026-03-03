import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden rounded-full border-2 border-border",
  {
    variants: {
      size: {
        xs: "h-6 w-6",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-14 w-14",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const avatarFallbackTextVariants = cva("font-medium font-cairo", {
  variants: {
    size: {
      xs: "text-[10px]",
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type StatusType = "online" | "offline" | "busy";

const STATUS_DOT_COLORS: Record<StatusType, string> = {
  online: "bg-success",
  offline: "bg-muted-foreground",
  busy: "bg-destructive",
};

const statusDotVariants = cva(
  "absolute bottom-0 end-0 rounded-full border-2 border-background",
  {
    variants: {
      size: {
        xs: "h-1.5 w-1.5",
        sm: "h-2 w-2",
        md: "h-2.5 w-2.5",
        lg: "h-3 w-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * Generate a deterministic hue from a name string.
 * Uses a simple hash to pick from a set of muted background colors.
 */
function getInitialsBg(name: string): string {
  const COLORS = [
    "bg-red-900/60",
    "bg-orange-900/60",
    "bg-amber-900/60",
    "bg-yellow-900/60",
    "bg-lime-900/60",
    "bg-green-900/60",
    "bg-emerald-900/60",
    "bg-teal-900/60",
    "bg-cyan-900/60",
    "bg-sky-900/60",
    "bg-blue-900/60",
    "bg-indigo-900/60",
    "bg-violet-900/60",
    "bg-purple-900/60",
    "bg-fuchsia-900/60",
    "bg-pink-900/60",
    "bg-rose-900/60",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Extract initials from a name string (up to 2 characters).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  name?: string;
  status?: StatusType;
}

function getDiceBearUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, src, alt, name, status, ...props }, ref) => {
  const initials = name ? getInitials(name) : "?";
  const fallbackBg = name ? getInitialsBg(name) : "bg-muted";
  const imgSrc = src
    ? src.startsWith("dicebear:")
      ? getDiceBearUrl(src.slice(9))
      : src
    : name
      ? getDiceBearUrl(name)
      : undefined;

  return (
    <div className="relative inline-flex">
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatarVariants({ size, className }))}
        {...props}
      >
        {imgSrc && (
          <AvatarPrimitive.Image
            src={imgSrc}
            alt={alt || name || ""}
            className="aspect-square h-full w-full object-cover"
          />
        )}
        <AvatarPrimitive.Fallback
          className={cn(
            "flex h-full w-full items-center justify-center text-foreground",
            fallbackBg,
            avatarFallbackTextVariants({ size })
          )}
          delayMs={imgSrc ? 600 : 0}
        >
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {status && (
        <span
          className={cn(
            statusDotVariants({ size }),
            STATUS_DOT_COLORS[status],
            status === "online" && "animate-pulse-slow"
          )}
          aria-label={status}
        />
      )}
    </div>
  );
});
Avatar.displayName = "Avatar";

export { Avatar, getInitials, getInitialsBg };
export type { AvatarProps, StatusType };
