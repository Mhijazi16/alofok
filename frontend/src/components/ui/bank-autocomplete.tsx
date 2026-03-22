import { useState } from "react";
import { Check, ChevronsUpDown } from "@/lib/icons";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// localStorage helpers — exported for use in logout cleanup and PaymentFlow
// ---------------------------------------------------------------------------

const BANK_STORAGE_KEY = (userId: string) => `alofok_banks_${userId}`;
const MAX_HISTORY = 20;

export function getBankHistory(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(BANK_STORAGE_KEY(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveBankToHistory(bank: string, userId: string): void {
  const current = getBankHistory(userId);
  const deduped = [bank, ...current.filter((b) => b !== bank)].slice(
    0,
    MAX_HISTORY
  );
  try {
    localStorage.setItem(BANK_STORAGE_KEY(userId), JSON.stringify(deduped));
  } catch {
    /* localStorage full or private mode */
  }
}

export function clearBankHistory(userId: string): void {
  localStorage.removeItem(BANK_STORAGE_KEY(userId));
}

// ---------------------------------------------------------------------------
// BankAutocomplete component
// ---------------------------------------------------------------------------

interface BankAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  userId: string;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function BankAutocomplete({
  value,
  onChange,
  userId,
  placeholder,
  onFocus,
  onBlur,
}: BankAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const history = getBankHistory(userId);

  const handleSelect = (bank: string) => {
    onChange(bank);
    setInputValue("");
    setOpen(false);
  };

  const handleFreeText = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim());
      setInputValue("");
      setOpen(false);
    }
  };

  const filteredHistory = inputValue
    ? history.filter((b) =>
        b.toLowerCase().includes(inputValue.toLowerCase())
      )
    : history;

  const showFreeText =
    inputValue.trim().length > 0 &&
    !history.some((b) => b.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          onFocus={onFocus}
          onBlur={onBlur}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-border",
            "bg-input px-3 py-2 text-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            "z-[100] w-[var(--radix-popover-trigger-width)] rounded-lg border border-border",
            "bg-card shadow-lg"
          )}
          sideOffset={4}
          align="start"
        >
          <Command className="w-full" shouldFilter={false}>
            <div className="border-b border-border">
              <CommandInput
                value={inputValue}
                onValueChange={setInputValue}
                placeholder={placeholder}
                className={cn(
                  "flex h-10 w-full rounded-t-lg bg-transparent px-3 py-2 text-sm",
                  "text-foreground placeholder:text-muted-foreground",
                  "outline-none"
                )}
              />
            </div>

            <CommandList className="max-h-48 overflow-y-auto py-1">
              {filteredHistory.length === 0 && !showFreeText && (
                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                  لا توجد بنوك محفوظة
                </CommandEmpty>
              )}

              {filteredHistory.map((bank) => (
                <CommandItem
                  key={bank}
                  value={bank}
                  onSelect={() => handleSelect(bank)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                    "text-foreground transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === bank ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{bank}</span>
                </CommandItem>
              ))}

              {showFreeText && (
                <CommandItem
                  key={`__free__${inputValue}`}
                  value={`__free__${inputValue}`}
                  onSelect={handleFreeText}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                    "text-primary transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  )}
                >
                  <Check className="h-4 w-4 shrink-0 opacity-0" />
                  <span>
                    استخدام &ldquo;{inputValue.trim()}&rdquo;
                  </span>
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
