"use client";

/**
 * Animated icon wrappers that match the lucide-react API.
 *
 * Usage: Replace `import { Search } from "lucide-react"`
 * With:  `import { Search } from "@/lib/icons"`
 *
 * The component auto-animates on mount and accepts the same className prop.
 * Icons without animated equivalents fall back to lucide-react originals.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AnimatedIconHandle } from "@/components/ui/animated-icon";

// ── Animated icon component imports ──
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
import { HomeIcon } from "@/components/ui/animated-icons/home";
import { LockIcon } from "@/components/ui/animated-icons/lock";
import { MapPinIcon } from "@/components/ui/animated-icons/map-pin";
import { MoonIcon } from "@/components/ui/animated-icons/moon";
import { PlusIcon } from "@/components/ui/animated-icons/plus";
import { SearchIcon } from "@/components/ui/animated-icons/search";
import { SunIcon } from "@/components/ui/animated-icons/sun";
import { TrendingDownIcon } from "@/components/ui/animated-icons/trending-down";
import { UploadIcon } from "@/components/ui/animated-icons/upload";
import { UsersIcon } from "@/components/ui/animated-icons/users";
import { UserIcon } from "@/components/ui/animated-icons/user";
import { XIcon } from "@/components/ui/animated-icons/x";
import { FileTextIcon } from "@/components/ui/animated-icons/file-text";
import { HandCoinsIcon } from "@/components/ui/animated-icons/hand-coins";
import { BadgeAlertIcon } from "@/components/ui/animated-icons/badge-alert";
import { CalendarDaysIcon } from "@/components/ui/animated-icons/calendar-days";
import { ShieldCheckIcon } from "@/components/ui/animated-icons/shield-check";
import { SquarePenIcon } from "@/components/ui/animated-icons/square-pen";
import { UndoIcon } from "@/components/ui/animated-icons/undo";
import { HandGrabIcon } from "@/components/ui/animated-icons/hand-grab";

// ── Lucide-react originals for icons without animated equivalents ──
import {
  AlertCircle as _AlertCircle,
  ArrowLeftRight as _ArrowLeftRight,
  Archive as _Archive,
  Camera as _Camera,
  Circle as _Circle,
  ChevronsUpDown as _ChevronsUpDown,
  Database as _Database,
  FileCheck2 as _FileCheck2,
  FileDown as _FileDown,
  FileText as _FileText,
  GripVertical as _GripVertical,
  Hash as _Hash,
  HelpCircle as _HelpCircle,
  Image as _Image,
  Info as _Info,
  Landmark as _Landmark,
  Languages as _Languages,
  Loader2 as _Loader2,
  LogOut as _LogOut,
  Minus as _Minus,
  Package as _Package,
  PanelLeftClose as _PanelLeftClose,
  PanelLeftOpen as _PanelLeftOpen,
  Phone as _Phone,
  PlusCircle as _PlusCircle,
  RefreshCw as _RefreshCw,
  RotateCcw as _RotateCcw,
  ShoppingBag as _ShoppingBag,
  StickyNote as _StickyNote,
  Undo2 as _Undo2,
  UserPlus as _UserPlus,
  WifiOff as _WifiOff,
  File as _File,
  Star as _Star,
  Tag as _Tag,
  Weight as _Weight,
  Layers as _Layers,
  Box as _Box,
  Settings2 as _Settings2,
  SearchX as _SearchX,
  MapPinOff as _MapPinOff,
  PackageOpen as _PackageOpen,
  Inbox as _Inbox,
  UtensilsCrossed as _UtensilsCrossed,
  Fuel as _Fuel,
  Gift as _Gift,
  CarFront as _CarFront,
  MoreHorizontal as _MoreHorizontal,
  Zap as _Zap,
  Wifi as _Wifi,
  Wrench as _Wrench,
  Wallet as _Wallet,
  Receipt as _Receipt,
  CheckSquare as _CheckSquare,
  Square as _Square,
  Flag as _Flag,
  ArrowUpCircle as _ArrowUpCircle,
  ArrowDownCircle as _ArrowDownCircle,
  CreditCard as _CreditCard,
  CheckCircle2 as _CheckCircle2,
  Banknote as _BanknoteIcon,
    List as _List,
    LayoutGrid as _LayoutGrid,
    ArrowUpRight as _ArrowUpRight,
    ArrowDownRight as _ArrowDownRight,
    XCircle as _XCircle,
    BookOpen as _BookOpen,
    LayoutDashboard as _LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

/** Extract pixel size from Tailwind class like "h-4 w-4" → 16 */
function extractSize(cls?: string): number {
  if (!cls) return 24;
  const m = cls.match(/(?:^|\s)(?:h|w)-(\d+(?:\.\d+)?)(?:\s|$)/);
  return m ? parseFloat(m[1]) * 4 : 24;
}

/** Replay interval when hovering/tapping (ms) */
const HOVER_REPLAY_MS = 1200;
/** How long the loop plays on mobile after a tap (ms) */
const TOUCH_LOOP_DURATION = 3000;

