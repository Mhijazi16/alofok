import * as React from "react";
import { cn } from "@/lib/utils";

interface CircularGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value 0-100 */
  value: number;
  /** Label below the percentage */
  label: string;
  /** Color of the arc — maps to CSS variable */
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  /** Size in px */
  size?: number;
}

const colorMap: Record<string, string> = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  info: "hsl(var(--info))",
};

const CircularGauge = React.forwardRef<HTMLDivElement, CircularGaugeProps>(
  ({ value, label, color = "primary", size = 90, className, ...props }, ref) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
    const arcColor = colorMap[color] ?? colorMap.primary;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex flex-col items-center gap-1.5 rounded-2xl border border-border dark:border-white/[0.08] bg-card p-3 overflow-hidden",
          className
        )}
        {...props}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${arcColor} 0%, transparent 60%)`,
            opacity: 0.1,
          }}
        />
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Value arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arcColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* Center percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-body-sm font-bold tabular-nums text-foreground">
              {Math.round(clampedValue)}%
            </span>
          </div>
        </div>
        <span className="text-caption text-muted-foreground leading-tight">
          {label}
        </span>
      </div>
    );
  }
);
CircularGauge.displayName = "CircularGauge";

export { CircularGauge };
export type { CircularGaugeProps };
