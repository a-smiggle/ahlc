import { assumptions, findBankProfile } from "@/config/assumptions";
import { annualIncomeTax, grossFromNet } from "@/engine/tax";
import { hecsRepaymentAnnual } from "@/engine/hecs";
import { annualPropertyCosts, monthlyRepayment, principalFromRepayment } from "@/engine/repayments";
import type {
  AppState,
  CalculationOutput,
  CashflowPoint,
  DebtTrajectoryPoint,
  OffsetComparisonPoint,
  ScenarioOverrides,
  ScenarioResult,
  ServiceabilityBreakdown
} from "@/types/models";

const round = (value: number): number => Math.round(value * 100) / 100;

const assessableEmploymentIncome = (state: AppState, incomeShading: number) => {
  return state.incomes.reduce(
    (acc, income) => {
      const grossBase = income.inputMode === "gross" ? income.baseAnnual : grossFromNet(income.baseAnnual);
      const grossVariableRaw = income.bonusAnnual + income.overtimeAnnual;
      const grossVariable = grossVariableRaw * incomeShading;
      const gross = grossBase + grossVariable;
      const tax = annualIncomeTax(gross);
      const hecs = hecsRepaymentAnnual(gross, income.hasHecsHelpDebt);

      return {
        gross: acc.gross + gross,
        tax: acc.tax + tax,
        hecs: acc.hecs + hecs
      };
    },
    { gross: 0, tax: 0, hecs: 0 }
  );
};

const assessableRentalIncome = (state: AppState, rentalShading: number, keepAssets: boolean) => {
  if (!keepAssets) {
    return { income: 0, costs: 0 };
  }

  return state.assets.reduce(
    (acc, asset) => {
      const grossRental = asset.rentalIncomeAnnual;
      const shadedRental = grossRental * (asset.rentalShading || rentalShading);
      const vacancyHit = grossRental * asset.vacancyRate;
      const costs = annualPropertyCosts(asset.costs);

      return {
        income: acc.income + shadedRental - vacancyHit,
        costs: acc.costs + costs
      };
    },
    { income: 0, costs: 0 }
  );
};

const totalHouseholdExpenses = (state: AppState): number => {
  const fixed =
    state.expenses.groceriesAnnual +
    state.expenses.utilitiesAnnual +
    state.expenses.transportAnnual +
    state.expenses.insuranceAnnual +
    state.expenses.childcareEducationAnnual +
    state.expenses.discretionaryAnnual;

  const custom = state.expenses.custom.reduce((sum, item) => sum + item.annual, 0);
  return fixed + custom;
};

const totalAvailableEquity = (state: AppState): number => {
  return state.assets.reduce((sum, asset) => {
    const maxDebt = asset.estimatedValue * asset.maxLvrForEquity;
    return sum + Math.max(0, maxDebt - asset.loanBalance);
  }, 0);
};

const buildDebtTrajectory = (
  borrowAmount: number,
  annualRate: number,
  termYears: number,
  maxLvr: number
): DebtTrajectoryPoint[] => {
  const points: DebtTrajectoryPoint[] = [];
  const estimatedValue = maxLvr > 0 ? borrowAmount / maxLvr : borrowAmount;
  let balance = borrowAmount;

  const mRate = annualRate / 12;
  const repayment = monthlyRepayment(borrowAmount, annualRate, termYears, "pi");

  for (let year = 0; year <= Math.min(termYears, 30); year += 1) {
    if (year > 0) {
      for (let month = 0; month < 12; month += 1) {
        const interest = balance * mRate;
        const principal = Math.max(0, repayment - interest);
        balance = Math.max(0, balance - principal);
      }
    }

    points.push({
      year,
      debtBalance: round(balance),
      lvr: round(estimatedValue > 0 ? balance / estimatedValue : 0)
    });
  }

  return points;
};

const buildOffsetVsExtra = (
  borrowAmount: number,
  annualRate: number,
  termYears: number,
  offsetBalance: number,
  extraMonthly: number
): OffsetComparisonPoint[] => {
  const points: OffsetComparisonPoint[] = [];
  const baseRepayment = monthlyRepayment(borrowAmount, annualRate, termYears, "pi");

  let offsetBalanceLoan = borrowAmount;
  let extraBalanceLoan = borrowAmount;

  for (let year = 0; year <= 10; year += 1) {
    if (year > 0) {
      for (let m = 0; m < 12; m += 1) {
        const iOffset = Math.max(0, (offsetBalanceLoan - offsetBalance) * (annualRate / 12));
        const pOffset = Math.max(0, baseRepayment - iOffset);
        offsetBalanceLoan = Math.max(0, offsetBalanceLoan - pOffset);

        const iExtra = extraBalanceLoan * (annualRate / 12);
        const pExtra = Math.max(0, baseRepayment + extraMonthly - iExtra);
        extraBalanceLoan = Math.max(0, extraBalanceLoan - pExtra);
      }
    }

    points.push({
      year,
      withOffset: round(offsetBalanceLoan),
      withExtraRepayment: round(extraBalanceLoan)
    });
  }

  return points;
};

