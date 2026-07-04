import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Hash, User } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Separator } from "@/components/ui/separator";
import { BankAutocomplete } from "@/components/ui/bank-autocomplete";
import { cn } from "@/lib/utils";
import type { Currency, CurrencyOption } from "../types";

interface ChequeSharedDetailsStepProps {
  currency: Currency;
  exchangeRate: string;
  currencies: CurrencyOption[];
  bankName: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  holderName: string;
  userId: string;
  onCurrencyChange: (c: Currency) => void;
  onExchangeRateChange: (v: string) => void;
  onBankNameChange: (v: string) => void;
  onBankNumberChange: (v: string) => void;
  onBranchNumberChange: (v: string) => void;
  onAccountNumberChange: (v: string) => void;
  onHolderNameChange: (v: string) => void;
}

export function ChequeSharedDetailsStep({
  currency,
  exchangeRate,
  currencies,
  bankName,
  bankNumber,
  branchNumber,
  accountNumber,
  holderName,
  userId,
  onCurrencyChange,
  onExchangeRateChange,
  onBankNameChange,
  onBankNumberChange,
  onBranchNumberChange,
  onAccountNumberChange,
  onHolderNameChange,
}: ChequeSharedDetailsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-foreground">{t("payment.currency")}</label>
        <div className="grid grid-cols-3 gap-2">
          {currencies.map((c) => (
            <Card
              key={c.value}
              variant="interactive"
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-3 transition-all",
                currency === c.value && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
              onClick={() => onCurrencyChange(c.value)}
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
            onChange={(e) => onExchangeRateChange(e.target.value)}
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
          onChange={onBankNameChange}
          userId={userId}
          placeholder={t("payment.bank")}
        />
      </FormField>

      <FormField label={t("payment.bankNumber")} required>
        <Input
          value={bankNumber}
          onChange={(e) => onBankNumberChange(e.target.value)}
          placeholder={t("payment.bankNumber")}
          inputMode="numeric"
          dir="ltr"
          startIcon={<Hash className="h-4 w-4" />}
        />
      </FormField>

      <FormField label={t("payment.branchNumber")} required>
        <Input
          value={branchNumber}
          onChange={(e) => onBranchNumberChange(e.target.value)}
          placeholder={t("payment.branchNumber")}
          inputMode="numeric"
          dir="ltr"
          startIcon={<Hash className="h-4 w-4" />}
        />
      </FormField>

      <FormField label={t("payment.accountNumber")} required>
        <Input
          value={accountNumber}
          onChange={(e) => onAccountNumberChange(e.target.value)}
          placeholder={t("payment.accountNumber")}
          inputMode="numeric"
          dir="ltr"
          startIcon={<Hash className="h-4 w-4" />}
        />
      </FormField>

      <FormField label={t("payment.holderName")}>
        <Input
          value={holderName}
          onChange={(e) => onHolderNameChange(e.target.value)}
          placeholder={t("payment.holderName")}
          startIcon={<User className="h-4 w-4" />}
        />
      </FormField>
    </div>
  );
}
