import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ChequeRow, Currency, CurrencyOption } from "../types";

interface ChequeReviewStepProps {
  rows: ChequeRow[];
  bankName: string;
  accountNumber: string;
  currency: Currency;
  exchangeRate: string;
  currencies: CurrencyOption[];
}

export function ChequeReviewStep({
  rows,
  bankName,
  accountNumber,
  currency,
  exchangeRate,
  currencies,
}: ChequeReviewStepProps) {
  const { t } = useTranslation();
  const parsedRate = parseFloat(exchangeRate) || 0;
  const currencySymbol = currencies.find((c) => c.value === currency)?.symbol ?? "₪";

  function rowIlsEquivalent(row: ChequeRow): number {
    const amt = parseFloat(row.amount) || 0;
    return currency !== "ILS" && parsedRate > 0 ? amt * parsedRate : amt;
  }
  const totalIls = rows.reduce((sum, r) => sum + rowIlsEquivalent(r), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background-subtle px-3 py-2.5 space-y-1">
        {bankName.trim() && (
          <div className="flex justify-between text-body-sm">
            <span className="text-muted-foreground">{t("payment.bank")}</span>
            <span className="font-medium">{bankName}</span>
          </div>
        )}
        <div className="flex justify-between text-body-sm">
          <span className="text-muted-foreground">{t("payment.accountNumber")}</span>
          <span className="font-medium" dir="ltr">
            {accountNumber}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <Card key={row.id} variant="glass" className="p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-body-sm font-semibold" dir="ltr">
                  #{row.checkNumber}
                </p>
                {row.dueDate && (
                  <p className="text-caption text-muted-foreground" dir="ltr">
                    {row.dueDate}
                  </p>
                )}
                <p className="text-caption text-muted-foreground">
                  {t("payment.batch.chequeNumber", { n: idx + 1 })}
                </p>
              </div>
              <p className="text-body-sm font-bold text-foreground" dir="ltr">
                {currencySymbol} {formatCurrency(parseFloat(row.amount) || 0)}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between text-body-sm">
        <span className="text-muted-foreground">{t("payment.batch.chequeCount")}</span>
        <span className="font-medium">{rows.length}</span>
      </div>

      <Separator />

      <div className="flex items-center justify-between border-t pt-3">
        <p className="font-semibold">{t("payment.batch.total")}</p>
        <p className="font-semibold text-primary" dir="ltr">
          ₪ {formatCurrency(totalIls)}
        </p>
      </div>
    </div>
  );
}
