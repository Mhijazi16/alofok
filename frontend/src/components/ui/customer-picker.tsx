import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Customer } from "@/services/salesApi";

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer) => void;
  customers: Customer[];
  disabled?: boolean;
}

export function CustomerPicker({
  value,
  onChange,
  customers,
  disabled = false,
}: CustomerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, search]);

  return (
    <>
      <Card
        variant="interactive"
        className="p-3 cursor-pointer"
        onClick={() => !disabled && setOpen(true)}
      >
        <div className="flex items-center gap-3">
          {value ? (
            <>
              <Avatar src={value.avatar_url ?? undefined} name={value.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-foreground">
                  {value.name}
                </p>
                <p className="text-caption text-muted-foreground">{value.city}</p>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              {t("customer.selectCustomer")}
            </p>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("customer.selectCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("customer.searchCustomers")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((customer) => (
                <Card
                  key={customer.id}
                  variant="interactive"
                  className="p-3 cursor-pointer"
                  onClick={() => {
                    onChange(customer);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={customer.avatar_url ?? undefined} name={customer.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-foreground">
                        {customer.name}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {customer.city}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-caption text-muted-foreground py-4">
                  {t("customer.noResults")}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
