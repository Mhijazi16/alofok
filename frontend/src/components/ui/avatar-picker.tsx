import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const DICEBEAR_URL = "https://api.dicebear.com/9.x/lorelei/svg?seed=";

function generateSeeds(base: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${base}-${i}-${Date.now()}`);
}

interface AvatarPickerProps {
  currentSeed: string;
  onSelect: (seed: string) => void;
  className?: string;
}

export function AvatarPicker({ currentSeed, onSelect, className }: AvatarPickerProps) {
  const [seeds, setSeeds] = useState<string[]>(() => generateSeeds(currentSeed, 8));
  const [open, setOpen] = useState(false);

  const regenerate = () => {
    setSeeds(generateSeeds(currentSeed, 8));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "group relative rounded-full transition-transform active:scale-95",
            className
          )}
        >
          <img
            src={`${DICEBEAR_URL}${encodeURIComponent(currentSeed)}`}
            alt="Current avatar"
            className="h-20 w-20 rounded-full border-2 border-primary bg-card"
          />
          <span className="absolute -bottom-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors group-hover:bg-accent">
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          className={cn(
            "z-50 w-64 rounded-xl p-3 shadow-lg",
            "glass-strong animate-scale-in",
            "data-[state=closed]:animate-fade-out"
          )}
        >
          {/* Scrollable grid */}
          <div className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2">
              {seeds.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => {
                    onSelect(seed);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 p-0.5 transition-all active:scale-95",
                    currentSeed === seed
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <img
                    src={`${DICEBEAR_URL}${encodeURIComponent(seed)}`}
                    alt=""
                    className="h-12 w-12 rounded-full bg-card"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Regenerate */}
          <button
            type="button"
            onClick={regenerate}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>More options</span>
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function getDiceBearUrl(seed: string): string {
  return `${DICEBEAR_URL}${encodeURIComponent(seed)}`;
}
