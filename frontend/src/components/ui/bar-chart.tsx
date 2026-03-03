import * as React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface BarConfig {
  dataKey: string;
  color?: string;
  label?: string;
}

interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, unknown>[];
  bars: BarConfig[];
  xAxisKey: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

const DEFAULT_COLORS = [
  "hsl(0 72% 51%)",     // primary red
  "hsl(0 0% 95%)",      // white / foreground
  "hsl(0 0% 55%)",      // muted
  "hsl(142 71% 45%)",   // success green
  "hsl(38 92% 50%)",    // warning amber
  "hsl(217 91% 60%)",   // info blue
];

// Custom tooltip styled for the dark design system
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  labelMap?: Record<string, string>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  labelMap,
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg glass">
      <p className="mb-1.5 text-body-sm font-medium text-foreground">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center gap-2 text-body-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {labelMap?.[entry.dataKey] ?? entry.name}:
            </span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  (
    {
      data,
      bars,
      xAxisKey,
      height = 300,
      showLegend = false,
      showGrid = true,
      className,
      ...props
    },
    ref
  ) => {
    // Build a label map for the tooltip
    const labelMap = React.useMemo(() => {
      const map: Record<string, string> = {};
      bars.forEach((bar) => {
        if (bar.label) map[bar.dataKey] = bar.label;
      });
      return map;
    }, [bars]);

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(0 0% 20%)"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(0 0% 20%)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip labelMap={labelMap} />}
              cursor={{ fill: "hsl(0 0% 100% / 0.04)" }}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: "hsl(0 0% 55%)" }}
              />
            )}
            {bars.map((bar, idx) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.label ?? bar.dataKey}
                fill={bar.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
BarChart.displayName = "BarChart";

export { BarChart };
export type { BarChartProps, BarConfig };
