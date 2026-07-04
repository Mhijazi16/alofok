import { useTranslation } from "react-i18next";
import { StickyNote } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

interface CashNotesStepProps {
  notes: string;
  onNotesChange: (v: string) => void;
}

export function CashNotesStep({ notes, onNotesChange }: CashNotesStepProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <FormField label={t("payment.notes")}>
        <Input
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t("payment.notes")}
          startIcon={<StickyNote className="h-4 w-4" />}
        />
      </FormField>
    </div>
  );
}
