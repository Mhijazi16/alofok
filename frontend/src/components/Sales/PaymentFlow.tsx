import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Building2, CalendarDays, StickyNote } from "lucide-react";
import { salesApi, type Customer, type PaymentCreate } from "@/services/salesApi";
import { syncQueue } from "@/lib/syncQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";

interface PaymentFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

type PaymentType = "Payment_Cash" | "Payment_Check";
type Currency = "ILS" | "USD" | "JOD";

export function PaymentFlow({ customer, onBack, onDone }: PaymentFlowProps) {
  const { t, i18n } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [paymentType, setPaymentType] = useState<PaymentType>("Payment_Cash");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [bankName, setBankName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const paymentMutation = useMutation({
    mutationFn: salesApi.createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
      toast({ title: t("payment.paymentSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const parsedAmount = parseFloat(amount) || 0;
  const isValid =
    parsedAmount > 0 &&
    (paymentType === "Payment_Cash" || bankName.trim().length > 0);

  const formatCurrency = (val: number) =>
    val.toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const currencies: { value: Currency; label: string; symbol: string }[] = [
    { value: "ILS", label: t("payment.currencies.ILS"), symbol: "₪" },
    { value: "USD", label: t("payment.currencies.USD"), symbol: "$" },
    { value: "JOD", label: t("payment.currencies.JOD"), symbol: "د.أ" },
  ];

  const handleSubmit = async () => {
    const payload: PaymentCreate = {
      customer_id: customer.id,
      type: paymentType,
      currency,
      amount: parsedAmount,
      notes: notes.trim() || undefined,
      ...(paymentType === "Payment_Check" && {
        data: {
          bank: bankName.trim(),
          due_date: dueDate || undefined,
        },
      }),
    };

    if (isOnline) {
      paymentMutation.mutate(payload);
    } else {
      await syncQueue.push("payment", payload);
      toast({ title: t("payment.paymentQueued"), variant: "success" });
      onDone();
    }
    setConfirmOpen(false);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={t("actions.pay")}
        subtitle={customer.name}
        backButton={{ onBack }}
      />

      <div className="space-y-5 p-4">
        {/* Current balance */}
        <StatCard
          variant="glass"
          value={formatCurrency(customer.balance)}
          label={t("customer.balance")}
          icon={Banknote}
          className="animate-slide-up"
        />

        {/* Payment Type Tabs */}
        <Tabs
          value={paymentType}
          onValueChange={(v) => setPaymentType(v as PaymentType)}
        >
          <TabsList variant="segment" className="w-full">
            <TabsTrigger value="Payment_Cash">{t("payment.cash")}</TabsTrigger>
            <TabsTrigger value="Payment_Check">
              {t("payment.check")}
            </TabsTrigger>
          </TabsList>

          {/* Shared content for both tabs */}
          <TabsContent value={paymentType} forceMount className="mt-4">
            <div className="space-y-5">
              {/* Amount Input */}
              <div className="flex flex-col items-center gap-2">
                <label className="text-body-sm text-muted-foreground">
                  {t("payment.amount")}
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-16 border-primary/50 text-center text-h1 font-bold text-foreground focus-visible:ring-primary max-w-xs"
                  inputSize="lg"
                  min={0}
                  step="0.01"
                />
              </div>

              {/* Currency Selector */}
              <div className="space-y-2">
                <label className="text-body-sm font-medium text-foreground">
                  {t("payment.currency")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {currencies.map((c) => (
                    <Card
                      key={c.value}
                      variant="interactive"
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 transition-all",
                        currency === c.value &&
                          "border-primary bg-primary/5 ring-1 ring-primary"
                      )}
                      onClick={() => setCurrency(c.value)}
                    >
                      <span className="text-h3 font-bold text-foreground">
                        {c.symbol}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {c.label}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Check-specific fields */}
              {paymentType === "Payment_Check" && (
                <div className="space-y-4 animate-fade-in">
                  <Separator label={t("payment.check")} />

                  <FormField
                    label={t("payment.bank")}
                    required
                    error={
                      paymentType === "Payment_Check" && !bankName.trim()
                        ? undefined
                        : undefined
                    }
                  >
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder={t("payment.bank")}
                      startIcon={
                        <Building2 className="h-4 w-4" />
                      }
                    />
                  </FormField>

                  <FormField label={t("payment.dueDate")}>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      startIcon={
                        <CalendarDays className="h-4 w-4" />
                      }
                    />
                  </FormField>
                </div>
              )}

              {/* Notes */}
              <FormField label={t("payment.notes")}>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("payment.notes")}
                  startIcon={<StickyNote className="h-4 w-4" />}
                />
              </FormField>

              {/* Payment Summary */}
              {parsedAmount > 0 && (
                <Card variant="glass" className="animate-scale-in">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-body-sm">
                      {t("payment.paymentSummary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted-foreground">
                        {t("payment.paymentType")}
                      </span>
                      <Badge
                        variant={
                          paymentType === "Payment_Cash" ? "success" : "info"
                        }
                      >
                        {paymentType === "Payment_Cash"
                          ? t("payment.cash")
                          : t("payment.check")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted-foreground">
                        {t("payment.amount")}
                      </span>
                      <span className="text-h4 font-bold text-foreground">
                        {formatCurrency(parsedAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted-foreground">
                        {t("payment.currency")}
                      </span>
                      <span className="text-body font-medium text-foreground">
                        {currencies.find((c) => c.value === currency)?.label}
                      </span>
                    </div>
                    {paymentType === "Payment_Check" && bankName.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">
                          {t("payment.bank")}
                        </span>
                        <span className="text-body font-medium text-foreground">
                          {bankName}
                        </span>
                      </div>
                    )}
                    {paymentType === "Payment_Check" && dueDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">
                          {t("payment.dueDate")}
                        </span>
                        <span className="text-body font-medium text-foreground">
                          {new Date(dueDate).toLocaleDateString("en-US")}
                        </span>
                      </div>
                    )}
                    {notes.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">
                          {t("payment.notes")}
                        </span>
                        <span className="text-body-sm text-foreground max-w-[60%] truncate">
                          {notes}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted-foreground">
                        {t("customer.balance")} ({t("actions.pay")})
                      </span>
                      <span className="text-body-sm text-success font-medium">
                        {formatCurrency(customer.balance)} → {formatCurrency(customer.balance - parsedAmount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              <Button
                variant="gradient"
                size="xl"
                className="w-full"
                disabled={!isValid}
                onClick={() => setConfirmOpen(true)}
              >
                {t("payment.confirmPayment")} -{" "}
                {formatCurrency(parsedAmount)}{" "}
                {currencies.find((c) => c.value === currency)?.symbol}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirm.paymentTitle")}
        description={t("confirm.paymentDesc")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={handleSubmit}
        isLoading={paymentMutation.isPending}
      />
    </div>
  );
}
