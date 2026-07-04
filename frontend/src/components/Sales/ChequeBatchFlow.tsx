import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Hash, User, Trash2, Plus, CalendarDays } from "@/lib/icons";
import { salesApi, type Customer, type PaymentCreate, type CheckData } from "@/services/salesApi";
import { formatCurrency } from "@/lib/format";
import { syncQueue } from "@/lib/syncQueue";
import { checkImageQueue } from "@/lib/checkImageQueue";
import { newClientId } from "@/lib/offlineDB";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/useToast";
import { useAppSelector } from "@/store";
import { BankAutocomplete, saveBankToHistory } from "@/components/ui/bank-autocomplete";
import { CheckCapture } from "./CheckCapture";
import { StepWizard, type WizardStep } from "@/components/ui/step-wizard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { generateSeries } from "@/lib/chequeSeries";

interface ChequeBatchFlowProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

type Currency = "ILS" | "USD" | "JOD";

const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  ILS: 1,
  USD: 3.65,
  JOD: 5.15,
};

interface ChequeRow {
  id: string;
  checkNumber: string;
  dueDate: string;
  amount: string;
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;
}

function blankRow(): ChequeRow {
  return {
    id: newClientId(),
    checkNumber: "",
    dueDate: "",
    amount: "",
    imageBlob: null,
    imagePreviewUrl: null,
  };
}

