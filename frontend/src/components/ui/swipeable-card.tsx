import { useRef, useCallback, type ReactNode } from "react";
import { useDrag } from "@use-gesture/react";

interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string;
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
}

const ACTION_WIDTH = 72;

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  className = "",
  disabled = false,
}: SwipeableCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const maxLeft = rightActions.length * ACTION_WIDTH;
  const maxRight = leftActions.length * ACTION_WIDTH;

  const resetSwipe = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = "transform 200ms ease-out";
    el.style.transform = "translateX(0)";
    offsetRef.current = 0;
  }, []);

  const bind = useDrag(
    ({ movement: [mx], last, cancel }) => {
      if (disabled) {
        cancel?.();
        return;
      }

      const el = contentRef.current;
      if (!el) return;

      if (last) {
        const threshold = ACTION_WIDTH * 0.5;
        let target = 0;
        if (mx < -threshold && rightActions.length) target = -maxLeft;
        if (mx > threshold && leftActions.length) target = maxRight;
        el.style.transition = "transform 200ms ease-out";
        el.style.transform = `translateX(${target}px)`;
        offsetRef.current = target;
        return;
      }

      const clamped = Math.max(
        -maxLeft,
        Math.min(maxRight, mx + offsetRef.current)
      );
      el.style.transition = "none";
      el.style.transform = `translateX(${clamped}px)`;
    },
    { axis: "x", filterTaps: true, from: () => [offsetRef.current, 0] }
  );

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      {rightActions.length > 0 && (
        <div
          className="absolute inset-y-0 end-0 flex items-stretch"
          dir="ltr"
        >
          {rightActions.map((action, i) => (
            <button
              key={i}
              className={`flex flex-col items-center justify-center text-white text-xs font-medium gap-1 ${action.color}`}
              style={{ width: ACTION_WIDTH }}
              onClick={() => {
                action.onClick();
                resetSwipe();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {leftActions.length > 0 && (
        <div
          className="absolute inset-y-0 start-0 flex items-stretch"
          dir="ltr"
        >
          {leftActions.map((action, i) => (
            <button
              key={i}
              className={`flex flex-col items-center justify-center text-white text-xs font-medium gap-1 ${action.color}`}
              style={{ width: ACTION_WIDTH }}
              onClick={() => {
                action.onClick();
                resetSwipe();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div ref={contentRef} {...bind()} className="relative z-10 touch-pan-y">
        {children}
      </div>
    </div>
  );
}
