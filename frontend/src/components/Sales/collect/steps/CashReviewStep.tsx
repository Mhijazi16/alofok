import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/format";
import { Separator } from "@/components/ui/separator";
import type { Currency, CurrencyOption } from "../types";

interface CashReviewStepProps {
  amount: string;
  currency: Currency;
  exchangeRate: string;
  notes: string;
  currencies: CurrencyOption[];
  customerBalance: number;
}

export function CashReviewStep({
  amount,
  currency,
  exchangeRate,
  notes,
  currencies,
  customerBalance,
}: CashReviewStepProps) {
  const { t } = useTranslation();
  const parsedAmount = parseFloat(amount) || 0;
  const parsedRate = parseFloat(exchangeRate) || 0;
  const ilsEquivalent = currency !== "ILS" && parsedRate > 0 ? parsedAmount * parsedRate : parsedAmount;
  const currencyOpt = currencies.find((c) => c.value === currency);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background-subtle px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted-foreground">{t("payment.paymentType")}</span>
          <span className="font-medium">{t("payment.collect.methodCash")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted-foreground">{t("payment.amount")}</span>
          <span className="text-h4 font-bold text-foreground" dir="ltr">
            {currencyOpt?.symbol} {formatCurrency(parsedAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted-foreground">{t("payment.currency")}</span>
          <span className="font-medium">{currencyOpt?.label}</span>
        </div>
        {currency !== "ILS" && parsedRate > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-muted-foreground">{t("payment.exchangeRate")}</span>
              <span className="font-medium" dir="ltr">
                1 {currencyOpt?.symbol} = {parsedRate} ₪
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-muted-foreground">{t("payment.ilsEquivalent")}</span>
              <span className="font-bold text-primary" dir="ltr">
                ₪ {formatCurrency(ilsEquivalent)}
              </span>
            </div>
          </>
        )}
        {notes.trim() && (
          <div className="flex items-center justify-between">
            <span className="text-body-sm text-muted-foreground">{t("payment.notes")}</span>
            <span className="text-body-sm text-foreground max-w-[60%] truncate">{notes}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-body-sm text-muted-foreground">
          {t("customer.balance")} ({t("actions.pay")})
        </span>
        <span className="text-body-sm text-success font-medium" dir="ltr">
          {formatCurrency(customerBalance)} → {formatCurrency(customerBalance - ilsEquivalent)}
        </span>
      </div>
    </div>
  );
}
