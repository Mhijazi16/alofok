import { useQuery } from "@tanstack/react-query";
import { StatementViewBase } from "@/components/shared/StatementViewBase";
import { customerApi } from "@/services/customerApi";

export function CustomerStatementView() {
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: customerApi.getProfile,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <StatementViewBase
      customerName={profile?.name ?? ""}
      balance={profile?.balance ?? 0}
      fetchStatement={(params) => customerApi.getStatement(params)}
      queryKeyPrefix={["customer-statement"]}
      showDraftBadge
    />
  );
}
