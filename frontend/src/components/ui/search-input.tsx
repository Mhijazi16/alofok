import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onSearch?: (value: string) => void;
  onChange?: (value: string) => void;
  isLoading?: boolean;
  debounceMs?: number;
  className?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value: controlledValue,
      onSearch,
      onChange,
      isLoading = false,
      debounceMs = 300,
      placeholder = "Search...",
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(
      controlledValue ?? ""
    );
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : internalValue;
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    React.useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch?.(newValue);
      }, debounceMs);
    };

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue("");
      }
      onChange?.("");
      onSearch?.("");

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };

    return (
      <div className={cn("relative", className)}>
        <Input
          ref={ref}
          type="text"
          value={currentValue}
          onChange={handleChange}
          placeholder={placeholder}
          startIcon={
            isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )
          }
          endIcon={
            currentValue ? (
              <button
                type="button"
                onClick={handleClear}
                className="pointer-events-auto cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : undefined
          }
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
export type { SearchInputProps };
