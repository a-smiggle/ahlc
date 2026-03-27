import type { ScenarioOverrides } from "@/types/models";
import referenceData from "@/data/reference-data.latest.json";

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
  indicativeVariableRate?: number;
  notes?: string;
}

export interface Assumptions {
  referenceDataVersion: string;
  referenceDataUpdatedAtIso: string;
  bankProfilesNote?: string;
  bankProfilesAsOfDate?: string;
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
  referenceDataVersion: referenceData.metadata?.datasetVersion ?? "unknown",
  referenceDataUpdatedAtIso: referenceData.metadata?.updatedAtIso ?? "",
  bankProfilesNote: (referenceData as Record<string, unknown>).bankProfilesNote as string | undefined,
  bankProfilesAsOfDate: (referenceData as Record<string, unknown>).bankProfilesAsOfDate as string | undefined,
  medicareLevyRate: referenceData.medicareLevyRate,
  residentTaxBrackets: referenceData.residentTaxBrackets,
  hecsBrackets: referenceData.hecsBrackets,
  hemExpenseFloorAnnual: referenceData.hemExpenseFloorAnnual,
  defaultExpenseLoading: referenceData.defaultExpenseLoading,
  defaultVariableIncomeShading: referenceData.defaultVariableIncomeShading,
  defaultRentalShading: referenceData.defaultRentalShading,
  maxBorrowLvr: referenceData.maxBorrowLvr,
  defaultStressRate: referenceData.defaultStressRate,
  bankProfiles: referenceData.bankProfiles,
  defaultScenarios: [
    {
      label: "Conservative",
      assessmentBuffer: 0.03,
      rentalShading: 0.7,
      variableIncomeShading: 0.8,
      expenseLoading: 1.12,
      indicativeVariableRate: 0.062,
      keepAssets: true
    },
    {
      label: "Base",
      assessmentBuffer: 0.03,
      rentalShading: 0.75,
      variableIncomeShading: 0.8,
      expenseLoading: 1.1,
      indicativeVariableRate: 0.062,
      keepAssets: true
    },
    {
      label: "Aggressive",
      assessmentBuffer: 0.025,
      rentalShading: 0.8,
      variableIncomeShading: 0.8,
      expenseLoading: 1.05,
      indicativeVariableRate: 0.062,
      keepAssets: true
    }
  ]
};

export const findBankProfile = (id?: string) => {
  if (!id) {
    return undefined;
  }

  return assumptions.bankProfiles.find((profile) => profile.id === id);
};
