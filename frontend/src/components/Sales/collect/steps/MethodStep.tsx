import { useTranslation } from "react-i18next";
import { Banknote, Receipt } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CollectMethod } from "../types";

interface MethodStepProps {
  method: CollectMethod | null;
  onChange: (method: CollectMethod) => void;
}

export function MethodStep({ method, onChange }: MethodStepProps) {
  const { t } = useTranslation();

  const options: { value: CollectMethod; label: string; icon: typeof Banknote }[] = [
    { value: "cash", label: t("payment.collect.methodCash"), icon: Banknote },
    { value: "cheque", label: t("payment.collect.methodCheque"), icon: Receipt },
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
              method === opt.value && "border-primary bg-primary/5 ring-1 ring-primary"
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
