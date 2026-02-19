import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { salesApi, type Customer, type PaymentCreate } from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PayType = "cash" | "check";
type Currency = "ILS" | "USD" | "JOD";

interface PaymentFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

export default function PaymentFlow({
  customer,
  onBack,
  onDone,
}: PaymentFlowProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [payType, setPayType] = useState<PayType>("cash");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [bank, setBank] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const createPayment = useMutation({
    mutationFn: async (payload: PaymentCreate) => {
      if (!navigator.onLine) {
        await syncQueue.push("payment", payload);
        return null;
      }
      return salesApi.createPayment(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-route"] });
      qc.invalidateQueries({ queryKey: ["insights", customer.id] });
      onDone();
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createPayment.mutateAsync({
      customer_id: customer.id,
      type: payType === "cash" ? "Payment_Cash" : "Payment_Check",
      currency,
      amount: parseFloat(amount),
      notes: notes || undefined,
      data:
        payType === "check"
          ? { bank: bank || undefined, due_date: dueDate || undefined }
          : undefined,
    });
  }

  const currencies: Currency[] = ["ILS", "USD", "JOD"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold">{t("actions.pay")}</h2>
          <p className="text-sm text-muted-foreground">{customer.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
        {/* Payment type tabs */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(["cash", "check"] as PayType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPayType(type)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                payType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {t(`payment.${type}`)}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("payment.amount")}</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            dir="ltr"
          />
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("payment.currency")}</label>
          <div className="flex gap-2">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  currency === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {t(`payment.currencies.${c}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Check-only fields */}
        {payType === "check" && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("payment.bank")}</label>
              <Input
                type="text"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t("payment.dueDate")}
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                dir="ltr"
              />
            </div>
          </>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            ملاحظات (اختياري)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {createPayment.isError && (
          <p className="text-sm text-destructive text-center">
            {t("errors.generic")}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={createPayment.isPending || !amount}
        >
          {createPayment.isPending ? "…" : t("actions.confirm")}
        </Button>
      </form>
    </div>
  );
}
