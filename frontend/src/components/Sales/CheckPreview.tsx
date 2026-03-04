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

// Highlight rect config per focusedField value
const HIGHLIGHT_FILL = "#dc2626";
const HIGHLIGHT_OPACITY = 0.06;

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
      return { x: 14, y: 18, width: 220, height: 28, rx: 4 };
    case "holderName":
      return { x: 366, y: 18, width: 220, height: 28, rx: 4 };
    case "dueDate":
      return { x: 460, y: 50, width: 126, height: 28, rx: 4 };
    case "amount":
      return { x: 462, y: 74, width: 122, height: 36, rx: 4 };
    case "bankNumber":
    case "branchNumber":
    case "accountNumber":
      return { x: 0, y: 218, width: 600, height: 57, rx: 0 };
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

  // Overflow handling: auto-shrink text if words are too long
  const wordsTextProps =
    amountInWords.length > 60
      ? { textLength: 552, lengthAdjust: "spacingAndGlyphs" as const }
      : {};

  return (
    <div dir="ltr" className="w-full">
      <svg
        viewBox="0 0 600 275"
        style={{ width: "100%", aspectRatio: "600/275" }}
        xmlns="http://www.w3.org/2000/svg"
        direction="ltr"
        aria-label="Check preview"
      >
        {/* Paper background */}
        <rect
          width="600"
          height="275"
          rx="8"
          fill="#faf7f2"
          stroke="#d4c9b8"
          strokeWidth="1"
        />
        {/* Inner decorative border */}
        <rect
          x="8"
          y="8"
          width="584"
          height="259"
          rx="4"
          fill="none"
          stroke="#e8dfd4"
          strokeWidth="0.5"
        />

        {/* Focus highlights (rendered before content so text is on top) */}
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

        {/* Bank name zone — top left */}
        <text
          x="24"
          y="36"
          fontSize="14"
          fontWeight="700"
          fill={bankName ? "#1a1a1a" : "#b0a898"}
          direction="ltr"
        >
          {bankName || "Bank Name"}
        </text>

        {/* Holder name zone — top right */}
        <text
          x="576"
          y="36"
          fontSize="12"
          fill={holderName ? "#1a1a1a" : "#b0a898"}
          textAnchor="end"
          direction="ltr"
        >
          {holderName || "Holder Name"}
        </text>

        {/* Date label */}
        <text
          x="520"
          y="56"
          fontSize="8"
          fill="#999"
          letterSpacing="1"
          direction="ltr"
        >
          DATE
        </text>

        {/* Date value */}
        <text
          x="576"
          y="68"
          fontSize="11"
          fill={dueDate ? "#333" : "#b0a898"}
          textAnchor="end"
          direction="ltr"
        >
          {dueDate || "DD/MM/YYYY"}
        </text>

        {/* Line under date */}
        <line
          x1="480"
          y1="72"
          x2="576"
          y2="72"
          stroke="#b0a898"
          strokeWidth="0.5"
        />

        {/* "PAY TO THE ORDER OF" label */}
        <text
          x="24"
          y="90"
          fontSize="8"
          fill="#999"
          letterSpacing="0.5"
          direction="ltr"
        >
          PAY TO THE ORDER OF
        </text>

        {/* Horizontal rule below pay-to label */}
        <line
          x1="24"
          y1="96"
          x2="460"
          y2="96"
          stroke="#b0a898"
          strokeWidth="0.5"
        />

        {/* Amount box */}
        <rect
          x="470"
          y="78"
          width="106"
          height="28"
          rx="3"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1"
        />

        {/* Currency symbol inside amount box */}
        <text
          x="478"
          y="97"
          fontSize="11"
          fill="#666"
          direction="ltr"
        >
          {currencySymbol}
        </text>

        {/* Amount digits */}
        <text
          x="570"
          y="97"
          fontSize="14"
          fontWeight="700"
          fill="#1a1a1a"
          textAnchor="end"
          direction="ltr"
        >
          {amountDisplay}
        </text>

        {/* Written amount (pay line) */}
        <text
          x="24"
          y="130"
          fontSize="10"
          fill={amountInWords ? "#333" : "#b0a898"}
          direction="ltr"
          {...wordsTextProps}
        >
          {amountInWords || "Zero"}
        </text>

        {/* Horizontal rule below written amount */}
        <line
          x1="24"
          y1="136"
          x2="576"
          y2="136"
          stroke="#b0a898"
          strokeWidth="0.5"
        />

        {/* Memo label */}
        <text
          x="24"
          y="170"
          fontSize="8"
          fill="#999"
          letterSpacing="0.5"
          direction="ltr"
        >
          MEMO
        </text>

        {/* Memo line */}
        <line
          x1="24"
          y1="176"
          x2="340"
          y2="176"
          stroke="#b0a898"
          strokeWidth="0.5"
        />

        {/* Signature line */}
        <line
          x1="400"
          y1="176"
          x2="576"
          y2="176"
          stroke="#b0a898"
          strokeWidth="0.5"
        />

        {/* Signature label */}
        <text
          x="488"
          y="188"
          fontSize="8"
          fill="#999"
          direction="ltr"
          textAnchor="middle"
        >
          SIGNATURE
        </text>

        {/* Separator line above MICR */}
        <line
          x1="0"
          y1="220"
          x2="600"
          y2="220"
          stroke="#c0b8a8"
          strokeWidth="0.5"
        />

        {/* MICR strip background */}
        <rect
          x="0"
          y="220"
          width="600"
          height="55"
          fill="#f0ebe2"
        />

        {/* Bottom rounded corners overlay (clips the rect to follow outer rx="8") */}
        <rect
          x="0"
          y="267"
          width="600"
          height="8"
          fill="#faf7f2"
        />
        <rect
          x="0"
          y="220"
          width="8"
          height="55"
          fill="#faf7f2"
        />
        <rect
          x="592"
          y="220"
          width="8"
          height="55"
          fill="#faf7f2"
        />

        {/* MICR strip text */}
        <text
          x="24"
          y="252"
          fontFamily="MICR, 'Courier New', monospace"
          fontSize="14"
          fill="#1a1a1a"
          letterSpacing="3"
          direction="ltr"
        >
          {micrLine}
        </text>
      </svg>
    </div>
  );
}

export const CheckPreview = React.memo(CheckPreviewComponent);
