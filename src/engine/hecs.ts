import { assumptions } from "@/config/assumptions";

export const hecsRepaymentRate = (taxableIncome: number): number => {
  let rate = 0;

  for (const bracket of assumptions.hecsBrackets) {
    if (taxableIncome >= bracket.threshold) {
      rate = bracket.rate;
    }
  }

  return rate;
};

export const hecsRepaymentAnnual = (taxableIncome: number, hasDebt: boolean): number => {
  if (!hasDebt || taxableIncome <= 0) {
    return 0;
  }

  return taxableIncome * hecsRepaymentRate(taxableIncome);
};
