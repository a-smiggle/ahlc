import type { ScenarioOverrides } from "@/types/models";

export interface TaxBracket {
  threshold: number;
  baseTax: number;
  rate: number;
}

export interface HecsBracket {
  threshold: number;
  rate: number;
}

export interface BankProfile {
  id: string;
  label: string;
  assessmentBuffer: number;
  rentalShading: number;
  variableIncomeShading: number;
  expenseLoading: number;
}

export interface Assumptions {
  medicareLevyRate: number;
  residentTaxBrackets: TaxBracket[];
  hecsBrackets: HecsBracket[];
  hemExpenseFloorAnnual: number;
  defaultExpenseLoading: number;
  defaultVariableIncomeShading: number;
  defaultRentalShading: number;
  maxBorrowLvr: number;
  defaultStressRate: number;
  bankProfiles: BankProfile[];
  defaultScenarios: ScenarioOverrides[];
}

export const assumptions: Assumptions = {
  medicareLevyRate: 0.02,
  residentTaxBrackets: [
    { threshold: 0, baseTax: 0, rate: 0 },
    { threshold: 18200, baseTax: 0, rate: 0.16 },
    { threshold: 45000, baseTax: 4288, rate: 0.3 },
    { threshold: 135000, baseTax: 31288, rate: 0.37 },
    { threshold: 190000, baseTax: 51638, rate: 0.45 }
  ],
  hecsBrackets: [
    { threshold: 54800, rate: 0.01 },
    { threshold: 63090, rate: 0.025 },
    { threshold: 66876, rate: 0.03 },
    { threshold: 70909, rate: 0.035 },
    { threshold: 75244, rate: 0.04 },
    { threshold: 79831, rate: 0.045 },
    { threshold: 84720, rate: 0.05 },
    { threshold: 89934, rate: 0.055 },
    { threshold: 95457, rate: 0.06 },
    { threshold: 101328, rate: 0.065 },
    { threshold: 107676, rate: 0.07 },
    { threshold: 114525, rate: 0.075 },
    { threshold: 121896, rate: 0.08 },
    { threshold: 129838, rate: 0.085 },
    { threshold: 138378, rate: 0.09 },
    { threshold: 147540, rate: 0.095 },
    { threshold: 157372, rate: 0.1 }
  ],
  hemExpenseFloorAnnual: 42000,
  defaultExpenseLoading: 1.1,
  defaultVariableIncomeShading: 0.8,
  defaultRentalShading: 0.75,
  maxBorrowLvr: 0.8,
  defaultStressRate: 0.075,
  bankProfiles: [
    {
      id: "major-bank-a",
      label: "Major Bank A",
      assessmentBuffer: 0.03,
      rentalShading: 0.75,
      variableIncomeShading: 0.8,
      expenseLoading: 1.1
    },
    {
      id: "major-bank-b",
      label: "Major Bank B",
      assessmentBuffer: 0.025,
      rentalShading: 0.8,
      variableIncomeShading: 0.75,
      expenseLoading: 1.12
    },
    {
      id: "credit-union",
      label: "Credit Union",
      assessmentBuffer: 0.03,
      rentalShading: 0.7,
      variableIncomeShading: 0.8,
      expenseLoading: 1.08
    }
  ],
  defaultScenarios: [
    { label: "Conservative", assessmentBuffer: 0.03, expenseLoading: 1.12, rentalShading: 0.7 },
    { label: "Base", assessmentBuffer: 0.03, expenseLoading: 1.1, rentalShading: 0.75 },
    { label: "Aggressive", assessmentBuffer: 0.025, expenseLoading: 1.05, rentalShading: 0.8 }
  ]
};

export const findBankProfile = (id?: string) => {
  if (!id) {
    return undefined;
  }

  return assumptions.bankProfiles.find((profile) => profile.id === id);
};
