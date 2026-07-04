import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Customer } from "@/services/salesApi";
import { newClientId } from "@/lib/offlineDB";
import { useToast } from "@/hooks/useToast";
import { useAppSelector } from "@/store";
import { saveBankToHistory } from "@/components/ui/bank-autocomplete";
import { StepWizard, type WizardStep } from "@/components/ui/step-wizard";
import { generateSeries } from "@/lib/chequeSeries";
import {
  blankRow,
  DEFAULT_EXCHANGE_RATES,
  type ChequeRow,
  type ChequeType,
  type CollectMethod,
  type Currency,
  type CurrencyOption,
} from "./types";
import { useCollectSubmit } from "./useCollectSubmit";
import { MethodStep } from "./steps/MethodStep";
import { CashAmountStep } from "./steps/CashAmountStep";
import { CashNotesStep } from "./steps/CashNotesStep";
import { CashReviewStep } from "./steps/CashReviewStep";
import { ChequeTypeStep } from "./steps/ChequeTypeStep";
import { ChequeSharedDetailsStep } from "./steps/ChequeSharedDetailsStep";
import { SeriesConfigStep } from "./steps/SeriesConfigStep";
import { SeriesEditStep } from "./steps/SeriesEditStep";
import { NormalChequesStep } from "./steps/NormalChequesStep";
import { ChequeReviewStep } from "./steps/ChequeReviewStep";

interface CollectWizardProps {
  customer: Customer;
  onBack: () => void;
  onDone: () => void;
}

