import { ToWords } from "to-words";

type Currency = "ILS" | "USD" | "JOD";

const converters: Record<Currency, ToWords> = {
  ILS: new ToWords({
    localeCode: "en-US",
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: true,
      currencyOptions: {
        name: "Israeli Shekel",
        plural: "Israeli Shekels",
        symbol: "₪",
        fractionalUnit: {
          name: "Agora",
          plural: "Agorot",
          symbol: "",
        },
      },
    },
  }),

  USD: new ToWords({
    localeCode: "en-US",
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: true,
      currencyOptions: {
        name: "US Dollar",
        plural: "US Dollars",
        symbol: "$",
        fractionalUnit: {
          name: "Cent",
          plural: "Cents",
          symbol: "",
        },
      },
    },
  }),

  JOD: new ToWords({
    localeCode: "en-US",
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: true,
      currencyOptions: {
        name: "Jordanian Dinar",
        plural: "Jordanian Dinars",
        symbol: "د.أ",
        fractionalUnit: {
          name: "Fils",
          plural: "Fils",
          symbol: "",
        },
      },
    },
  }),
};

/**
 * Converts a numeric amount to English currency words.
 *
 * @param amount - The numeric amount (must be positive and non-zero)
 * @param currency - Currency code: "ILS", "USD", or "JOD"
 * @returns English words representing the amount, or "" for zero/negative/error
 *
 * @example
 * convertAmountToWords(1250.50, "ILS")
 * // => "One Thousand Two Hundred Fifty Israeli Shekels And Fifty Agorot"
 *
 * convertAmountToWords(0, "USD") // => ""
 * convertAmountToWords(-5, "ILS") // => ""
 */
export function convertAmountToWords(
  amount: number,
  currency: Currency
): string {
  if (!amount || amount <= 0) {
    return "";
  }
  try {
    return converters[currency].convert(amount);
  } catch {
    return "";
  }
}