export function ChequeBatchFlow({ customer, onBack, onDone }: ChequeBatchFlowProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { isOnline } = useOfflineSync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userId = useAppSelector((state) => state.auth.userId) ?? "";

  // ── Step 1: shared details ────────────────────────────────────────────────
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [exchangeRate, setExchangeRate] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");

  // ── Step 2: cheque rows ───────────────────────────────────────────────────
  const [rows, setRows] = useState<ChequeRow[]>([blankRow()]);

  // Series quick-add inputs
  const [seriesStart, setSeriesStart] = useState("");
  const [seriesCount, setSeriesCount] = useState("");
  const [seriesAmount, setSeriesAmount] = useState("");
  const [seriesDate, setSeriesDate] = useState("");
  const [seriesInterval, setSeriesInterval] = useState<0 | 1>(1);

  // ── Submission state ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const parsedRate = parseFloat(exchangeRate) || 0;

  const currencies: { value: Currency; label: string; symbol: string }[] = [
    { value: "ILS", label: t("payment.currencies.ILS"), symbol: "₪" },
    { value: "USD", label: t("payment.currencies.USD"), symbol: "$" },
    { value: "JOD", label: t("payment.currencies.JOD"), symbol: "د.أ" },
  ];
  const currencySymbol = currencies.find((c) => c.value === currency)?.symbol ?? "₪";

  function handleCurrencyChange(c: Currency) {
    setCurrency(c);
    setExchangeRate(c !== "ILS" ? DEFAULT_EXCHANGE_RATES[c].toString() : "");
  }

  // ── Row mutators ──────────────────────────────────────────────────────────
  function updateRow(id: string, patch: Partial<ChequeRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.imagePreviewUrl) URL.revokeObjectURL(target.imagePreviewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function handleRowCapture(id: string, blob: Blob, previewUrl: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
        return { ...r, imageBlob: blob, imagePreviewUrl: previewUrl };
      })
    );
  }

  function handleRowRemovePhoto(id: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
        return { ...r, imageBlob: null, imagePreviewUrl: null };
      })
    );
  }

  function handleGenerateSeries() {
    const count = parseInt(seriesCount, 10);
    const amount = parseFloat(seriesAmount);
    if (!seriesStart.trim() || !count || count < 1 || !amount || amount <= 0 || !seriesDate) {
      toast({ title: t("payment.batch.invalidRow"), variant: "warning" });
      return;
    }
    const generated = generateSeries({
      startNumber: seriesStart.trim(),
      count,
      amount,
      startDate: seriesDate,
      intervalMonths: seriesInterval,
    });
    setRows(
      generated.map((c) => ({
        id: newClientId(),
        checkNumber: c.check_number,
        dueDate: c.due_date,
        amount: c.amount.toString(),
        imageBlob: null,
        imagePreviewUrl: null,
      }))
    );
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const step1Valid =
    bankNumber.trim().length > 0 &&
    branchNumber.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    (currency === "ILS" || parsedRate > 0);

  const rowsValid =
    rows.length > 0 &&
    rows.every((r) => r.checkNumber.trim().length > 0 && (parseFloat(r.amount) || 0) > 0);

  // ── Totals (ILS-equivalent) ───────────────────────────────────────────────
  function rowIlsEquivalent(row: ChequeRow): number {
    const amt = parseFloat(row.amount) || 0;
    return currency !== "ILS" && parsedRate > 0 ? amt * parsedRate : amt;
  }
  const totalIls = rows.reduce((sum, r) => sum + rowIlsEquivalent(r), 0);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);

    if (bankName.trim()) saveBankToHistory(bankName.trim(), userId);

    const sharedCheck = {
      bank: bankName.trim() || undefined,
      bank_number: bankNumber.trim(),
      branch_number: branchNumber.trim(),
      account_number: accountNumber.trim(),
      holder_name: holderName.trim() || undefined,
    };

    let succeeded = 0;
    try {
      for (const row of rows) {
        const checkData: CheckData = {
          ...sharedCheck,
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
              console.warn("[ChequeBatchFlow] Image upload failed, submitting without image_url");
            }
          }
          const payload: PaymentCreate = {
            customer_id: customer.id,
            type: "Payment_Check",
            currency,
            amount,
            ...(currency !== "ILS" && { exchange_rate: parsedRate }),
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
              console.warn("[ChequeBatchFlow] Failed to store image in IndexedDB, queuing without image");
            }
          }
          const payload: PaymentCreate & { pending_image_id?: number } = {
            customer_id: customer.id,
            type: "Payment_Check",
            currency,
            amount,
            ...(currency !== "ILS" && { exchange_rate: parsedRate }),
            data: checkData,
            ...(pendingImageId !== undefined && { pending_image_id: pendingImageId }),
          };
          await syncQueue.push("payment", payload, row.id);
          succeeded++;
        }
      }
    } catch (err) {
      console.error("[ChequeBatchFlow] Submission failed", err);
      // Partial failure: drop the cheques that already went through so a retry
      // only submits the remainder (and the still-pending row reuses its stable
      // key, so even an ambiguous network failure won't duplicate).
      const total = rows.length;
      setRows((prev) => prev.slice(succeeded));
      invalidate();
      setSubmitting(false);
      toast({
        title: t("payment.batch.partialSuccess", { done: succeeded, total }),
        variant: "error",
      });
      return;
    }

    invalidate();
    setSubmitting(false);
    setDone(true);
    toast({
      title: isOnline
        ? t("payment.batch.recorded", { count: succeeded })
        : t("payment.batch.queued", { count: succeeded }),
      variant: "success",
    });
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-route"] });
    queryClient.invalidateQueries({ queryKey: ["my-customers"] });
    queryClient.invalidateQueries({ queryKey: ["insights", customer.id] });
    queryClient.invalidateQueries({ queryKey: ["statement", customer.id] });
    queryClient.invalidateQueries({ queryKey: ["daily-ledger"] });
  }

  function handleClose() {
    for (const r of rows) {
      if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
    }
    if (done) onDone();
    else onBack();
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  const steps: WizardStep[] = [
    {
      key: "shared",
      title: t("payment.batch.sharedTitle"),
      hint: t("payment.batch.sharedHint"),
      canAdvance: step1Valid,
      content: (
        <div className="space-y-4">
          {/* Currency */}
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
                    currency === c.value && "border-primary bg-primary/5 ring-1 ring-primary"
                  )}
                  onClick={() => handleCurrencyChange(c.value)}
                >
                  <span className="text-h3 font-bold text-foreground">{c.symbol}</span>
                  <span className="text-caption text-muted-foreground">{c.label}</span>
                </Card>
              ))}
            </div>
          </div>

          {currency !== "ILS" && (
            <FormField label={t("payment.exchangeRate")} required>
              <Input
                type="number"
                inputMode="decimal"
                dir="ltr"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
                startIcon={<ArrowLeftRight className="h-4 w-4" />}
              />
            </FormField>
          )}

          <Separator label={t("payment.check")} />

          <FormField label={t("payment.bank")}>
            <BankAutocomplete
              value={bankName}
              onChange={(v) => {
                setBankName(v);
                if (v.trim()) saveBankToHistory(v.trim(), userId);
              }}
              userId={userId}
              placeholder={t("payment.bank")}
            />
          </FormField>

          <FormField label={t("payment.bankNumber")} required>
            <Input
              value={bankNumber}
              onChange={(e) => setBankNumber(e.target.value)}
              placeholder={t("payment.bankNumber")}
              inputMode="numeric"
              dir="ltr"
              startIcon={<Hash className="h-4 w-4" />}
            />
          </FormField>

          <FormField label={t("payment.branchNumber")} required>
            <Input
              value={branchNumber}
              onChange={(e) => setBranchNumber(e.target.value)}
              placeholder={t("payment.branchNumber")}
              inputMode="numeric"
              dir="ltr"
              startIcon={<Hash className="h-4 w-4" />}
            />
          </FormField>

          <FormField label={t("payment.accountNumber")} required>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={t("payment.accountNumber")}
              inputMode="numeric"
              dir="ltr"
              startIcon={<Hash className="h-4 w-4" />}
            />
          </FormField>

          <FormField label={t("payment.holderName")}>
            <Input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder={t("payment.holderName")}
              startIcon={<User className="h-4 w-4" />}
            />
          </FormField>
        </div>
      ),
    },
    {
      key: "cheques",
      title: t("payment.batch.chequesTitle"),
      hint: t("payment.batch.chequesHint"),
      canAdvance: rowsValid,
      content: (
        <div className="space-y-4">
          {/* Series quick-add */}
          <Card variant="glass" className="space-y-3 p-3">
            <p className="text-body-sm font-bold text-foreground">
              {t("payment.series.title")}
            </p>
            <p className="text-caption text-muted-foreground">{t("payment.series.hint")}</p>
            <div className="grid grid-cols-2 gap-2">
              <FormField label={t("payment.series.startNumber")}>
                <Input
                  value={seriesStart}
                  onChange={(e) => setSeriesStart(e.target.value)}
                  dir="ltr"
                  placeholder="XXXX05"
                />
              </FormField>
              <FormField label={t("payment.series.count")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  value={seriesCount}
                  onChange={(e) => setSeriesCount(e.target.value)}
                  min={1}
                  max={60}
                  placeholder="12"
                />
              </FormField>
              <FormField label={t("payment.series.amountEach")}>
                <Input
                  type="number"
                  inputMode="decimal"
                  dir="ltr"
                  value={seriesAmount}
                  onChange={(e) => setSeriesAmount(e.target.value)}
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t("payment.series.startDate")}>
                <Input
                  type="date"
                  value={seriesDate}
                  onChange={(e) => setSeriesDate(e.target.value)}
                />
              </FormField>
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-foreground">
                {t("payment.series.interval")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={seriesInterval === 1 ? "gradient" : "outline"}
                  size="sm"
                  onClick={() => setSeriesInterval(1)}
                >
                  {t("payment.series.intervalMonthly")}
                </Button>
                <Button
                  type="button"
                  variant={seriesInterval === 0 ? "gradient" : "outline"}
                  size="sm"
                  onClick={() => setSeriesInterval(0)}
                >
                  {t("payment.series.intervalNone")}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleGenerateSeries}
            >
              {t("payment.series.generate")}
            </Button>
          </Card>

          {/* Cheque rows */}
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const rowOk = row.checkNumber.trim().length > 0 && (parseFloat(row.amount) || 0) > 0;
              return (
                <Card key={row.id} variant="glass" className="space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-body-sm font-bold",
                        rowOk ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {t("payment.batch.chequeNumber", { n: idx + 1 })}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <FormField label={t("payment.checkNumber")} required>
                    <Input
                      value={row.checkNumber}
                      onChange={(e) => updateRow(row.id, { checkNumber: e.target.value })}
                      placeholder={t("payment.checkNumber")}
                      inputMode="numeric"
                      dir="ltr"
                      startIcon={<Hash className="h-4 w-4" />}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label={t("payment.amount")} required>
                      <Input
                        type="number"
                        inputMode="decimal"
                        dir="ltr"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                        placeholder="0.00"
                        min={0}
                        step="0.01"
                      />
                    </FormField>
                    <FormField label={t("payment.dueDate")}>
                      <Input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => updateRow(row.id, { dueDate: e.target.value })}
                        startIcon={<CalendarDays className="h-4 w-4" />}
                      />
                    </FormField>
                  </div>

                  <CheckCapture
                    imageBlob={row.imageBlob}
                    imagePreviewUrl={row.imagePreviewUrl}
                    onCapture={(blob, url) => handleRowCapture(row.id, blob, url)}
                    onRemove={() => handleRowRemovePhoto(row.id)}
                  />
                </Card>
              );
            })}
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={addRow}>
            <Plus className="h-4 w-4 me-1.5" />
            {t("payment.batch.addCheque")}
          </Button>
        </div>
      ),
    },
    {
      key: "review",
      title: t("payment.batch.reviewTitle"),
      hint: t("payment.batch.reviewHint"),
      canAdvance: rowsValid && step1Valid,
      content: (
        <div className="space-y-3">
          {/* Shared bank/account */}
          <div className="rounded-xl border border-border bg-background-subtle px-3 py-2.5 space-y-1">
            {bankName.trim() && (
              <div className="flex justify-between text-body-sm">
                <span className="text-muted-foreground">{t("payment.bank")}</span>
                <span className="font-medium">{bankName}</span>
              </div>
            )}
            <div className="flex justify-between text-body-sm">
              <span className="text-muted-foreground">{t("payment.accountNumber")}</span>
              <span className="font-medium" dir="ltr">
                {accountNumber}
              </span>
            </div>
          </div>

          {/* Cheque list */}
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <Card key={row.id} variant="glass" className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold" dir="ltr">
                      #{row.checkNumber}
                    </p>
                    {row.dueDate && (
                      <p className="text-caption text-muted-foreground" dir="ltr">
                        {row.dueDate}
                      </p>
                    )}
                    <p className="text-caption text-muted-foreground">
                      {t("payment.batch.chequeNumber", { n: idx + 1 })}
                    </p>
                  </div>
                  <p className="text-body-sm font-bold text-foreground" dir="ltr">
                    {currencySymbol} {formatCurrency(parseFloat(row.amount) || 0)}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-body-sm">
            <span className="text-muted-foreground">{t("payment.batch.chequeCount")}</span>
            <span className="font-medium">{rows.length}</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between border-t pt-3">
            <p className="font-semibold">{t("payment.batch.total")}</p>
            <p className="font-semibold text-primary" dir="ltr">
              ₪ {formatCurrency(totalIls)}
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <StepWizard
      open
      onClose={handleClose}
      done={done}
      submitting={submitting}
      onComplete={handleConfirm}
      steps={steps}
      dir={isRTL ? "rtl" : "ltr"}
      width={440}
      successMessage={t("payment.batch.successTitle")}
      successHint={t("payment.batch.successHint")}
      labels={{
        next: t("actions.next"),
        back: t("actions.back"),
        complete: t("actions.confirm"),
        done: t("actions.close"),
        close: t("actions.close"),
        stepCounter: (current, total) => `${current} / ${total}`,
      }}
      theme={{
        paper: "hsl(var(--card))",
        ink: "hsl(var(--foreground))",
        muted: "hsl(var(--muted-foreground))",
        rule: "hsl(var(--border))",
        soft: "hsl(var(--secondary))",
        accent: "hsl(var(--primary))",
        onAccent: "hsl(var(--primary-foreground))",
      }}
    />
  );
}
