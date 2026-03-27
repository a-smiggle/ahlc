import { assumptions } from "@/config/assumptions";

export const annualIncomeTax = (taxableIncome: number): number => {
  if (taxableIncome <= 0) {
    return 0;
  }

  const brackets = assumptions.residentTaxBrackets;
  let active = brackets[0];

  for (const bracket of brackets) {
    if (taxableIncome >= bracket.threshold) {
      active = bracket;
    }
  }

  const marginalPart = (taxableIncome - active.threshold) * active.rate;
  const baseTax = active.baseTax;
  const medicare = taxableIncome * assumptions.medicareLevyRate;
  return Math.max(0, baseTax + marginalPart + medicare);
};

export const netFromGross = (grossAnnual: number): number => {
  return Math.max(0, grossAnnual - annualIncomeTax(grossAnnual));
};

export const grossFromNet = (targetNetAnnual: number): number => {
  let low = 0;
  let high = 1_000_000;

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const net = netFromGross(mid);

    if (net < targetNetAnnual) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
};
