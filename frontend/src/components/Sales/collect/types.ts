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

export interface ChequeRow {
  id: string;
  checkNumber: string;
  dueDate: string;
  amount: string;
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;
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
  };
}
