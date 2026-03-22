"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ── All animated icon imports ──
import { ArrowDownIcon } from "@/components/ui/animated-icons/arrow-down";
import { ArrowLeftIcon } from "@/components/ui/animated-icons/arrow-left";
import { ArrowRightIcon } from "@/components/ui/animated-icons/arrow-right";
import { ArrowUpIcon } from "@/components/ui/animated-icons/arrow-up";
import { CartIcon } from "@/components/ui/animated-icons/cart";
import { ChartPieIcon } from "@/components/ui/animated-icons/chart-pie";
import { CheckIcon } from "@/components/ui/animated-icons/check";
import { ChevronDownIcon } from "@/components/ui/animated-icons/chevron-down";
import { ChevronLeftIcon } from "@/components/ui/animated-icons/chevron-left";
import { ChevronRightIcon } from "@/components/ui/animated-icons/chevron-right";
import { ChevronUpIcon } from "@/components/ui/animated-icons/chevron-up";
import { ClockIcon } from "@/components/ui/animated-icons/clock";
import { CopyIcon } from "@/components/ui/animated-icons/copy";
import { DeleteIcon } from "@/components/ui/animated-icons/delete";
import { DollarSignIcon } from "@/components/ui/animated-icons/dollar-sign";
import { DownloadIcon } from "@/components/ui/animated-icons/download";
import { EarthIcon } from "@/components/ui/animated-icons/earth";
import { HeartPulseIcon } from "@/components/ui/animated-icons/heart-pulse";
import { HomeIcon } from "@/components/ui/animated-icons/home";
import { LockIcon } from "@/components/ui/animated-icons/lock";
import { MapPinIcon } from "@/components/ui/animated-icons/map-pin";
import { MoonIcon } from "@/components/ui/animated-icons/moon";
import { PlusIcon } from "@/components/ui/animated-icons/plus";
import { RouteIcon } from "@/components/ui/animated-icons/route";
import { SearchIcon } from "@/components/ui/animated-icons/search";
import { SettingsIcon } from "@/components/ui/animated-icons/settings";
import { SunIcon } from "@/components/ui/animated-icons/sun";
import { TrendingDownIcon } from "@/components/ui/animated-icons/trending-down";
import { UploadIcon } from "@/components/ui/animated-icons/upload";
import { UsersIcon } from "@/components/ui/animated-icons/users";
import { UserIcon } from "@/components/ui/animated-icons/user";
import { XIcon } from "@/components/ui/animated-icons/x";

// ── Re-export for direct usage ──
export {
  ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon,
  CartIcon, ChartPieIcon, CheckIcon,
  ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon,
  ClockIcon, CopyIcon, DeleteIcon, DollarSignIcon, DownloadIcon,
  EarthIcon, HeartPulseIcon, HomeIcon, LockIcon, MapPinIcon,
  MoonIcon, PlusIcon, RouteIcon, SearchIcon, SettingsIcon,
  SunIcon, TrendingDownIcon, UploadIcon, UsersIcon, UserIcon, XIcon,
};

// ── Animated icon handle type ──
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

// ── Map lucide-react names → animated components ──
const ANIMATED_ICON_MAP: Record<string, React.ForwardRefExoticComponent<any>> = {
  ArrowDown: ArrowDownIcon,
  ArrowLeft: ArrowLeftIcon,
  ArrowRight: ArrowRightIcon,
  ArrowUp: ArrowUpIcon,
  ShoppingCart: CartIcon,
  ChartPie: ChartPieIcon,
  Check: CheckIcon,
  CheckCircle: CheckIcon,
  ChevronDown: ChevronDownIcon,
  ChevronLeft: ChevronLeftIcon,
  ChevronRight: ChevronRightIcon,
  ChevronUp: ChevronUpIcon,
  Clock: ClockIcon,
  Copy: CopyIcon,
  Trash2: DeleteIcon,
  DollarSign: DollarSignIcon,
  Download: DownloadIcon,
  Globe: EarthIcon,
  HeartPulse: HeartPulseIcon,
  Home: HomeIcon,
  Lock: LockIcon,
  MapPin: MapPinIcon,
  Moon: MoonIcon,
  Plus: PlusIcon,
  PlusCircle: PlusIcon,
  Route: RouteIcon,
  Search: SearchIcon,
  Settings: SettingsIcon,
  Sun: SunIcon,
  TrendingDown: TrendingDownIcon,
  Upload: UploadIcon,
  Users: UsersIcon,
  User: UserIcon,
  UserPlus: UserIcon,
  X: XIcon,
};

/**
 * Extracts pixel size from a className like "h-4 w-4" → 16, "h-5 w-5" → 20
 */
function extractSize(className?: string): number {
  if (!className) return 24;
  const match = className.match(/(?:h|w)-(\d+(?:\.\d+)?)/);
  if (!match) return 24;
  return parseFloat(match[1]) * 4; // Tailwind: h-4 = 16px, h-5 = 20px
}

/**
 * Drop-in replacement for any Lucide icon that auto-animates on mount.
 *
 * Usage: Instead of `<Search className="h-4 w-4" />`
 * Use:   `<AnimatedLucideIcon name="Search" className="h-4 w-4" />`
 *
 * Falls back to the animated icon if available, renders nothing if not found.
 */
export function AnimatedLucideIcon({
  name,
  className,
  animate = true,
}: {
  name: string;
  className?: string;
  animate?: boolean;
}) {
  const Component = ANIMATED_ICON_MAP[name];
  const ref = React.useRef<AnimatedIconHandle>(null);

  React.useEffect(() => {
    if (animate && ref.current) {
      const timer = setTimeout(() => ref.current?.startAnimation(), 150);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (!Component) return null;

  const size = extractSize(className);

  return (
    <div className={cn("inline-flex shrink-0", className)}>
      <Component ref={ref} size={size} />
    </div>
  );
}

/**
 * Hook to trigger animation on an animated icon ref.
 */
export function useIconAnimation(trigger: boolean) {
  const ref = React.useRef<AnimatedIconHandle>(null);
  React.useEffect(() => {
    if (trigger && ref.current) ref.current.startAnimation();
  }, [trigger]);
  return ref;
}
