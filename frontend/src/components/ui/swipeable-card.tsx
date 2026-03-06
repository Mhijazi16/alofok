import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";

interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string;
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onTapDisabled?: () => void;
}

const SWIPE_THRESHOLD = 40;

export function SwipeableCard({
  children,
  rightActions = [],
  className = "",
  disabled = false,
  open: controlledOpen,
  onToggle,
  onTapDisabled,
}: SwipeableCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [actionsWidth, setActionsWidth] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiped = useRef(false);
  const isOpen = controlledOpen ?? internalOpen;

  useEffect(() => {
    if (actionsRef.current) {
      setActionsWidth(actionsRef.current.scrollWidth);
    }
  }, [rightActions.length]);

  const open = useCallback(() => {
    if (onToggle) {
      if (!isOpen) onToggle();
    } else {
      setInternalOpen(true);
    }
  }, [onToggle, isOpen]);

  const closeCard = useCallback(() => {
    if (onToggle) {
      if (isOpen) onToggle();
    } else {
      setInternalOpen(false);
    }
  }, [onToggle, isOpen]);

  const toggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((p) => !p);
    }
  }, [onToggle]);

  // ── Touch / pointer swipe detection ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    swiped.current = false;
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const dx = e.clientX - touchStartX.current;
      const dy = Math.abs(e.clientY - touchStartY.current);

      // Only count horizontal swipes (not vertical scroll)
      if (dy < Math.abs(dx) && Math.abs(dx) > SWIPE_THRESHOLD) {
        swiped.current = true;
        if (!disabled) {
          if (dx < 0) {
            // Swipe left → open
            open();
          } else {
            // Swipe right → close
            closeCard();
          }
        }
      }
    },
    [disabled, open, closeCard],
  );

  const handleClick = useCallback(() => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (disabled) {
      onTapDisabled?.();
    } else {
      toggle();
    }
  }, [disabled, onTapDisabled, toggle]);

  if (!rightActions.length) {
    return <div className={className}>{children}</div>;
  }

  const CORNER_PAD = 12;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${isOpen ? rightActions[0]?.color ?? "" : ""} ${className}`}>
      {/* Action buttons pinned to the right */}
      <div
        ref={actionsRef}
        dir="ltr"
        className={`absolute inset-y-0 right-0 flex items-stretch transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {rightActions.map((action, i) => (
          <button
            key={i}
            className={`flex flex-col items-center justify-center text-white text-xs font-medium gap-1 px-5 ${action.color}`}
            style={i === rightActions.length - 1 ? { paddingRight: `${20 + CORNER_PAD}px` } : undefined}
            onClick={() => {
              action.onClick();
              closeCard();
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Card content — slides left to reveal actions */}
      <div
        className="relative z-10 transition-transform duration-200 ease-out touch-pan-y"
        style={{
          transform: isOpen ? `translateX(-${actionsWidth}px)` : "translateX(0)",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
}
