import { newClientId } from "@/lib/offlineDB";

export type CollectMethod = "cash" | "cheque";
export type ChequeType = "series" | "normal";

export type Currency = "ILS" | "USD" | "JOD";

export const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  ILS: 1,
  USD: 3.65,
  JOD: 5.15,
};

export interface CurrencyOption {
  value: Currency;
  label: string;
  symbol: string;
}

/** Bank/account identity of a cheque — the fields that are normally shared. */
export interface ChequeBankDetails {
  bank: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  holderName: string;
}

export const EMPTY_BANK_DETAILS: ChequeBankDetails = {
  bank: "",
  bankNumber: "",
  branchNumber: "",
  accountNumber: "",
  holderName: "",
};

/** Same gate the shared step uses: bank/branch/account numbers are required. */
export function bankDetailsValid(d: ChequeBankDetails): boolean {
  return (
    d.bankNumber.trim().length > 0 &&
    d.branchNumber.trim().length > 0 &&
    d.accountNumber.trim().length > 0
  );
}

export interface ChequeRow {
  id: string;
  checkNumber: string;
  dueDate: string;
  amount: string;
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;
  /**
   * Per-cheque bank/account details. `null` (the default) means this cheque
   * uses the shared details from the shared step. Non-null when the customer
   * handed over cheques drawn on different banks/accounts in one visit.
   */
  override: ChequeBankDetails | null;
}

/**
 * A fresh blank cheque row. `id` comes from `newClientId()` and is the STABLE
 * idempotency key for this cheque — never regenerate it when editing the row.
 */
export function blankRow(): ChequeRow {
  return {
    id: newClientId(),
    checkNumber: "",
    dueDate: "",
    amount: "",
    imageBlob: null,
    imagePreviewUrl: null,
    override: null,
  };
}
