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

interface DiscountDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

/**
 * Apply a standalone discount off a customer's outstanding balance — used for
 * settling fractions or rounding after collecting. Capped at what's owed so it
 * can never create accidental credit. Works offline (queued like payments).
 */
export function DiscountDialog({
  customer,
  open,
  onOpenChange,
  onApplied,
}: DiscountDialogProps) {
  const { t } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Reset fields whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setAmount("");
      setNotes("");
    }
  }, [open]);

  const balance = Number(customer?.balance ?? 0);
  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= balance;
  const after = balance - parsedAmount;

  const invalidate = () => {
    if (!customer) return;
    queryClient.invalidateQueries({ queryKey: ["my-route"] });
    queryClient.invalidateQueries({ queryKey: ["my-customers"] });
    queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
    queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
  };

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.createDiscount>[0]) =>
      salesApi.createDiscount(payload),
    onSuccess: () => {
      invalidate();
      toast({ title: t("discount.applied"), variant: "success" });
      onOpenChange(false);
      onApplied?.();
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const handleApply = async () => {
    if (!customer || !isValid) return;
    const payload = {
      customer_id: customer.id,
      amount: parsedAmount,
      notes: notes.trim() || undefined,
    };
    if (isOnline) {
      mutation.mutate(payload);
    } else {
      await syncQueue.push("discount", payload);
      invalidate();
      toast({ title: t("discount.queued"), variant: "success" });
      onOpenChange(false);
      onApplied?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("discount.title")}</DialogTitle>
          <DialogDescription>{t("discount.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Current balance */}
          <div className="flex items-center justify-between rounded-xl bg-background-subtle px-4 py-3">
            <span className="text-body-sm text-muted-foreground">
              {t("discount.currentBalance")}
            </span>
            <span className="text-body font-bold text-foreground" dir="ltr">
              {formatCurrency(balance)}
            </span>
          </div>

          <FormField label={t("discount.amount")}>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder="0"
              onFocusCapture={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
            />
          </FormField>

          {parsedAmount > balance && (
            <p className="text-caption text-destructive">
              {t("discount.exceeds")}
            </p>
          )}

          <FormField label={t("discount.note")}>
            <Input
              type="text"
              value={notes}
              placeholder={t("discount.notePlaceholder")}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>

          {/* Resulting balance */}
          {isValid && (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
              <span className="text-body-sm font-semibold text-foreground">
                {t("discount.newBalance")}
              </span>
              <span className="text-body font-bold text-primary" dir="ltr">
                {formatCurrency(after)}
              </span>
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
          <Button
            onClick={handleApply}
            disabled={!isValid}
            isLoading={mutation.isPending}
          >
            {t("discount.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
