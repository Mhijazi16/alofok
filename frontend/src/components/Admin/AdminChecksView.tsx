import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, FileCheck2, RotateCcw, ChevronLeft, ChevronRight } from "@/lib/icons";
import { adminApi, type CheckOut, type PaginatedResponse } from "@/services/adminApi";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckDetailDialog } from "@/components/ui/check-detail-dialog";
import { CheckPhotoThumbnail } from "@/components/ui/check-photo-thumbnail";
import { useToast } from "@/hooks/useToast";
import { FadeIn } from "@/components/ui/fade-in";

type StatusFilter = "Pending" | "Deposited" | "Returned" | "all";

const checkStatusVariant = (status: string | null) => {
  if (status === "Pending") return "warning" as const;
  if (status === "Deposited") return "success" as const;
  if (status === "Returned") return "destructive" as const;
  return "outline" as const;
};

export function AdminChecksView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Pending");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [selectedCheck, setSelectedCheck] = useState<CheckOut | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: checksResponse, isLoading } = useQuery({
    queryKey: ["admin-checks", statusFilter, page, pageSize],
    queryFn: () =>
      adminApi.getChecks(statusFilter === "all" ? undefined : statusFilter, page, pageSize),
  });

  const checks = checksResponse?.items ?? [];
  const totalPages = checksResponse?.total_pages ?? 1;

  // Reset page when filter changes
  const handleFilterChange = (v: string) => {
    setStatusFilter(v as StatusFilter);
    setPage(1);
  };

  const depositMutation = useMutation({
    mutationFn: (checkId: string) => adminApi.depositCheck(checkId),
    onMutate: async (checkId) => {
      await queryClient.cancelQueries({ queryKey: ["admin-checks", statusFilter, page, pageSize] });
      const previous = queryClient.getQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize]);
      queryClient.setQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize], (old) =>
        old ? { ...old, items: old.items.map((c) => (c.id === checkId ? { ...c, status: "Deposited" } : c)) } : old
      );
      toast({ title: t("checks.depositSuccess"), variant: "success" });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-checks", statusFilter, page, pageSize], context.previous);
      }
      toast({ title: t("toast.error"), variant: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-checks"] });
    },
  });

  const undepositMutation = useMutation({
    mutationFn: (checkId: string) => adminApi.undepositCheck(checkId),
    onMutate: async (checkId) => {
      await queryClient.cancelQueries({ queryKey: ["admin-checks", statusFilter, page, pageSize] });
      const previous = queryClient.getQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize]);
      queryClient.setQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize], (old) =>
        old ? { ...old, items: old.items.map((c) => (c.id === checkId ? { ...c, status: "Pending" } : c)) } : old
      );
      toast({ title: t("checks.undepositSuccess"), variant: "success" });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-checks", statusFilter, page, pageSize], context.previous);
      }
      toast({ title: t("toast.error"), variant: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-checks"] });
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ checkId, notes }: { checkId: string; notes?: string }) =>
      adminApi.returnCheck(checkId, notes),
    onMutate: async ({ checkId }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-checks", statusFilter, page, pageSize] });
      const previous = queryClient.getQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize]);
      queryClient.setQueryData<PaginatedResponse<CheckOut>>(["admin-checks", statusFilter, page, pageSize], (old) =>
        old ? { ...old, items: old.items.map((c) => (c.id === checkId ? { ...c, status: "Returned" } : c)) } : old
      );
      toast({ title: t("checks.returnSuccess"), variant: "success" });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-checks", statusFilter, page, pageSize], context.previous);
      }
      toast({ title: t("toast.error"), variant: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-checks"] });
    },
  });

  return (
    <FadeIn animation="fade">
      <TopBar title={t("checks.title")} />

      <div className="space-y-4 p-4">
        {/* Status filter pills */}
        <Tabs
          value={statusFilter}
          onValueChange={handleFilterChange}
        >
          <TabsList variant="pills" className="w-full justify-between">
            <TabsTrigger value="Pending">{t("checks.filterPending")}</TabsTrigger>
            <TabsTrigger value="Deposited">{t("checks.filterDeposited")}</TabsTrigger>
            <TabsTrigger value="Returned">{t("checks.filterReturned")}</TabsTrigger>
            <TabsTrigger value="all">{t("checks.filterAll")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Check list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-28" />
            ))}
          </div>
        ) : checks.length === 0 ? (
          <EmptyState preset="no-data" title={t("checks.noChecks")} />
        ) : (
          <div className="space-y-3">
            {checks.map((check) => (
              <Card
                key={check.id}
                variant="glass"
                className="cursor-pointer"
                onClick={() => {
                  setSelectedCheck(check);
                  setDetailDialogOpen(true);
                }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-body-sm font-semibold text-foreground truncate">
                        {check.customer_name}
                      </p>
                    </div>
                    <Badge variant={checkStatusVariant(check.status)} size="sm">
                      {check.status
                        ? t(`checks.status.${check.status}`, check.status)
                        : "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-caption text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">
                      {Math.abs(check.amount).toFixed(2)} {check.currency}
                    </span>
                    {check.data?.bank && <span>· {check.data.bank}</span>}
                    {check.data?.due_date && <span>· {check.data.due_date}</span>}
                    <CheckPhotoThumbnail imageUrl={check.data?.image_url} />
                  </div>
                  {/* Action buttons — hidden (not disabled) for invalid transitions */}
                  <div className="flex items-center gap-2">
                    {check.status === "Pending" && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCheck(check);
                          setDepositDialogOpen(true);
                        }}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {t("checks.deposit")}
                      </Button>
                    )}
                    {check.status === "Deposited" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          undepositMutation.mutate(check.id);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("checks.undeposit")}
                      </Button>
                    )}
                    {(check.status === "Pending" || check.status === "Deposited") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCheck(check);
                          setReturnNotes("");
                          setReturnDialogOpen(true);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("checks.return")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("actions.previous") || "Previous"}
            </Button>
            <span className="text-caption text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("actions.next") || "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Deposit confirmation dialog */}
      <ConfirmationDialog
        open={depositDialogOpen}
        onOpenChange={setDepositDialogOpen}
        title={t("checks.depositConfirmTitle")}
        description={t("checks.depositConfirmDesc")}
        confirmLabel={t("checks.deposit")}
        cancelLabel={t("actions.cancel")}
        isLoading={depositMutation.isPending}
        onConfirm={() => {
          if (selectedCheck) {
            depositMutation.mutate(selectedCheck.id);
          }
          setDepositDialogOpen(false);
        }}
      />

      {/* Return dialog with optional notes */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("checks.returnConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("checks.returnConfirmDesc", {
                amount: selectedCheck
                  ? Math.abs(selectedCheck.amount).toFixed(2)
                  : "",
                currency: selectedCheck?.currency ?? "",
                customer: selectedCheck?.customer_name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t("checks.returnNotesPlaceholder")}
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedCheck) {
                  returnMutation.mutate({
                    checkId: selectedCheck.id,
                    notes: returnNotes || undefined,
                  });
                }
                setReturnDialogOpen(false);
              }}
              isLoading={returnMutation.isPending}
            >
              {t("checks.confirmReturn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckDetailDialog
        check={selectedCheck}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDeposit={(id) => {
          depositMutation.mutate(id);
          setDetailDialogOpen(false);
        }}
        onUndeposit={(id) => {
          undepositMutation.mutate(id);
          setDetailDialogOpen(false);
        }}
        onReturn={(id) => {
          setDetailDialogOpen(false);
          setSelectedCheck(checks.find((c) => c.id === id) ?? null);
          setReturnNotes("");
          setReturnDialogOpen(true);
        }}
      />
    </FadeIn>
  );
}
