import { describe, expect, it } from "vitest";
import { monthlyRepayment, principalFromRepayment } from "@/engine/repayments";

describe("repayments", () => {
  it("calculates PI monthly repayment", () => {
    const payment = monthlyRepayment(600000, 0.06, 30, "pi");
    expect(payment).toBeGreaterThan(3500);
    expect(payment).toBeLessThan(3700);
  });

  it("inverts repayment to principal", () => {
    const monthly = monthlyRepayment(450000, 0.065, 30, "pi");
    const principal = principalFromRepayment(monthly, 0.065, 30, "pi");
    expect(Math.round(principal)).toBeCloseTo(450000, -2);
  });

  it("supports interest-only logic", () => {
    const io = monthlyRepayment(500000, 0.06, 30, "io");
    expect(Math.round(io)).toBe(2500);
  });
});
