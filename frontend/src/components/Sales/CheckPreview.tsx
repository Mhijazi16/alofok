import React, { useMemo } from "react";
import { convertAmountToWords } from "@/lib/amountToWords";

interface CheckPreviewProps {
  amount: string;
  currency: "ILS" | "USD" | "JOD";
  bankName: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  holderName: string;
  dueDate: string;
  focusedField?: string | null;
}

const CURRENCY_SYMBOL: Record<"ILS" | "USD" | "JOD", string> = {
  ILS: "₪",
  USD: "$",
  JOD: "د.أ",
};

function formatAmountDisplay(amount: string): string {
  const parsed = parseFloat(amount);
  if (!parsed || parsed <= 0) return "0.00";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildMicrLine(
  bankNumber: string,
  branchNumber: string,
  accountNumber: string
): string {
  const bn = bankNumber.trim() || "--------";
  const br = branchNumber.trim() || "--------";
  const ac = accountNumber.trim() || "--------";
  return `\u2446${bn}\u2446  \u2448${br}\u2449  \u2448${ac}\u2448`;
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

const HIGHLIGHT_FILL = "#dc2626";
const HIGHLIGHT_OPACITY = 0.08;

type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
};

function getHighlightRect(focusedField: string | null | undefined): HighlightRect | null {
  if (!focusedField) return null;
  switch (focusedField) {
    case "bankName":
      return { x: 16, y: 18, width: 320, height: 42, rx: 6 };
    case "holderName":
      return { x: 460, y: 18, width: 224, height: 26, rx: 4 };
    case "dueDate":
      return { x: 460, y: 42, width: 224, height: 24, rx: 4 };
    case "amount":
      return { x: 520, y: 78, width: 160, height: 42, rx: 20 };
    case "bankNumber":
    case "branchNumber":
    case "accountNumber":
      return { x: 0, y: 234, width: 700, height: 86, rx: 0 };
    default:
      return null;
  }
}

function CheckPreviewComponent({
  amount,
  currency,
  bankName,
  bankNumber,
  branchNumber,
  accountNumber,
  holderName,
  dueDate,
  focusedField,
}: CheckPreviewProps) {
  const parsedAmount = parseFloat(amount) || 0;

  const amountInWords = useMemo(
    () => convertAmountToWords(parsedAmount, currency),
    [parsedAmount, currency]
  );

  const amountDisplay = formatAmountDisplay(amount);
  const micrLine = buildMicrLine(bankNumber, branchNumber, accountNumber);
  const currencySymbol = CURRENCY_SYMBOL[currency];
  const highlightRect = getHighlightRect(focusedField);

  const wordsTextProps =
    amountInWords.length > 60
      ? { textLength: 640, lengthAdjust: "spacingAndGlyphs" as const }
      : {};

  return (
    <div dir="ltr" className="w-full">
      <svg
        viewBox="0 0 700 320"
        style={{ width: "100%", aspectRatio: "700/320" }}
        xmlns="http://www.w3.org/2000/svg"
        direction="ltr"
        aria-label="Check preview"
      >
        <defs>
          <linearGradient id="check-side-accent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <clipPath id="check-body-clip">
            <rect width="700" height="320" rx="10" />
          </clipPath>
        </defs>

        {/* White card background */}
        <rect width="700" height="320" rx="10" fill="#fff" stroke="#e5e5e5" strokeWidth="1" />

        {/* Watermark circles */}
        <g clipPath="url(#check-body-clip)">
          <circle cx="140" cy="75" r="55" fill="#dc2626" opacity="0.10" />
          <circle cx="110" cy="110" r="34" fill="#dc2626" opacity="0.12" />
          <circle cx="375" cy="38" r="65" fill="#dc2626" opacity="0.08" />
          <circle cx="560" cy="165" r="78" fill="#dc2626" opacity="0.09" />
          <circle cx="620" cy="125" r="36" fill="#dc2626" opacity="0.11" />
          <circle cx="235" cy="200" r="48" fill="#dc2626" opacity="0.08" />
          <circle cx="468" cy="62" r="26" fill="#dc2626" opacity="0.13" />
          <circle cx="70" cy="210" r="60" fill="#dc2626" opacity="0.07" />
          <circle cx="410" cy="175" r="42" fill="#dc2626" opacity="0.09" />
          <circle cx="655" cy="38" r="45" fill="#dc2626" opacity="0.08" />
          <circle cx="292" cy="125" r="22" fill="#dc2626" opacity="0.14" />
          <circle cx="515" cy="215" r="30" fill="#dc2626" opacity="0.10" />
        </g>

        {/* Left accent bar */}
        <rect x="0" y="5" width="6" height="310" fill="url(#check-side-accent)" />

        {/* Focus highlight */}
        {highlightRect && (
          <rect
            x={highlightRect.x}
            y={highlightRect.y}
            width={highlightRect.width}
            height={highlightRect.height}
            rx={highlightRect.rx ?? 4}
            fill={HIGHLIGHT_FILL}
            fillOpacity={HIGHLIGHT_OPACITY}
          />
        )}

        {/* Bank name — uses foreignObject for proper Arabic rendering */}
        <foreignObject x="24" y="18" width="360" height="36">
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: bankName ? "#111" : "#999",
              letterSpacing: hasArabic(bankName) ? undefined : "0.3px",
              direction: hasArabic(bankName) ? "rtl" as const : "ltr" as const,
              textAlign: "left",
              lineHeight: "36px",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            {bankName
              ? hasArabic(bankName) ? bankName : bankName.toUpperCase()
              : "BANK NAME"}
          </div>
        </foreignObject>

        {/* Branch & account subtitle */}
        <text
          x="32"
          y="58"
          fontSize="11"
          fill={branchNumber || accountNumber ? "#333" : "#999"}
          direction="ltr"
        >
          {branchNumber || accountNumber
            ? `Branch ${branchNumber || "---"} · Account ${accountNumber || "---"}`
            : "Branch --- · Account ---"}
        </text>

        {/* Holder — top right */}
        <text
          x="672"
          y="38"
          fontSize="13"
          fill={holderName ? "#111" : "#999"}
          textAnchor="end"
          direction="ltr"
        >
          {holderName || "Holder Name"}
        </text>

        {/* Date — right, below holder */}
        <text
          x="672"
          y="58"
          fontSize="12"
          fill={dueDate ? "#222" : "#999"}
          textAnchor="end"
          direction="ltr"
        >
          {dueDate || "DD/MM/YYYY"}
        </text>

        {/* Separator */}
        <line x1="32" y1="72" x2="672" y2="72" stroke="#ddd" strokeWidth="1" />

        {/* PAY TO THE ORDER OF */}
        <text
          x="32"
          y="96"
          fontSize="9"
          fill="#888"
          letterSpacing="2"
          direction="ltr"
        >
          PAY TO THE ORDER OF
        </text>
        <line x1="32" y1="104" x2="510" y2="104" stroke="#e5e5e5" strokeWidth="0.75" />

        {/* Amount pill */}
        <rect
          x="526"
          y="80"
          width="154"
          height="38"
          rx="19"
          fill="#fef2f2"
          stroke="#fca5a5"
          strokeWidth="0.75"
        />
        <text
          x="544"
          y="105"
          fontSize="13"
          fill="#dc2626"
          direction="ltr"
        >
          {currencySymbol}
        </text>
        <text
          x="670"
          y="106"
          fontSize="18"
          fontWeight="700"
          fill="#dc2626"
          textAnchor="end"
          direction="ltr"
        >
          {amountDisplay}
        </text>

        {/* Written amount */}
        <text
          x="32"
          y="140"
          fontSize="12"
          fill={amountInWords ? "#333" : "#999"}
          direction="ltr"
          {...wordsTextProps}
        >
          {amountInWords || "Zero"}
        </text>
        <line x1="32" y1="148" x2="672" y2="148" stroke="#ddd" strokeWidth="0.75" />

        {/* Memo */}
        <text
          x="32"
          y="184"
          fontSize="10"
          fill="#888"
          letterSpacing="1"
          direction="ltr"
        >
          MEMO
        </text>
        <line x1="32" y1="192" x2="350" y2="192" stroke="#ddd" strokeWidth="0.75" />

        {/* Signature line */}
        <line x1="440" y1="192" x2="672" y2="192" stroke="#ddd" strokeWidth="0.75" />
        <text
          x="556"
          y="206"
          fontSize="10"
          fill="#888"
          textAnchor="middle"
          direction="ltr"
        >
          SIGNATURE
        </text>

        {/* MICR strip */}
        <rect x="6" y="236" width="686" height="74" fill="#fafafa" />
        <line x1="6" y1="236" x2="692" y2="236" stroke="#eee" strokeWidth="0.5" />
        <text
          x="32"
          y="280"
          fontFamily="MICR, 'Courier New', monospace"
          fontSize="16"
          fill="#111"
          letterSpacing="4"
          direction="ltr"
        >
          {micrLine}
        </text>
      </svg>
    </div>
  );
}

export const CheckPreview = React.memo(CheckPreviewComponent);