const buildCashflowTrajectory = (
  annualNetIncome: number,
  annualExpenses: number,
  annualDebt: number,
  years = 10
): CashflowPoint[] => {
  return Array.from({ length: years + 1 }, (_, year) => ({
    year,
    income: round(annualNetIncome),
    expenses: round(annualExpenses),
    debt: round(annualDebt),
    net: round(annualNetIncome - annualExpenses - annualDebt)
  }));
};

export const calculateScenario = (state: AppState, scenario: ScenarioOverrides): ScenarioResult => {
  const profile = findBankProfile(scenario.bankProfileId);
  const incomeShading =
    scenario.incomeShading ?? profile?.variableIncomeShading ?? assumptions.defaultVariableIncomeShading;
  const rentalShading = scenario.rentalShading ?? profile?.rentalShading ?? assumptions.defaultRentalShading;
  const expenseLoading = scenario.expenseLoading ?? profile?.expenseLoading ?? assumptions.defaultExpenseLoading;
  const keepAssets = scenario.keepAssets ?? true;

  const assessmentBuffer =
    scenario.assessmentBuffer ?? profile?.assessmentBuffer ?? state.loanSettings.assessmentRateBuffer;

  const effectiveAssessmentRate = Math.max(
    state.loanSettings.nominalRate + assessmentBuffer,
    state.loanSettings.assessmentRateFloor
  );

  const employment = assessableEmploymentIncome(state, incomeShading);
  const rentals = assessableRentalIncome(state, rentalShading, keepAssets);
  const totalGrossAssessable = employment.gross + rentals.income;
  const totalTax = employment.tax + employment.hecs;
  const totalNetAssessable = totalGrossAssessable - totalTax;

  const householdExpenses = totalHouseholdExpenses(state);
  const expensesWithFloor = Math.max(householdExpenses, assumptions.hemExpenseFloorAnnual);
  const shadedExpenses = expensesWithFloor * expenseLoading + rentals.costs;

  const existingDebtCommitmentsAnnual = keepAssets
    ? state.assets.reduce((sum, asset) => {
        const monthly = monthlyRepayment(
          asset.loanBalance,
          effectiveAssessmentRate,
          state.loanSettings.termYears,
          state.loanSettings.repaymentType
        );
        return sum + monthly * 12;
      }, 0)
    : 0;

  const surplusAnnual = totalNetAssessable - shadedExpenses - existingDebtCommitmentsAnnual;
  const affordableMonthly = Math.max(0, surplusAnnual / 12);

  const serviceabilityPower = principalFromRepayment(
    affordableMonthly,
    effectiveAssessmentRate,
    state.loanSettings.termYears,
    state.loanSettings.repaymentType
  );

  const availableEquity = totalAvailableEquity(state);
  const equityBasedPower = availableEquity / (1 - assumptions.maxBorrowLvr);
  const borrowingPower = Math.max(0, Math.min(serviceabilityPower, equityBasedPower || serviceabilityPower));

  const debtMonthly = monthlyRepayment(
    borrowingPower,
    state.loanSettings.nominalRate,
    state.loanSettings.termYears,
    state.loanSettings.repaymentType
  );

  const stressThresholdAnnual =
    monthlyRepayment(
      borrowingPower,
      assumptions.defaultStressRate,
      state.loanSettings.termYears,
      state.loanSettings.repaymentType
    ) * 12;

  const breakdown: ServiceabilityBreakdown = {
    assessableIncomeAnnual: round(totalGrossAssessable),
    taxAnnual: round(totalTax),
    netIncomeAnnual: round(totalNetAssessable),
    shadedExpensesAnnual: round(shadedExpenses),
    existingDebtCommitmentsAnnual: round(existingDebtCommitmentsAnnual),
    surplusAnnual: round(surplusAnnual)
  };

  const rateSensitivity = [0.06, 0.075, 0.09].map((rate) => ({
    rate,
    monthlyRepayment: round(
      monthlyRepayment(borrowingPower, rate, state.loanSettings.termYears, state.loanSettings.repaymentType)
    )
  }));

  return {
    scenarioLabel: scenario.label,
    borrowingPower: round(borrowingPower),
    annualNetCashflow: round(totalNetAssessable - shadedExpenses - debtMonthly * 12),
    servicingRatio: round(totalGrossAssessable > 0 ? (debtMonthly * 12) / totalGrossAssessable : 0),
    availableEquity: round(availableEquity),
    stressThresholdAnnual: round(stressThresholdAnnual),
    breakdown,
    rateSensitivity,
    debtTrajectory: buildDebtTrajectory(
      borrowingPower,
      state.loanSettings.nominalRate,
      state.loanSettings.termYears,
      assumptions.maxBorrowLvr
    ),
    cashflowTrajectory: buildCashflowTrajectory(totalNetAssessable, shadedExpenses, debtMonthly * 12),
    offsetVsExtra: buildOffsetVsExtra(
      borrowingPower,
      state.loanSettings.nominalRate,
      state.loanSettings.termYears,
      state.loanSettings.offsetBalance,
      state.loanSettings.extraRepaymentMonthly
    )
  };
};

export const calculateAllScenarios = (state: AppState): CalculationOutput => {
  return {
    scenarioResults: state.scenarios.map((scenario) => calculateScenario(state, scenario)),
    generatedAtIso: new Date().toISOString()
  };
};
