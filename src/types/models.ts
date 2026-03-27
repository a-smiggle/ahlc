export type IncomeInputMode = "gross" | "net";
export type EmploymentType = "payg" | "contractor" | "casual" | "self-employed";
export type LoanRepaymentType = "pi" | "io";

export interface IncomeStream {
  id: string;
  ownerId: string;
  label: string;
  employmentType: EmploymentType;
  inputMode: IncomeInputMode;
  baseAnnual: number;
  bonusAnnual: number;
  overtimeAnnual: number;
  hasHecsHelpDebt: boolean;
}

export type AssetType = "ppor" | "investment" | "future";

export interface PropertyCosts {
  councilRatesAnnual: number;
  waterRatesAnnual: number;
  insuranceAnnual: number;
  maintenanceAnnual: number;
  managementFeesAnnual: number;
  vacancyAllowanceAnnual: number;
  bodyCorporateAnnual: number;
}

export interface Asset {
  id: string;
  label: string;
  type: AssetType;
  estimatedValue: number;
  loanBalance: number;
  maxLvrForEquity: number;
  rentalIncomeAnnual: number;
  rentalShading: number;
  vacancyRate: number;
  costs: PropertyCosts;
}

export interface ExpenseItem {
  id: string;
  label: string;
  annual: number;
}

export interface HouseholdExpenses {
  groceriesAnnual: number;
  utilitiesAnnual: number;
  transportAnnual: number;
  insuranceAnnual: number;
  childcareEducationAnnual: number;
  discretionaryAnnual: number;
  custom: ExpenseItem[];
}

export interface LoanSettings {
  repaymentType: LoanRepaymentType;
  termYears: number;
  desiredLoanAmount: number;
  nominalRate: number;
  assessmentRateBuffer: number;
  assessmentRateFloor: number;
  offsetBalance: number;
  extraRepaymentMonthly: number;
}

export interface ScenarioOverrides {
  label: string;
  variableIncomeShading: number;
  rentalShading: number;
  expenseLoading: number;
  assessmentBuffer: number;
  indicativeVariableRate: number;
  // Legacy field kept for imported old states; replaced by variableIncomeShading.
  incomeShading?: number;
  keepAssets?: boolean;
  bankProfileId?: string;
}

export interface AppState {
  incomes: IncomeStream[];
  assets: Asset[];
  expenses: HouseholdExpenses;
  loanSettings: LoanSettings;
  scenarios: ScenarioOverrides[];
}

export interface ServiceabilityBreakdown {
  assessableIncomeAnnual: number;
  taxAnnual: number;
  netIncomeAnnual: number;
  shadedExpensesAnnual: number;
  existingDebtCommitmentsAnnual: number;
  surplusAnnual: number;
}

export interface RateSensitivityPoint {
  rate: number;
  monthlyRepayment: number;
}

export interface DebtTrajectoryPoint {
  year: number;
  debtBalance: number;
  lvr: number;
}

export interface CashflowPoint {
  year: number;
  income: number;
  expenses: number;
  debt: number;
  net: number;
}

export interface OffsetComparisonPoint {
  year: number;
  withOffset: number;
  withExtraRepayment: number;
}

export interface ScenarioResult {
  scenarioLabel: string;
  borrowingPower: number;
  annualNetCashflow: number;
  servicingRatio: number;
  availableEquity: number;
  stressThresholdAnnual: number;
  breakdown: ServiceabilityBreakdown;
  rateSensitivity: RateSensitivityPoint[];
  debtTrajectory: DebtTrajectoryPoint[];
  cashflowTrajectory: CashflowPoint[];
  offsetVsExtra: OffsetComparisonPoint[];
}

export interface CalculationOutput {
  scenarioResults: ScenarioResult[];
  generatedAtIso: string;
}
