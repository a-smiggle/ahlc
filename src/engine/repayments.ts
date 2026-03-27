import type { LoanRepaymentType } from "@/types/models";

export const monthlyRepayment = (
  principal: number,
  annualRate: number,
  termYears: number,
  repaymentType: LoanRepaymentType
): number => {
  if (principal <= 0) {
    return 0;
  }

  const r = annualRate / 12;
  const n = termYears * 12;

  if (repaymentType === "io") {
    return principal * r;
  }

  if (r === 0) {
    return principal / n;
  }

  const factor = Math.pow(1 + r, n);
  return principal * ((r * factor) / (factor - 1));
};

export const principalFromRepayment = (
  monthlyAmount: number,
  annualRate: number,
  termYears: number,
  repaymentType: LoanRepaymentType
): number => {
  if (monthlyAmount <= 0) {
    return 0;
  }

  const r = annualRate / 12;
  const n = termYears * 12;

  if (repaymentType === "io") {
    return r > 0 ? monthlyAmount / r : 0;
  }

  if (r === 0) {
    return monthlyAmount * n;
  }

  const factor = Math.pow(1 + r, n);
  return monthlyAmount * ((factor - 1) / (r * factor));
};

export const annualPropertyCosts = (costs: {
  councilRatesAnnual: number;
  waterRatesAnnual: number;
  insuranceAnnual: number;
  maintenanceAnnual: number;
  managementFeesAnnual: number;
  vacancyAllowanceAnnual: number;
  bodyCorporateAnnual: number;
}): number => {
  return (
    costs.councilRatesAnnual +
    costs.waterRatesAnnual +
    costs.insuranceAnnual +
    costs.maintenanceAnnual +
    costs.managementFeesAnnual +
    costs.vacancyAllowanceAnnual +
    costs.bodyCorporateAnnual
  );
};
