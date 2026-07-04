import { useTranslation } from "react-i18next";
import { CalendarDays, Hash } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import type { ChequeRow } from "../types";

interface SeriesEditStepProps {
  rows: ChequeRow[];
  seriesAmountAll: string;
  onSeriesAmountAllChange: (v: string) => void;
  onApplyAmountToAll: () => void;
  onUpdateRow: (id: string, patch: Partial<ChequeRow>) => void;
}

export function SeriesEditStep({
  rows,
  seriesAmountAll,
  onSeriesAmountAllChange,
  onApplyAmountToAll,
  onUpdateRow,
}: SeriesEditStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card variant="glass" className="space-y-2 p-3">
        <FormField label={t("payment.series.amountAll")}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={seriesAmountAll}
              onChange={(e) => onSeriesAmountAllChange(e.target.value)}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
            <Button type="button" variant="secondary" size="sm" onClick={onApplyAmountToAll}>
              {t("payment.series.applyAmount")}
            </Button>
          </div>
        </FormField>
      </Card>

      <div className="space-y-3">
        {rows.map((row, idx) => {
          const rowOk = row.checkNumber.trim().length > 0 && (parseFloat(row.amount) || 0) > 0;
          return (
            <Card key={row.id} variant="glass" className="space-y-3 p-3">
              <span
                className={cn(
                  "text-body-sm font-bold",
                  rowOk ? "text-success" : "text-muted-foreground"
                )}
              >
                {t("payment.batch.chequeNumber", { n: idx + 1 })}
              </span>

              <FormField label={t("payment.checkNumber")} required>
                <Input
                  value={row.checkNumber}
                  onChange={(e) => onUpdateRow(row.id, { checkNumber: e.target.value })}
                  placeholder={t("payment.checkNumber")}
                  inputMode="numeric"
                  dir="ltr"
                  startIcon={<Hash className="h-4 w-4" />}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label={t("payment.amount")} required>
                  <Input
                    type="number"
                    inputMode="decimal"
                    dir="ltr"
                    value={row.amount}
                    onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                </FormField>
                <FormField label={t("payment.dueDate")}>
                  <Input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => onUpdateRow(row.id, { dueDate: e.target.value })}
                    startIcon={<CalendarDays className="h-4 w-4" />}
                  />
                </FormField>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
