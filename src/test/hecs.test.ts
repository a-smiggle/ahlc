import { describe, expect, it } from "vitest";
import { hecsRepaymentAnnual, hecsRepaymentRate } from "@/engine/hecs";

describe("hecs", () => {
  it("returns zero below threshold", () => {
    expect(hecsRepaymentRate(50000)).toBe(0);
    expect(hecsRepaymentAnnual(50000, true)).toBe(0);
  });

  it("applies bracket rates", () => {
    const rate = hecsRepaymentRate(90000);
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThanOrEqual(0.06);
  });

  it("returns zero when no debt", () => {
    expect(hecsRepaymentAnnual(120000, false)).toBe(0);
  });
});
