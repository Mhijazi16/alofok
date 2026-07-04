import { describe, it, expect } from "vitest";
import { nextChequeNumber, generateSeries } from "./chequeSeries";

describe("nextChequeNumber", () => {
  it("increments preserving a non-digit prefix and pad width", () => {
    expect(nextChequeNumber("XXXX05")).toBe("XXXX06");
  });

  it("increments a plain number", () => {
    expect(nextChequeNumber("1009")).toBe("1010");
  });

  it("carries and grows width when needed (099 → 100)", () => {
    expect(nextChequeNumber("099")).toBe("100");
  });

  it("carries with a prefix (AB0099 → AB0100)", () => {
    expect(nextChequeNumber("AB0099")).toBe("AB0100");
  });

  it("grows width for a single digit on carry (9 → 10)", () => {
    expect(nextChequeNumber("9")).toBe("10");
  });

  it("returns input unchanged when there are no trailing digits", () => {
    expect(nextChequeNumber("ABC")).toBe("ABC");
  });

  it("handles trailing digits after mixed content", () => {
    expect(nextChequeNumber("A1B0009")).toBe("A1B0010");
  });
});

describe("generateSeries", () => {
  it("generates a 5-cheque monthly series from XXXX05", () => {
    const series = generateSeries({
      startNumber: "XXXX05",
      count: 5,
      amount: 250,
      startDate: "2026-01-15",
      intervalMonths: 1,
    });

    expect(series).toHaveLength(5);
    expect(series.map((c) => c.check_number)).toEqual([
      "XXXX05",
      "XXXX06",
      "XXXX07",
      "XXXX08",
      "XXXX09",
    ]);
    expect(series.map((c) => c.due_date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
    ]);
    // Shared amount on every cheque.
    expect(series.every((c) => c.amount === 250)).toBe(true);
  });

  it("supports interval 0 (all same date)", () => {
    const series = generateSeries({
      startNumber: "100",
      count: 3,
      amount: 10,
      startDate: "2026-06-01",
      intervalMonths: 0,
    });
    expect(series.map((c) => c.due_date)).toEqual([
      "2026-06-01",
      "2026-06-01",
      "2026-06-01",
    ]);
    expect(series.map((c) => c.check_number)).toEqual(["100", "101", "102"]);
  });

  it("clamps count to the allowed maximum", () => {
    const series = generateSeries({
      startNumber: "1",
      count: 999,
      amount: 5,
      startDate: "2026-01-01",
      intervalMonths: 1,
    });
    expect(series).toHaveLength(60);
  });

  it("clamps count to at least 1", () => {
    const series = generateSeries({
      startNumber: "1",
      count: 0,
      amount: 5,
      startDate: "2026-01-01",
      intervalMonths: 1,
    });
    expect(series).toHaveLength(1);
  });
});
