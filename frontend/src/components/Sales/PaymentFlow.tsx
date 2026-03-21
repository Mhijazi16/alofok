import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Banknote, CalendarDays, Hash, StickyNote, User } from "lucide-react";
import { salesApi, type Customer, type PaymentCreate } from "@/services/salesApi";
import { formatCurrency } from "@/lib/format";
import { syncQueue } from "@/lib/syncQueue";
import { checkImageQueue } from "@/lib/checkImageQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { useAppSelector } from "@/store";
import { BankAutocomplete, saveBankToHistory } from "@/components/ui/bank-autocomplete";
import { CheckPreview } from "./CheckPreview";
import { CheckCapture } from "./CheckCapture";
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

const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  ILS: 1,
  USD: 3.65,
  JOD: 5.15,
};

export function PaymentFlow({ customer, onBack, onDone }: PaymentFlowProps) {
  const { t } = useTranslation();
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userId = useAppSelector((state) => state.auth.userId) ?? "";

  const [paymentType, setPaymentType] = useState<PaymentType>("Payment_Cash");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [exchangeRate, setExchangeRate] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Image capture state
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Revoke object URL on unmount or when preview URL changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const paymentMutation = useMutation({
    mutationFn: salesApi.createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      queryClient.invalidateQueries({ queryKey: ["my-customers"] });
      queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
      setConfirmOpen(false);
      toast({ title: t("payment.paymentSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      setConfirmOpen(false);
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const parsedAmount = parseFloat(amount) || 0;
  const parsedRate = parseFloat(exchangeRate) || 0;
  const ilsEquivalent = currency !== "ILS" && parsedRate > 0 ? parsedAmount * parsedRate : parsedAmount;

  const isValid =
    parsedAmount > 0 &&
    (currency === "ILS" || parsedRate > 0) &&
    (paymentType === "Payment_Cash" ||
      (bankName.trim().length > 0 &&
       bankNumber.trim().length > 0 &&
       branchNumber.trim().length > 0 &&
       accountNumber.trim().length > 0));


  const currencies: { value: Currency; label: string; symbol: string }[] = [
    { value: "ILS", label: t("payment.currencies.ILS"), symbol: "₪" },
    { value: "USD", label: t("payment.currencies.USD"), symbol: "$" },
    { value: "JOD", label: t("payment.currencies.JOD"), symbol: "د.أ" },
  ];

  function handleCurrencyChange(c: Currency) {
    setCurrency(c);
    if (c !== "ILS") {
      setExchangeRate(DEFAULT_EXCHANGE_RATES[c].toString());
    } else {
      setExchangeRate("");
    }
  }

  function handleCapture(blob: Blob, previewUrl: string) {
    // Revoke previous preview URL if any
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageBlob(blob);
    setImagePreviewUrl(previewUrl);
    setImageUrl(null); // Clear any previously uploaded server URL
  }

  function handleRemovePhoto() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageBlob(null);
    setImagePreviewUrl(null);
    setImageUrl(null);
  }

  const handleSubmit = async () => {
    if (paymentType === "Payment_Check" && bankName.trim()) {
      saveBankToHistory(bankName.trim(), userId);
    }

    const checkData = paymentType === "Payment_Check"
      ? {
          bank: bankName.trim(),
          bank_number: bankNumber.trim(),
          branch_number: branchNumber.trim(),
          account_number: accountNumber.trim(),
          holder_name: holderName.trim() || undefined,
          due_date: dueDate || undefined,
        }
      : undefined;

    if (isOnline) {
      // Online path: upload image first if present, then create payment
      let resolvedImageUrl: string | undefined;
      if (imageBlob) {
        try {
          const { url } = await salesApi.uploadCheckImage(imageBlob);
          resolvedImageUrl = url;
          setImageUrl(url);
        } catch {
          // Image upload failure is non-fatal — submit payment without image
          console.warn("[PaymentFlow] Image upload failed, submitting without image_url");
        }
      }

      const payload: PaymentCreate = {
        customer_id: customer.id,
        type: paymentType,
        currency,
        amount: parsedAmount,
        ...(currency !== "ILS" && { exchange_rate: parsedRate }),
        notes: notes.trim() || undefined,
        ...(checkData && {
          data: {
            ...checkData,
            image_url: resolvedImageUrl,
          },
        }),
      };

      paymentMutation.mutate(payload);
    } else {
      // Offline path: store image blob in IndexedDB if present
      let pendingImageId: number | undefined;
      if (imageBlob) {
        try {
          pendingImageId = await checkImageQueue.pushImage(imageBlob);
        } catch {
          console.warn("[PaymentFlow] Failed to store image in IndexedDB, queuing without image");
        }
      }

      const payload: PaymentCreate & { pending_image_id?: number } = {
        customer_id: customer.id,
        type: paymentType,
        currency,
        amount: parsedAmount,
        ...(currency !== "ILS" && { exchange_rate: parsedRate }),
        notes: notes.trim() || undefined,
        ...(checkData && { data: checkData }),
        ...(pendingImageId !== undefined && { pending_image_id: pendingImageId }),
      };

      await syncQueue.push("payment", payload);
      setConfirmOpen(false);
      toast({ title: t("payment.paymentQueued"), variant: "success" });
      onDone();
    }
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
                  dir="ltr"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                  }}
                  placeholder="0.00"
                  className={cn(
                    "h-16 border-primary/50 text-center text-h1 font-bold text-foreground focus-visible:ring-primary max-w-xs"
                  )}
                  inputSize="lg"
                  min={0}
                  step="0.01"
                  onFocus={() => setFocusedField("amount")}
                  onBlur={() => setFocusedField(null)}
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
                      onClick={() => handleCurrencyChange(c.value)}
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

              {/* Exchange Rate (for USD / JOD) */}
              {currency !== "ILS" && (
                <div className="space-y-2 animate-fade-in">
                  <FormField label={t("payment.exchangeRate")}>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        inputMode="decimal"
                        dir="ltr"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="0.00"
                        className="max-w-[140px]"
                        min={0}
                        step="0.01"
                        startIcon={<ArrowLeftRight className="h-4 w-4" />}
                      />
                      <span className="text-body-sm text-muted-foreground whitespace-nowrap">
                        {t("payment.rateToILS", {
                          symbol: currencies.find((c) => c.value === currency)?.symbol,
                        })}
                      </span>
                    </div>
                  </FormField>
                  {parsedAmount > 0 && parsedRate > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <span className="text-body-sm text-muted-foreground">
                        {t("payment.ilsEquivalent")}
                      </span>
                      <span className="text-body font-bold text-primary" dir="ltr">
                        ₪ {formatCurrency(ilsEquivalent)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Check-specific fields */}
              {paymentType === "Payment_Check" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Photo capture — above CheckPreview */}
                  <CheckCapture
                    imageBlob={imageBlob}
                    imagePreviewUrl={imagePreviewUrl}
                    onCapture={handleCapture}
                    onRemove={handleRemovePhoto}
                  />

                  {/* Check SVG Preview — always LTR */}
                  <CheckPreview
                    amount={amount}
                    currency={currency}
                    bankName={bankName}
                    bankNumber={bankNumber}
                    branchNumber={branchNumber}
                    accountNumber={accountNumber}
                    holderName={holderName}
                    dueDate={dueDate}
                    focusedField={focusedField}
                  />

                  <Separator label={t("payment.check")} />

                  <FormField label={t("payment.bank")} required>
                    <BankAutocomplete
                      value={bankName}
                      onChange={setBankName}
                      userId={userId}
                      placeholder={t("payment.bank")}
                      onFocus={() => setFocusedField("bankName")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </FormField>

                  <FormField label={t("payment.bankNumber")} required>
                    <Input
                      value={bankNumber}
                      onChange={(e) => {
                        setBankNumber(e.target.value);
                      }}
                      placeholder={t("payment.bankNumber")}
                      inputMode="numeric"
                      dir="ltr"
                      startIcon={<Hash className="h-4 w-4" />}
                      className={cn()}
                      onFocus={() => setFocusedField("bankNumber")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </FormField>

                  <FormField label={t("payment.branchNumber")} required>
                    <Input
                      value={branchNumber}
                      onChange={(e) => {
                        setBranchNumber(e.target.value);
                      }}
                      placeholder={t("payment.branchNumber")}
                      inputMode="numeric"
                      dir="ltr"
                      startIcon={<Hash className="h-4 w-4" />}
                      className={cn()}
                      onFocus={() => setFocusedField("branchNumber")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </FormField>

                  <FormField label={t("payment.accountNumber")} required>
                    <Input
                      value={accountNumber}
                      onChange={(e) => {
                        setAccountNumber(e.target.value);
                      }}
                      placeholder={t("payment.accountNumber")}
                      inputMode="numeric"
                      dir="ltr"
                      startIcon={<Hash className="h-4 w-4" />}
                      className={cn()}
                      onFocus={() => setFocusedField("accountNumber")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </FormField>

                  <FormField label={t("payment.holderName")}>
                    <Input
                      value={holderName}
                      onChange={(e) => {
                        setHolderName(e.target.value);
                      }}
                      placeholder={t("payment.holderName")}
                      startIcon={<User className="h-4 w-4" />}
                      className={cn()}
                      onFocus={() => setFocusedField("holderName")}
                      onBlur={() => setFocusedField(null)}
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
                      onFocus={() => setFocusedField("dueDate")}
                      onBlur={() => setFocusedField(null)}
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
                    {currency !== "ILS" && parsedRate > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-body-sm text-muted-foreground">
                            {t("payment.exchangeRate")}
                          </span>
                          <span className="text-body font-medium text-foreground" dir="ltr">
                            1 {currencies.find((c) => c.value === currency)?.symbol} = {parsedRate} ₪
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-body-sm text-muted-foreground">
                            {t("payment.ilsEquivalent")}
                          </span>
                          <span className="text-body font-bold text-primary" dir="ltr">
                            ₪ {formatCurrency(ilsEquivalent)}
                          </span>
                        </div>
                      </>
                    )}
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
                    {paymentType === "Payment_Check" && bankNumber.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">{t("payment.bankNumber")}</span>
                        <span className="text-body font-medium text-foreground">{bankNumber}</span>
                      </div>
                    )}
                    {paymentType === "Payment_Check" && branchNumber.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">{t("payment.branchNumber")}</span>
                        <span className="text-body font-medium text-foreground">{branchNumber}</span>
                      </div>
                    )}
                    {paymentType === "Payment_Check" && accountNumber.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">{t("payment.accountNumber")}</span>
                        <span className="text-body font-medium text-foreground">{accountNumber}</span>
                      </div>
                    )}
                    {paymentType === "Payment_Check" && holderName.trim() && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">{t("payment.holderName")}</span>
                        <span className="text-body font-medium text-foreground">{holderName}</span>
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
                    {paymentType === "Payment_Check" && (imageBlob || imageUrl) && (
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm text-muted-foreground">
                          {t("payment.checkImage")}
                        </span>
                        <span className="text-body-sm text-success font-medium">
                          {imageUrl ? t("capture.checkPhoto") : t("capture.uploadPending")}
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
                        {formatCurrency(customer.balance)} → {formatCurrency(customer.balance - ilsEquivalent)}
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
