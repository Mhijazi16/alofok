import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Display a red error border */
  error?: boolean;
  /** Automatically resize the textarea based on content */
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, autoResize, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
            node;
        }
      },
      [ref]
    );

    const handleAutoResize = React.useCallback(() => {
      const textarea = internalRef.current;
      if (!textarea || !autoResize) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, [autoResize]);

    React.useEffect(() => {
      handleAutoResize();
    }, [handleAutoResize]);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e);
        handleAutoResize();
      },
      [onChange, handleAutoResize]
    );

    return (
      <textarea
        ref={setRefs}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border bg-card px-3 py-2",
          "text-body text-foreground placeholder:text-muted-foreground",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-destructive focus-visible:ring-destructive"
            : "border-border",
          autoResize && "resize-none overflow-hidden max-h-[300px]",
          className
        )}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
export type { TextareaProps };