export function CollectWizard({ customer, onBack, onDone }: CollectWizardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const userId = useAppSelector((state) => state.auth.userId) ?? "";

  // ── selection ──────────────────────────────────────────────────────────────
  const [method, setMethod] = useState<CollectMethod | null>(null);
  const [chequeType, setChequeType] = useState<ChequeType | null>(null);

  // ── currency (shared by cash AND cheques) ──────────────────────────────────
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [exchangeRate, setExchangeRate] = useState("");

  // ── cash ────────────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // ── cheque shared details ───────────────────────────────────────────────────
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");

  // ── cheque rows (series + normal share the same ChequeRow[]) ────────────────
  const [rows, setRows] = useState<ChequeRow[]>([blankRow()]);
  const [generatedFromSeries, setGeneratedFromSeries] = useState(false);

  // ── series config ────────────────────────────────────────────────────────────
  const [seriesStart, setSeriesStart] = useState("");
  const [seriesNumberDelta, setSeriesNumberDelta] = useState("1");
  const [seriesCount, setSeriesCount] = useState("");
  const [seriesDateDelta, setSeriesDateDelta] = useState("1");
  const [seriesDate, setSeriesDate] = useState("");
  const [seriesAmountAll, setSeriesAmountAll] = useState("");

  // ── submission ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const parsedRate = parseFloat(exchangeRate) || 0;

  const currencies: CurrencyOption[] = [
    { value: "ILS", label: t("payment.currencies.ILS"), symbol: "₪" },
    { value: "USD", label: t("payment.currencies.USD"), symbol: "$" },
    { value: "JOD", label: t("payment.currencies.JOD"), symbol: "د.أ" },
  ];

  function handleCurrencyChange(c: Currency) {
    setCurrency(c);
    setExchangeRate(c !== "ILS" ? DEFAULT_EXCHANGE_RATES[c].toString() : "");
  }

  // ── row mutators ─────────────────────────────────────────────────────────────
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
  function applyAmountToAll() {
    const val = seriesAmountAll;
    setRows((prev) => prev.map((r) => ({ ...r, amount: val })));
  }

  function handleGenerateSeries() {
    const count = parseInt(seriesCount, 10);
    const amt = parseFloat(seriesAmountAll) || 0;
    if (!seriesStart.trim() || !count || count < 1 || !seriesDate) {
      toast({ title: t("payment.batch.invalidRow"), variant: "warning" });
      return;
    }
    const generated = generateSeries({
      startNumber: seriesStart.trim(),
      count,
      amount: amt,
      startDate: seriesDate,
      intervalMonths: parseInt(seriesDateDelta, 10) || 0,
      numberDelta: parseInt(seriesNumberDelta, 10) || 1,
    });
    // Revoke any previews from previously-generated rows before replacing.
    for (const r of rows) {
      if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
    }
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
    setGeneratedFromSeries(true);
  }

  function handleBankNameChange(v: string) {
    setBankName(v);
    if (v.trim()) saveBankToHistory(v.trim(), userId);
  }

  function handleChequeTypeChange(type: ChequeType) {
    setChequeType(type);
    if (type === "normal" && (generatedFromSeries || rows.length === 0)) {
      for (const r of rows) {
        if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
      }
      setRows([blankRow()]);
      setGeneratedFromSeries(false);
    }
  }

  // ── validation gates ─────────────────────────────────────────────────────────
  const cashValid = parsedAmount > 0 && (currency === "ILS" || parsedRate > 0);
  const sharedValid =
    bankNumber.trim().length > 0 &&
    branchNumber.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    (currency === "ILS" || parsedRate > 0);
  const seriesConfigValid =
    seriesStart.trim().length > 0 &&
    parseInt(seriesCount, 10) > 0 &&
    !!seriesDate &&
    parseInt(seriesNumberDelta, 10) >= 1 &&
    parseInt(seriesDateDelta, 10) >= 0;
  const rowsValid =
    rows.length > 0 &&
    rows.every((r) => r.checkNumber.trim().length > 0 && (parseFloat(r.amount) || 0) > 0);

  const { handleSubmit } = useCollectSubmit({
    customer,
    method,
    currency,
    parsedRate,
    parsedAmount,
    notes,
    bankName,
    bankNumber,
    branchNumber,
    accountNumber,
    holderName,
    rows,
    userId,
    submitting,
    setSubmitting,
    setDone,
    setRows,
  });

  // ── build the dynamic, growing steps[] ───────────────────────────────────────
  const steps: WizardStep[] = useMemo(() => {
    const methodStep: WizardStep = {
      key: "method",
      title: t("payment.collect.methodTitle"),
      hint: t("payment.collect.methodHint"),
      canAdvance: method !== null,
      content: <MethodStep method={method} onChange={setMethod} />,
    };

    if (method === "cash") {
      return [
        methodStep,
        {
          key: "cash-amount",
          title: t("payment.amount"),
          hint: t("payment.cash.amountHint"),
          canAdvance: cashValid,
          content: (
            <CashAmountStep
              amount={amount}
              currency={currency}
              exchangeRate={exchangeRate}
              currencies={currencies}
              onAmountChange={setAmount}
              onCurrencyChange={handleCurrencyChange}
              onExchangeRateChange={setExchangeRate}
            />
          ),
        },
        {
          key: "cash-notes",
          title: t("payment.notes"),
          hint: t("payment.cash.notesHint"),
          canAdvance: true,
          content: <CashNotesStep notes={notes} onNotesChange={setNotes} />,
        },
        {
          key: "cash-review",
          title: t("payment.collect.reviewTitle"),
          hint: t("payment.collect.reviewHint"),
          canAdvance: cashValid,
          content: (
            <CashReviewStep
              amount={amount}
              currency={currency}
              exchangeRate={exchangeRate}
              notes={notes}
              currencies={currencies}
              customerBalance={customer.balance}
            />
          ),
        },
      ];
    }

    if (method === "cheque") {
      const base: WizardStep[] = [
        methodStep,
        {
          key: "cheque-type",
          title: t("payment.collect.chequeTypeTitle"),
          hint: t("payment.collect.chequeTypeHint"),
          canAdvance: chequeType !== null,
          content: <ChequeTypeStep chequeType={chequeType} onChange={handleChequeTypeChange} />,
        },
      ];

      if (chequeType === null) return base;

      const sharedStep: WizardStep = {
        key: "shared",
        title: t("payment.batch.sharedTitle"),
        hint: t("payment.batch.sharedHint"),
        canAdvance: sharedValid,
        content: (
          <ChequeSharedDetailsStep
            currency={currency}
            exchangeRate={exchangeRate}
            currencies={currencies}
            bankName={bankName}
            bankNumber={bankNumber}
            branchNumber={branchNumber}
            accountNumber={accountNumber}
            holderName={holderName}
            userId={userId}
            onCurrencyChange={handleCurrencyChange}
            onExchangeRateChange={setExchangeRate}
            onBankNameChange={handleBankNameChange}
            onBankNumberChange={setBankNumber}
            onBranchNumberChange={setBranchNumber}
            onAccountNumberChange={setAccountNumber}
            onHolderNameChange={setHolderName}
          />
        ),
      };

      const reviewStep: WizardStep = {
        key: "review",
        title: t("payment.batch.reviewTitle"),
        hint: t("payment.batch.reviewHint"),
        canAdvance: rowsValid && sharedValid,
        content: (
          <ChequeReviewStep
            rows={rows}
            bankName={bankName}
            accountNumber={accountNumber}
            currency={currency}
            exchangeRate={exchangeRate}
            currencies={currencies}
          />
        ),
      };

      if (chequeType === "series") {
        return [
          ...base,
          sharedStep,
          {
            key: "series-config",
            title: t("payment.series.configTitle"),
            hint: t("payment.series.configHint"),
            canAdvance: seriesConfigValid,
            content: (
              <SeriesConfigStep
                seriesStart={seriesStart}
                seriesNumberDelta={seriesNumberDelta}
                seriesCount={seriesCount}
                seriesDateDelta={seriesDateDelta}
                seriesDate={seriesDate}
                seriesAmountAll={seriesAmountAll}
                rowCount={generatedFromSeries ? rows.length : 0}
                onSeriesStartChange={setSeriesStart}
                onSeriesNumberDeltaChange={setSeriesNumberDelta}
                onSeriesCountChange={setSeriesCount}
                onSeriesDateDeltaChange={setSeriesDateDelta}
                onSeriesDateChange={setSeriesDate}
                onSeriesAmountAllChange={setSeriesAmountAll}
                onGenerate={handleGenerateSeries}
              />
            ),
          },
          {
            key: "series-edit",
            title: t("payment.series.editTitle"),
            hint: t("payment.series.editHint"),
            canAdvance: rowsValid,
            content: (
              <SeriesEditStep
                rows={rows}
                seriesAmountAll={seriesAmountAll}
                onSeriesAmountAllChange={setSeriesAmountAll}
                onApplyAmountToAll={applyAmountToAll}
                onUpdateRow={updateRow}
              />
            ),
          },
          reviewStep,
        ];
      }

      // chequeType === "normal"
      return [
        ...base,
        sharedStep,
        {
          key: "normal-cheques",
          title: t("payment.normal.addTitle"),
          hint: t("payment.normal.addHint"),
          canAdvance: rowsValid,
          content: (
            <NormalChequesStep
              rows={rows}
              onUpdateRow={updateRow}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onRowCapture={handleRowCapture}
              onRowRemovePhoto={handleRowRemovePhoto}
            />
          ),
        },
        reviewStep,
      ];
    }

    return [methodStep];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    t,
    method,
    chequeType,
    currency,
    exchangeRate,
    amount,
    notes,
    bankName,
    bankNumber,
    branchNumber,
    accountNumber,
    holderName,
    rows,
    generatedFromSeries,
    seriesStart,
    seriesNumberDelta,
    seriesCount,
    seriesDateDelta,
    seriesDate,
    seriesAmountAll,
    cashValid,
    sharedValid,
    seriesConfigValid,
    rowsValid,
    customer.balance,
  ]);

  function handleClose() {
    for (const r of rows) {
      if (r.imagePreviewUrl) URL.revokeObjectURL(r.imagePreviewUrl);
    }
    if (done) onDone();
    else onBack();
  }

  return (
    <StepWizard
      open
      onClose={handleClose}
      done={done}
      submitting={submitting}
      onComplete={handleSubmit}
      steps={steps}
      dir={isRTL ? "rtl" : "ltr"}
      width={440}
      successMessage={t("payment.collect.successTitle")}
      successHint={t("payment.collect.successHint")}
      labels={{
        next: t("actions.next"),
        back: t("actions.back"),
        complete: t("actions.confirm"),
        submitting: t("payment.collect.submitting"),
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