/** Context to allow parent cards to trigger icon hover animation */
const IconHoverContext = React.createContext(false);

/**
 * Wrap a card/container with this to make all animated icons inside
 * replay their animation while the container is hovered (desktop)
 * or tapped (mobile — loops for a few seconds then stops).
 */
export function IconHoverZone({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const [active, setActive] = React.useState(false);
  const touchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTouchTimer = React.useCallback(() => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }, []);

  // Desktop hover
  const onMouseEnter = React.useCallback(() => setActive(true), []);
  const onMouseLeave = React.useCallback(() => setActive(false), []);

  // Mobile tap — activate for a few seconds
  const onTouchStart = React.useCallback(() => {
    clearTouchTimer();
    setActive(true);
    touchTimer.current = setTimeout(() => setActive(false), TOUCH_LOOP_DURATION);
  }, [clearTouchTimer]);

  React.useEffect(() => clearTouchTimer, [clearTouchTimer]);

  return (
    <div
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      {...props}
    >
      <IconHoverContext.Provider value={active}>
        {children}
      </IconHoverContext.Provider>
    </div>
  );
}

/**
 * Creates a drop-in replacement component that wraps a lucide-animated icon.
 * Matches lucide-react API: accepts className with h-X w-X sizing.
 * - Auto-animates once on mount (800ms delay — after FadeIn completes).
 * - Loops animation while inside an active <IconHoverZone>.
 * - Also loops on direct hover (desktop) or tap (mobile).
 */
function makeAnimated(
  AnimatedComp: React.ForwardRefExoticComponent<any>,
  displayName: string,
) {
  const Wrapper = React.forwardRef<SVGSVGElement, { className?: string; strokeWidth?: string | number; [key: string]: any }>(
    ({ className, strokeWidth: _sw, ...props }, outerRef) => {
      const iconRef = React.useRef<AnimatedIconHandle>(null);
      const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
      const touchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
      const parentActive = React.useContext(IconHoverContext);

      // Auto-animate once on mount (800ms so FadeIn has time to reveal)
      React.useEffect(() => {
        const t = setTimeout(() => iconRef.current?.startAnimation(), 800);
        return () => clearTimeout(t);
      }, []);

      const replay = React.useCallback(() => {
        const h = iconRef.current;
        if (!h) return;
        h.stopAnimation();
        requestAnimationFrame(() => h.startAnimation());
      }, []);

      const startLoop = React.useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        replay();
        intervalRef.current = setInterval(replay, HOVER_REPLAY_MS);
      }, [replay]);

      const stopLoop = React.useCallback(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, []);

      // React to parent IconHoverZone active state
      React.useEffect(() => {
        if (parentActive) {
          startLoop();
        } else {
          stopLoop();
        }
        return stopLoop;
      }, [parentActive, startLoop, stopLoop]);

      // Cleanup on unmount
      React.useEffect(() => {
        return () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (touchTimer.current) clearTimeout(touchTimer.current);
        };
      }, []);

      const size = extractSize(className);

      // Direct hover (desktop)
      const onMouseEnter = React.useCallback(() => {
        if (!parentActive) startLoop();
      }, [parentActive, startLoop]);
      const onMouseLeave = React.useCallback(() => {
        if (!parentActive) stopLoop();
      }, [parentActive, stopLoop]);

      // Direct tap (mobile) — loop for a few seconds
      const onTouchStart = React.useCallback(() => {
        if (parentActive) return; // already handled by parent
        if (touchTimer.current) clearTimeout(touchTimer.current);
        startLoop();
        touchTimer.current = setTimeout(stopLoop, TOUCH_LOOP_DURATION);
      }, [parentActive, startLoop, stopLoop]);

      return (
        <div
          ref={outerRef as any}
          className={cn("inline-flex shrink-0", className)}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          {...props}
        >
          <AnimatedComp ref={iconRef} size={size} />
        </div>
      );
    },
  );
  Wrapper.displayName = displayName;
  return Wrapper;
}

