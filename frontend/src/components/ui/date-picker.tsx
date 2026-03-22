import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "@/lib/icons";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Calendar (internal)                                                */
/* ------------------------------------------------------------------ */

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-body-sm font-medium text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50"
        ),
        nav_button_previous: "absolute start-1",
        nav_button_next: "absolute end-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-caption",
        row: "flex w-full mt-2",
        cell: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-range-end)]:rounded-e-md",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected])]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-s-md",
          "last:[&:has([aria-selected])]:rounded-e-md"
        ),
        day: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground font-semibold ring-1 ring-border",
        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

/* ------------------------------------------------------------------ */
/*  DatePicker                                                         */
/* ------------------------------------------------------------------ */

interface DatePreset {
  label: string;
  value: Date | DateRange;
}

interface DatePickerBaseProps {
  className?: string;
  placeholder?: string;
  presets?: DatePreset[];
  disabled?: boolean;
}

interface SingleDatePickerProps extends DatePickerBaseProps {
  mode?: "single";
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

interface RangeDatePickerProps extends DatePickerBaseProps {
  mode: "range";
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps;

function formatDateDisplay(mode: "single" | "range", value?: Date | DateRange): string {
  if (!value) return "";

  if (mode === "single" && value instanceof Date) {
    return format(value, "PPP");
  }

  if (mode === "range" && value && typeof value === "object" && "from" in value) {
    const range = value as DateRange;
    if (range.from) {
      if (range.to) {
        return `${format(range.from, "PP")} - ${format(range.to, "PP")}`;
      }
      return format(range.from, "PP");
    }
  }

  return "";
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (props, ref) => {
    const {
      className,
      placeholder = "Pick a date",
      presets,
      disabled = false,
    } = props;

    const mode = props.mode ?? "single";
    const [open, setOpen] = React.useState(false);

    const displayText = formatDateDisplay(
      mode,
      props.value as Date | DateRange | undefined
    );

    const handlePresetClick = (preset: DatePreset) => {
      if (mode === "single" && preset.value instanceof Date) {
        (props as SingleDatePickerProps).onChange?.(preset.value);
      } else if (mode === "range" && !(preset.value instanceof Date)) {
        (props as RangeDatePickerProps).onChange?.(preset.value as DateRange);
      }
      setOpen(false);
    };

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !displayText && "text-muted-foreground",
              displayText && "text-foreground",
              className
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-start">
              {displayText || placeholder}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={cn(
              "z-50 rounded-xl border border-border shadow-lg",
              "glass-strong",
              "data-[state=open]:animate-scale-in"
            )}
            align="start"
            sideOffset={4}
          >
            <div className="flex">
              {/* Presets sidebar */}
              {presets && presets.length > 0 && (
                <div className="flex flex-col gap-1 border-e border-border p-3">
                  {presets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="justify-start text-start text-caption"
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Calendar */}
              <div>
                {mode === "single" ? (
                  <Calendar
                    mode="single"
                    selected={(props as SingleDatePickerProps).value}
                    onSelect={(date) => {
                      (props as SingleDatePickerProps).onChange?.(date);
                      setOpen(false);
                    }}
                    initialFocus
                  />
                ) : (
                  <Calendar
                    mode="range"
                    selected={(props as RangeDatePickerProps).value}
                    onSelect={(range) => {
                      (props as RangeDatePickerProps).onChange?.(range);
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                )}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
DatePicker.displayName = "DatePicker";

export { DatePicker, Calendar };
export type { DatePickerProps, SingleDatePickerProps, RangeDatePickerProps, DatePreset };
