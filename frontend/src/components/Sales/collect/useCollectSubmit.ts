import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { salesApi, type Customer, type PaymentCreate, type CheckData } from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { checkImageQueue } from "@/lib/checkImageQueue";
import { newClientId } from "@/lib/offlineDB";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { saveBankToHistory } from "@/components/ui/bank-autocomplete";
import type { ChequeBankDetails, CollectMethod, Currency, ChequeRow } from "./types";

interface UseCollectSubmitArgs {
  customer: Customer;
  method: CollectMethod | null;
  currency: Currency;
  parsedRate: number;
  // cash
  parsedAmount: number;
  notes: string;
  // cheque shared
  bankName: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  holderName: string;
  rows: ChequeRow[];
  userId: string;
  // orchestrator state
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  setDone: (v: boolean) => void;
  setRows: (updater: (prev: ChequeRow[]) => ChequeRow[]) => void;
}

export function useCollectSubmit(args: UseCollectSubmitArgs) {
  const { t } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Stable idempotency key for the single cash payment. Created once at hook
  // init and reused across retries so an ambiguous failure can't duplicate.
  const cashKeyRef = useRef(newClientId());

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-route"] });
    queryClient.invalidateQueries({ queryKey: ["my-customers"] });
    queryClient.invalidateQueries({ queryKey: ["insights", args.customer.id] });
    queryClient.invalidateQueries({ queryKey: ["statement", args.customer.id] });
    queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
  }

  async function submitCash() {
    const payload: PaymentCreate = {
      customer_id: args.customer.id,
      type: "Payment_Cash",
      currency: args.currency,
      amount: args.parsedAmount,
      ...(args.currency !== "ILS" && { exchange_rate: args.parsedRate }),
      notes: args.notes.trim() || undefined,
    };

    try {
      if (isOnline) {
        await salesApi.createPayment(payload, cashKeyRef.current);
        invalidate();
      } else {
        await syncQueue.push("payment", payload, cashKeyRef.current);
      }
    } catch (err) {
      console.error("[CollectWizard] Cash submission failed", err);
      args.setSubmitting(false);
      toast({ title: t("toast.error"), variant: "error" });
      return;
    }

    args.setSubmitting(false);
    args.setDone(true);
    toast({
      title: isOnline ? t("payment.paymentSuccess") : t("payment.paymentQueued"),
      variant: "success",
    });
  }

  async function submitCheques() {
    if (args.bankName.trim()) saveBankToHistory(args.bankName.trim(), args.userId);

    const sharedDetails: ChequeBankDetails = {
      bank: args.bankName,
      bankNumber: args.bankNumber,
      branchNumber: args.branchNumber,
      accountNumber: args.accountNumber,
      holderName: args.holderName,
    };

    const total = args.rows.length;
    let succeeded = 0;
    try {
      for (const row of args.rows) {
        // A cheque may be drawn on a different bank/account than the rest of
        // the batch — its own details win when it has an override.
        const details = row.override ?? sharedDetails;
        if (row.override?.bank.trim()) {
          saveBankToHistory(row.override.bank.trim(), args.userId);
        }
        const checkData: CheckData = {
          bank: details.bank.trim() || undefined,
          bank_number: details.bankNumber.trim(),
          branch_number: details.branchNumber.trim(),
          account_number: details.accountNumber.trim(),
          holder_name: details.holderName.trim() || undefined,
          check_number: row.checkNumber.trim(),
          due_date: row.dueDate || undefined,
        };
        const amount = parseFloat(row.amount) || 0;

        if (isOnline) {
          let resolvedImageUrl: string | undefined;
          if (row.imageBlob) {
            try {
              const { url } = await salesApi.uploadCheckImage(row.imageBlob);
              resolvedImageUrl = url;
            } catch {
              console.warn("[CollectWizard] Image upload failed, submitting without image_url");
            }
          }
          const payload: PaymentCreate = {
            customer_id: args.customer.id,
            type: "Payment_Check",
            currency: args.currency,
            amount,
            ...(args.currency !== "ILS" && { exchange_rate: args.parsedRate }),
            data: { ...checkData, image_url: resolvedImageUrl },
          };
          // Stable per-row key so a retry after a partial failure is deduped
          // by the backend instead of creating a duplicate cheque.
          await salesApi.createPayment(payload, row.id);
          succeeded++;
        } else {
          let pendingImageId: number | undefined;
          if (row.imageBlob) {
            try {
              pendingImageId = await checkImageQueue.pushImage(row.imageBlob);
            } catch {
              console.warn("[CollectWizard] Failed to store image in IndexedDB, queuing without image");
            }
          }
          const payload: PaymentCreate & { pending_image_id?: number } = {
            customer_id: args.customer.id,
            type: "Payment_Check",
            currency: args.currency,
            amount,
            ...(args.currency !== "ILS" && { exchange_rate: args.parsedRate }),
            data: checkData,
            ...(pendingImageId !== undefined && { pending_image_id: pendingImageId }),
          };
          await syncQueue.push("payment", payload, row.id);
          succeeded++;
        }
      }
    } catch (err) {
      console.error("[CollectWizard] Cheque submission failed", err);
      // Partial failure: drop the cheques that already went through so a retry
      // only submits the remainder (each still-pending row reuses its stable
      // key, so even an ambiguous network failure won't duplicate).
      args.setRows((prev) => prev.slice(succeeded));
      invalidate();
      args.setSubmitting(false);
      toast({
        title: t("payment.batch.partialSuccess", { done: succeeded, total }),
        variant: "error",
      });
      return;
    }

    invalidate();
    args.setSubmitting(false);
    args.setDone(true);
    toast({
      title: isOnline
        ? t("payment.batch.recorded", { count: succeeded })
        : t("payment.batch.queued", { count: succeeded }),
      variant: "success",
    });
  }

  async function handleSubmit() {
    if (args.submitting) return;
    args.setSubmitting(true);

    if (args.method === "cash") {
      await submitCash();
    } else {
      await submitCheques();
    }
  }

  return { handleSubmit };
}
