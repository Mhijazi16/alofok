import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, type Customer } from "@/services/salesApi";
import { formatCurrency } from "@/lib/format";
import { syncQueue } from "@/lib/syncQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

interface SettlementDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

/**
 * Settlement (تسوية) — the rep and the customer agree on a balance face to
 * face, and that figure becomes the new starting point. The rep types the
 * AGREED TOTAL, not a correction; the backend posts the difference as an
 * Opening_Balance entry so the statement shows a fresh "رصيد افتتاحي" line and
 * the running balance lands exactly on it. Earlier history stays visible.
 * Works offline (queued like payments and discounts).
 */
export function SettlementDialog({
  customer,
  open,
  onOpenChange,
  onApplied,
}: SettlementDialogProps) {
  const { t } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [agreed, setAgreed] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAgreed("");
      setNotes("");
    }
  }, [open]);

  const balance = Number(customer?.balance ?? 0);
  // Allow a leading "-": a negative balance means we owe the customer.
  const trimmed = agreed.trim();
  const parsed = parseFloat(trimmed);
  const hasValue = trimmed !== "" && trimmed !== "-" && !Number.isNaN(parsed);
  const delta = hasValue ? parsed - balance : 0;
  const isValid = hasValue && delta !== 0;

  const invalidate = () => {
    if (!customer) return;
    queryClient.invalidateQueries({ queryKey: ["my-route"] });
    queryClient.invalidateQueries({ queryKey: ["my-customers"] });
    queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
    queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
  };

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.createSettlement>[0]) =>
      salesApi.createSettlement(payload),
    onSuccess: () => {
      invalidate();
      toast({ title: t("settlement.applied"), variant: "success" });
      onOpenChange(false);
      onApplied?.();
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const handleApply = async () => {
    if (!customer || !isValid) return;
    const payload = {
      customer_id: customer.id,
      agreed_balance: parsed,
      notes: notes.trim() || undefined,
    };
    if (isOnline) {
      mutation.mutate(payload);
    } else {
      await syncQueue.push("settlement", payload);
      invalidate();
      toast({ title: t("settlement.queued"), variant: "success" });
      onOpenChange(false);
      onApplied?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("settlement.title")}</DialogTitle>
          <DialogDescription>{t("settlement.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between rounded-xl bg-background-subtle px-4 py-3">
            <span className="text-body-sm text-muted-foreground">
              {t("settlement.currentBalance")}
            </span>
            <span className="text-body font-bold text-foreground" dir="ltr">
              {formatCurrency(balance)}
            </span>
          </div>

          <FormField label={t("settlement.agreedBalance")}>
            <Input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={agreed}
              placeholder="0"
              onFocusCapture={(e) => e.currentTarget.select()}
              onChange={(e) => setAgreed(e.target.value.replace(/[^0-9.-]/g, ""))}
            />
          </FormField>

          {hasValue && delta === 0 && (
            <p className="text-caption text-muted-foreground">
              {t("settlement.noChange")}
            </p>
          )}

          <FormField label={t("settlement.note")}>
            <Input
              type="text"
              value={notes}
              placeholder={t("settlement.notePlaceholder")}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>

          {/* Show the adjustment that will be posted, so nothing is a surprise. */}
          {isValid && (
            <div className="space-y-2 rounded-xl bg-primary/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-muted-foreground">
                  {t("settlement.adjustment")}
                </span>
                <span
                  className={`text-body-sm font-bold ${delta > 0 ? "text-warning" : "text-success"}`}
                  dir="ltr"
                >
                  {delta > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(delta))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-foreground">
                  {t("settlement.newBalance")}
                </span>
                <span className="text-body font-bold text-primary" dir="ltr">
                  {formatCurrency(parsed)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleApply} disabled={!isValid} isLoading={mutation.isPending}>
            {t("settlement.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
