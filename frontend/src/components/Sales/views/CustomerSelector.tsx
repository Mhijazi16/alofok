import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { User, ChevronDown, Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { type Customer } from "@/services/salesApi";

interface CustomerSelectorProps {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (c: Customer) => void;
}

export function CustomerSelector({
  customers,
  selected,
  onSelect,
}: CustomerSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 h-auto justify-start ${
          selected
            ? "border-primary/50 bg-primary/5"
            : "border-border/50 bg-card/50"
        }`}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} size="sm" />
            <div className="flex-1 min-w-0 text-start">
              <p className="text-body-sm font-semibold text-foreground truncate">
                {selected.name}
              </p>
              <p className="text-caption text-muted-foreground">{selected.city}</p>
            </div>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-start text-body-sm text-muted-foreground">
              {t("cart.selectCustomer")}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <Card
          variant="glass"
          className="absolute inset-x-0 top-full mt-1 z-50 max-h-64 overflow-hidden flex flex-col shadow-xl border border-border"
        >
          <div className="p-2 border-b border-border/50">
            <SearchInput
              placeholder={t("customer.searchCustomers")}
              onSearch={setSearch}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-caption text-muted-foreground py-4">
                {t("customer.noCustomers")}
              </p>
            ) : (
              filtered.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 h-auto justify-start rounded-none ${
                    selected?.id === c.id ? "bg-primary/10" : ""
                  }`}
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-body-sm font-medium text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-caption text-muted-foreground">{c.city}</p>
                  </div>
                  {selected?.id === c.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </Button>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
