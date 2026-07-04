import { useTranslation } from "react-i18next";
import { Layers, Receipt } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChequeType } from "../types";

interface ChequeTypeStepProps {
  chequeType: ChequeType | null;
  onChange: (type: ChequeType) => void;
}

export function ChequeTypeStep({ chequeType, onChange }: ChequeTypeStepProps) {
  const { t } = useTranslation();

  const options: { value: ChequeType; label: string; icon: typeof Layers }[] = [
    { value: "series", label: t("payment.collect.typeSeries"), icon: Layers },
    { value: "normal", label: t("payment.collect.typeNormal"), icon: Receipt },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <Card
            key={opt.value}
            variant="interactive"
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-5 transition-all",
              chequeType === opt.value && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
            onClick={() => onChange(opt.value)}
          >
            <Icon className="h-8 w-8 text-primary" />
            <span className="text-body font-bold text-foreground">{opt.label}</span>
          </Card>
        );
      })}
    </div>
  );
}
