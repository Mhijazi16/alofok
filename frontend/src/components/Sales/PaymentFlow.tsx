import { CollectWizard } from "./collect/CollectWizard";
import type { Customer } from "@/services/salesApi";

interface PaymentFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

export function PaymentFlow({ customer, onBack, onDone }: PaymentFlowProps) {
  return <CollectWizard customer={customer} onBack={onBack} onDone={onDone} />;
}
