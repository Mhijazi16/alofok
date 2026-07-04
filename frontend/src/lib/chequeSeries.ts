import { addMonths, format } from "date-fns";

/**
 * Increment the trailing run of digits in a cheque number by `delta`
 * (default 1), preserving any non-digit prefix AND the zero-pad width. On carry
 * that needs an extra digit (e.g. "9" → "10", "099" → "100"), the width grows
 * by one as expected.
 *
 * Examples:
 *   "XXXX05" → "XXXX06"
 *   "1009"   → "1010"
 *   "099"    → "100"
 *   "AB0099" → "AB0100"
 *   "9"      → "10"
 *   "ABC"    → "ABC"   (no trailing digits — returned unchanged)
 *   "05" (delta 2) → "07"
 */
export function nextChequeNumber(current: string, delta = 1): string {
  const match = current.match(/^(.*?)(\d+)$/);
  if (!match) return current;

  const [, prefix, digits] = match;
  const width = digits.length;
  const incremented = (BigInt(digits) + BigInt(delta)).toString();
  // Preserve zero-pad width; if the number grew past it (carry), keep the wider value.
  const padded = incremented.padStart(width, "0");
  return prefix + padded;
}

export interface SeriesOptions {
  startNumber: string;
  count: number;
  amount: number;
  /** YYYY-MM-DD */
  startDate: string;
  /** DATE delta (months) between consecutive due dates. */
  intervalMonths: number;
  /** NUMBER delta between consecutive cheque numbers; default 1. */
  numberDelta?: number;
}

export interface SeriesCheque {
  check_number: string;
  /** YYYY-MM-DD */
  due_date: string;
  amount: number;
}

/** Clamp bounds for the generated series length. */
export const MIN_SERIES = 1;
export const MAX_SERIES = 60;

/**
 * Generate a series of cheques. Cheque i (0-based) gets:
 *   - check_number = startNumber incremented i times (padding/prefix preserved)
 *   - due_date     = startDate + i * intervalMonths (via date-fns addMonths)
 *   - amount       = amount (shared)
 *
 * `count` is clamped to [MIN_SERIES, MAX_SERIES].
 */
export function generateSeries(opts: SeriesOptions): SeriesCheque[] {
  const { startNumber, amount, startDate, intervalMonths, numberDelta = 1 } = opts;
  const count = Math.max(MIN_SERIES, Math.min(MAX_SERIES, Math.floor(opts.count) || 0));

  const base = new Date(startDate + "T00:00:00");
  const result: SeriesCheque[] = [];
  let checkNumber = startNumber;

  for (let i = 0; i < count; i++) {
    const due = addMonths(base, i * intervalMonths);
    result.push({
      check_number: checkNumber,
      due_date: format(due, "yyyy-MM-dd"),
      amount,
    });
    checkNumber = nextChequeNumber(checkNumber, numberDelta);
  }

  return result;
}