// ── Animated replacements (same names as lucide-react) ──
export const ArrowDown = makeAnimated(ArrowDownIcon, "ArrowDown");
export const ArrowLeft = makeAnimated(ArrowLeftIcon, "ArrowLeft");
export const ArrowRight = makeAnimated(ArrowRightIcon, "ArrowRight");
export const ArrowUp = makeAnimated(ArrowUpIcon, "ArrowUp");
export const ShoppingCart = makeAnimated(CartIcon, "ShoppingCart");
export const ChartPie = makeAnimated(ChartPieIcon, "ChartPie");
export const Check = makeAnimated(CheckIcon, "Check");
export const CheckCircle = makeAnimated(CheckIcon, "CheckCircle");
export const ChevronDown = makeAnimated(ChevronDownIcon, "ChevronDown");
export const ChevronLeft = makeAnimated(ChevronLeftIcon, "ChevronLeft");
export const ChevronRight = makeAnimated(ChevronRightIcon, "ChevronRight");
export const ChevronUp = makeAnimated(ChevronUpIcon, "ChevronUp");
export const Clock = makeAnimated(ClockIcon, "Clock");
export const Copy = makeAnimated(CopyIcon, "Copy");
export const Trash2 = makeAnimated(DeleteIcon, "Trash2");
export const DollarSign = makeAnimated(DollarSignIcon, "DollarSign");
export const Download = makeAnimated(DownloadIcon, "Download");
export const Globe = makeAnimated(EarthIcon, "Globe");
export const Home = makeAnimated(HomeIcon, "Home");
export const Lock = makeAnimated(LockIcon, "Lock");
export const MapPin = makeAnimated(MapPinIcon, "MapPin");
export const Moon = makeAnimated(MoonIcon, "Moon");
export const Plus = makeAnimated(PlusIcon, "Plus");
export const Search = makeAnimated(SearchIcon, "Search");
export const Sun = makeAnimated(SunIcon, "Sun");
export const TrendingDown = makeAnimated(TrendingDownIcon, "TrendingDown");
export const Upload = makeAnimated(UploadIcon, "Upload");
export const Users = makeAnimated(UsersIcon, "Users");
export const User = makeAnimated(UserIcon, "User");
export const X = makeAnimated(XIcon, "X");
export const RotateCcw = makeAnimated(UndoIcon, "RotateCcw");
export const FileText = makeAnimated(FileTextIcon, "FileText");
export const Banknote = makeAnimated(HandCoinsIcon, "Banknote");
export const AlertTriangle = makeAnimated(BadgeAlertIcon, "AlertTriangle");
export const Calendar = makeAnimated(CalendarDaysIcon, "Calendar");
export const CalendarDays = makeAnimated(CalendarDaysIcon, "CalendarDays");
export const Shield = makeAnimated(ShieldCheckIcon, "Shield");
export const Pencil = makeAnimated(SquarePenIcon, "Pencil");

// ── Pass-through originals (no animated equivalent) ──
export const AlertCircle = _AlertCircle;
// AlertTriangle is now animated (uses BadgeAlertIcon)
export const ArrowLeftRight = _ArrowLeftRight;
export const Archive = _Archive;
// Banknote is now animated (uses HandCoinsIcon)
// Calendar and CalendarDays are now animated (uses CalendarDaysIcon)
export const Camera = _Camera;
export const Circle = _Circle;
export const ChevronsUpDown = _ChevronsUpDown;
export const Database = _Database;
export const FileCheck2 = _FileCheck2;
export const FileDown = _FileDown;
export const FileIcon = _File;
// FileText is now animated
export const GripVertical = _GripVertical;
export const Hash = _Hash;
export const HelpCircle = _HelpCircle;
export const ImageIcon = _Image;
export const Info = _Info;
export const Landmark = _Landmark;
export const Languages = _Languages;
export const Loader2 = _Loader2;
export const LogOut = _LogOut;
export const Minus = _Minus;
export const Package = _Package;
export const PanelLeftClose = _PanelLeftClose;
export const PanelLeftOpen = _PanelLeftOpen;
export const Phone = _Phone;
export const PlusCircle = _PlusCircle;
export const RefreshCw = _RefreshCw;
// RotateCcw is now animated
export const ShoppingBag = _ShoppingBag;
export const StickyNote = _StickyNote;
export const Undo2 = _Undo2;
export const UserPlus = _UserPlus;
export const WifiOff = _WifiOff;
export const Star = _Star;
export const Tag = _Tag;
export const Weight = _Weight;
export const Layers = _Layers;
export const Box = _Box;
export const Settings2 = _Settings2;
export const SearchX = _SearchX;
export const MapPinOff = _MapPinOff;
export const PackageOpen = _PackageOpen;
export const Inbox = _Inbox;
export const Image = _Image;
export const UtensilsCrossed = _UtensilsCrossed;
export const Fuel = _Fuel;
export const Gift = _Gift;
export const CarFront = _CarFront;
export const MoreHorizontal = _MoreHorizontal;
export const Zap = _Zap;
export const Wifi = _Wifi;
export const Wrench = _Wrench;
export const Wallet = _Wallet;
export const Receipt = _Receipt;
export const CheckSquare = _CheckSquare;
export const Square = _Square;
export const Flag = _Flag;
export const ArrowUpCircle = _ArrowUpCircle;
export const ArrowDownCircle = _ArrowDownCircle;
export const CreditCard = _CreditCard;
export const CheckCircle2 = _CheckCircle2;
export const ArrowDownToLine = makeAnimated(HandGrabIcon, "ArrowDownToLine");
// Pencil is now animated (uses SquarePenIcon)
// Shield is now animated (uses ShieldCheckIcon)
export const List = _List;
export const LayoutGrid = _LayoutGrid;
export const ArrowUpRight = _ArrowUpRight;
export const ArrowDownRight = _ArrowDownRight;
export const XCircle = _XCircle;
export const BookOpen = _BookOpen;
export const LayoutDashboard = _LayoutDashboard;
export type { LucideIcon };
