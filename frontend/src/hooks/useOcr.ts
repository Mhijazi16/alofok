import { useRef, useState, useEffect } from "react";
import { createWorker } from "tesseract.js";
import type { Worker, Page, Word } from "tesseract.js";

// ─── Exported types ───────────────────────────────────────────────────────────

export type OcrConfidenceLevel = "high" | "medium" | "low";

export interface OcrFieldResult {
  value: string;
  confidence: OcrConfidenceLevel;
}

export interface OcrResult {
  bankNumber?: OcrFieldResult;
  branchNumber?: OcrFieldResult;
  accountNumber?: OcrFieldResult;
  amount?: OcrFieldResult;
  holderName?: OcrFieldResult;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Map a 0–100 Tesseract confidence score to our three-tier level. */
function toConfidenceLevel(score: number): OcrConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/** Average of an array of numbers, returns 0 for empty arrays. */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ─── confidenceBorderClass utility ───────────────────────────────────────────

/**
 * Returns a Tailwind ring class for a given confidence level.
 * Intended to be combined with `cn()` on form Input components.
 */
export function confidenceBorderClass(
  confidence: OcrConfidenceLevel | null | undefined
): string {
  if (confidence === "high") return "ring-2 ring-green-500";
  if (confidence === "medium") return "ring-2 ring-yellow-500";
  if (confidence === "low") return "ring-2 ring-red-500";
  return "";
}

// ─── Field extraction ─────────────────────────────────────────────────────────

/**
 * Best-effort extraction of check-relevant fields from a Tesseract Page.
 *
 * Strategy:
 *  - Amount:       decimal number pattern (digits + separator + 2 digits)
 *  - MICR line:    numeric sequences in the bottom third of the image
 *                  First group → branchNumber, second → accountNumber
 *  - Bank number:  short numeric sequence (2–4 digits) not already claimed
 *  - Holder name:  multi-word non-numeric text in the upper third
 */
function extractCheckFields(data: Page): OcrResult {
  const result: OcrResult = {};

  const words: Word[] = data.words ?? [];
  if (words.length === 0) return result;

  // Compute image height from bbox max to support vertical partitioning
  const maxY = words.reduce((m, w) => Math.max(m, w.bbox?.y1 ?? 0), 0);
  const bottomThird = maxY * (2 / 3);
  const topThird = maxY * (1 / 3);

  // Helper: get avg confidence of a set of words
  const wordsAvgConf = (ws: Word[]) =>
    avg(ws.map((w) => w.confidence));

  // ── Amount detection ────────────────────────────────────────────────────────
  const amountRegex = /\b(\d{1,6}[.,]\d{2})\b/g;
  let amountMatch: RegExpExecArray | null;
  const candidateAmounts: { value: string; conf: number }[] = [];

  while ((amountMatch = amountRegex.exec(data.text)) !== null) {
    const raw = amountMatch[1];
    // Find words whose text overlaps with this matched string
    const matchingWords = words.filter((w) =>
      w.text.replace(/[^0-9.,]/g, "").includes(raw.replace(/[^0-9.,]/g, ""))
    );
    candidateAmounts.push({
      value: raw.replace(",", "."),
      conf: wordsAvgConf(matchingWords) || 50,
    });
  }

  if (candidateAmounts.length > 0) {
    // Pick the candidate with the highest confidence
    const best = candidateAmounts.reduce((a, b) =>
      a.conf >= b.conf ? a : b
    );
    result.amount = {
      value: best.value,
      confidence: toConfidenceLevel(best.conf),
    };
  }

  // ── MICR-line numeric groups (bottom third) ─────────────────────────────────
  const bottomWords = words.filter(
    (w) => (w.bbox?.y0 ?? 0) >= bottomThird
  );
  const micrNumericGroups = bottomWords
    .filter((w) => /^\d{2,10}$/.test(w.text.replace(/\s/g, "")))
    .map((w) => ({ text: w.text.replace(/\s/g, ""), conf: w.confidence }));

  // Fall back to full-page numeric groups if MICR region is empty
  const numericGroups =
    micrNumericGroups.length >= 2
      ? micrNumericGroups
      : words
          .filter((w) => /^\d{2,10}$/.test(w.text.replace(/\s/g, "")))
          .map((w) => ({ text: w.text.replace(/\s/g, ""), conf: w.confidence }));

  // Exclude amount value from numeric groups
  const amountDigits = result.amount?.value.replace(/\D/g, "") ?? "";
  const filteredGroups = numericGroups.filter(
    (g) => g.text !== amountDigits
  );

  if (filteredGroups.length >= 1) {
    result.branchNumber = {
      value: filteredGroups[0].text,
      confidence: toConfidenceLevel(filteredGroups[0].conf),
    };
  }
  if (filteredGroups.length >= 2) {
    result.accountNumber = {
      value: filteredGroups[1].text,
      confidence: toConfidenceLevel(filteredGroups[1].conf),
    };
  }

  // ── Bank number (short 2–4 digit code not already used) ────────────────────
  const usedValues = new Set([
    result.branchNumber?.value,
    result.accountNumber?.value,
    amountDigits,
  ]);
  const bankCodeCandidate = words.find(
    (w) =>
      /^\d{2,4}$/.test(w.text.replace(/\s/g, "")) &&
      !usedValues.has(w.text.replace(/\s/g, ""))
  );
  if (bankCodeCandidate) {
    result.bankNumber = {
      value: bankCodeCandidate.text.replace(/\s/g, ""),
      confidence: toConfidenceLevel(bankCodeCandidate.confidence),
    };
  }

  // ── Holder name (multi-word non-numeric text, upper third) ─────────────────
  const upperWords = words.filter(
    (w) => (w.bbox?.y1 ?? maxY) <= topThird
  );
  // Filter out pure-numeric, single-char, and very short words
  const nameWords = upperWords.filter(
    (w) => w.text.length > 1 && /[a-zA-Z\u0600-\u06FF]/.test(w.text)
  );
  if (nameWords.length >= 2) {
    result.holderName = {
      value: nameWords.map((w) => w.text).join(" "),
      confidence: toConfidenceLevel(wordsAvgConf(nameWords)),
    };
  }

  console.debug("[OCR] extracted:", result);
  return result;
}

// ─── useOcr hook ─────────────────────────────────────────────────────────────

export function useOcr() {
  const workerRef = useRef<Worker | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Terminate worker on unmount to free memory / WebAssembly resources
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * Run OCR on a Blob (compressed check image).
   * Lazily creates the Tesseract worker on first call so the WebAssembly module
   * is only loaded when the user actually requests a scan.
   */
  async function scan(imageBlob: Blob): Promise<OcrResult> {
    setIsScanning(true);
    setError(null);
    try {
      if (!workerRef.current) {
        workerRef.current = await createWorker(["eng", "ara"], 1, {
          cacheMethod: "write",
        });
      }
      const { data } = await workerRef.current.recognize(imageBlob);
      return extractCheckFields(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OCR scan failed";
      setError(message);
      return {};
    } finally {
      setIsScanning(false);
    }
  }

  return { scan, isScanning, error };
}
