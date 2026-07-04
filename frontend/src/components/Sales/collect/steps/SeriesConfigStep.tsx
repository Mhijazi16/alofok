import { useTranslation } from "react-i18next";
import { Hash } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

interface SeriesConfigStepProps {
  seriesStart: string;
  seriesNumberDelta: string;
  seriesCount: string;
  seriesDateDelta: string;
  seriesDate: string;
  seriesAmountAll: string;
  rowCount: number;
  onSeriesStartChange: (v: string) => void;
  onSeriesNumberDeltaChange: (v: string) => void;
  onSeriesCountChange: (v: string) => void;
  onSeriesDateDeltaChange: (v: string) => void;
  onSeriesDateChange: (v: string) => void;
  onSeriesAmountAllChange: (v: string) => void;
  onGenerate: () => void;
}

export function SeriesConfigStep({
  seriesStart,
  seriesNumberDelta,
  seriesCount,
  seriesDateDelta,
  seriesDate,
  seriesAmountAll,
  rowCount,
  onSeriesStartChange,
  onSeriesNumberDeltaChange,
  onSeriesCountChange,
  onSeriesDateDeltaChange,
  onSeriesDateChange,
  onSeriesAmountAllChange,
  onGenerate,
}: SeriesConfigStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <FormField label={t("payment.series.startNumber")}>
          <Input
            value={seriesStart}
            onChange={(e) => onSeriesStartChange(e.target.value)}
            dir="ltr"
            placeholder="XXXX05"
            startIcon={<Hash className="h-4 w-4" />}
          />
        </FormField>
        <FormField label={t("payment.series.numberDelta")}>
          <Input
            type="number"
            inputMode="numeric"
            dir="ltr"
            value={seriesNumberDelta}
            onChange={(e) => onSeriesNumberDeltaChange(e.target.value)}
            min={1}
            placeholder="1"
          />
        </FormField>
        <FormField label={t("payment.series.count")}>
          <Input
            type="number"
            inputMode="numeric"
            dir="ltr"
            value={seriesCount}
            onChange={(e) => onSeriesCountChange(e.target.value)}
            min={1}
            max={60}
            placeholder="12"
          />
        </FormField>
        <FormField label={t("payment.series.dateDelta")}>
          <Input
            type="number"
            inputMode="numeric"
            dir="ltr"
            value={seriesDateDelta}
            onChange={(e) => onSeriesDateDeltaChange(e.target.value)}
            min={0}
            placeholder="1"
          />
        </FormField>
        <FormField label={t("payment.series.startDate")}>
          <Input
            type="date"
            value={seriesDate}
            onChange={(e) => onSeriesDateChange(e.target.value)}
          />
        </FormField>
        <FormField label={t("payment.series.amountAll")}>
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
        </FormField>
      </div>

      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onGenerate}>
        {t("payment.series.generate")}
      </Button>

      {rowCount > 0 && (
        <p className="text-caption text-muted-foreground text-center">
          {t("payment.batch.chequeCount")}: {rowCount}
        </p>
      )}
    </div>
  );
}
