import { useTranslation } from "react-i18next";
import { CalendarDays, Hash, Plus, Trash2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { CheckCapture } from "../../CheckCapture";
import { cn } from "@/lib/utils";
import type { ChequeRow } from "../types";

interface NormalChequesStepProps {
  rows: ChequeRow[];
  onUpdateRow: (id: string, patch: Partial<ChequeRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowCapture: (id: string, blob: Blob, previewUrl: string) => void;
  onRowRemovePhoto: (id: string) => void;
}

export function NormalChequesStep({
  rows,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onRowCapture,
  onRowRemovePhoto,
}: NormalChequesStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const rowOk = row.checkNumber.trim().length > 0 && (parseFloat(row.amount) || 0) > 0;
          return (
            <Card key={row.id} variant="glass" className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-body-sm font-bold",
                    rowOk ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {t("payment.batch.chequeNumber", { n: idx + 1 })}
                </span>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveRow(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

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

              <CheckCapture
                imageBlob={row.imageBlob}
                imagePreviewUrl={row.imagePreviewUrl}
                onCapture={(blob, url) => onRowCapture(row.id, blob, url)}
                onRemove={() => onRowRemovePhoto(row.id)}
              />
            </Card>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onAddRow}>
        <Plus className="h-4 w-4 me-1.5" />
        {t("payment.batch.addCheque")}
      </Button>
    </div>
  );
}
