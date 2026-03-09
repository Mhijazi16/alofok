import { StatementViewBase } from "@/components/shared/StatementViewBase";
import { salesApi, type Customer } from "@/services/salesApi";

interface StatementViewProps {
  customer: Customer;
  onBack: () => void;
}

export function StatementView({ customer, onBack }: StatementViewProps) {
  return (
    <StatementViewBase
      customerName={customer.name}
      balance={customer.balance}
      fetchStatement={(params) => salesApi.getStatement(customer.id, params)}
      queryKeyPrefix={["statement", customer.id]}
      subtitle={customer.name}
      onBack={onBack}
    />
  );
}
