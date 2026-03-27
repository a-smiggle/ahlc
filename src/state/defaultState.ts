import { assumptions } from "@/config/assumptions";
import type { AppState } from "@/types/models";

export const defaultState: AppState = {
  incomes: [
    {
      id: "income-1",
      ownerId: "member-1",
      label: "Primary income",
      employmentType: "payg",
      inputMode: "gross",
      baseAnnual: 120000,
      bonusAnnual: 10000,
      overtimeAnnual: 5000,
      hasHecsHelpDebt: false
    }
  ],
  assets: [],
  expenses: {
    groceriesAnnual: 15000,
    utilitiesAnnual: 5000,
    transportAnnual: 9000,
    insuranceAnnual: 4000,
    childcareEducationAnnual: 6000,
    discretionaryAnnual: 10000,
    custom: []
  },
  loanSettings: {
    repaymentType: "pi",
    termYears: 30,
    desiredLoanAmount: 0,
    nominalRate: 0.062,
    assessmentRateBuffer: 0.03,
    assessmentRateFloor: 0.075,
    offsetBalance: 25000,
    extraRepaymentMonthly: 400
  },
  scenarios: assumptions.defaultScenarios
};
