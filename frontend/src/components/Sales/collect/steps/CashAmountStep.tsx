import { useTranslation } from "react-i18next";
import { ArrowLeftRight } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import type { Currency, CurrencyOption } from "../types";

interface CashAmountStepProps {
  amount: string;
  currency: Currency;
  exchangeRate: string;
  currencies: CurrencyOption[];
  onAmountChange: (v: string) => void;
  onCurrencyChange: (c: Currency) => void;
  onExchangeRateChange: (v: string) => void;
}

export function CashAmountStep({
  amount,
  currency,
  exchangeRate,
  currencies,
  onAmountChange,
  onCurrencyChange,
  onExchangeRateChange,
}: CashAmountStepProps) {
  const { t } = useTranslation();
  const parsedAmount = parseFloat(amount) || 0;
  const parsedRate = parseFloat(exchangeRate) || 0;
  const ilsEquivalent = currency !== "ILS" && parsedRate > 0 ? parsedAmount * parsedRate : parsedAmount;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2">
        <label className="text-body-sm text-muted-foreground">{t("payment.amount")}</label>
        <Input
          type="number"
          inputMode="decimal"
          dir="ltr"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          className="h-16 border-primary/50 text-center text-h1 font-bold text-foreground focus-visible:ring-primary max-w-xs"
          inputSize="lg"
          min={0}
          step="0.01"
        />
      </div>

      <div className="space-y-2">
        <label className="text-body-sm font-medium text-foreground">{t("payment.currency")}</label>
        <div className="grid grid-cols-3 gap-2">
          {currencies.map((c) => (
            <Card
              key={c.value}
              variant="interactive"
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-3 transition-all",
                currency === c.value && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
              onClick={() => onCurrencyChange(c.value)}
            >
              <span className="text-h3 font-bold text-foreground">{c.symbol}</span>
              <span className="text-caption text-muted-foreground">{c.label}</span>
            </Card>
          ))}
        </div>
      </div>

      {currency !== "ILS" && (
        <div className="space-y-2">
          <FormField label={t("payment.exchangeRate")} required>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                inputMode="decimal"
                dir="ltr"
                value={exchangeRate}
                onChange={(e) => onExchangeRateChange(e.target.value)}
                placeholder="0.00"
                className="max-w-[140px]"
                min={0}
                step="0.01"
                startIcon={<ArrowLeftRight className="h-4 w-4" />}
              />
              <span className="text-body-sm text-muted-foreground whitespace-nowrap">
                {t("payment.rateToILS", {
                  symbol: currencies.find((c) => c.value === currency)?.symbol,
                })}
              </span>
            </div>
          </FormField>
          {parsedAmount > 0 && parsedRate > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <span className="text-body-sm text-muted-foreground">{t("payment.ilsEquivalent")}</span>
              <span className="text-body font-bold text-primary" dir="ltr">
                ₪ {formatCurrency(ilsEquivalent)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
