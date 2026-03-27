"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { assumptions } from "@/config/assumptions";
import { calculateAllScenarios } from "@/engine/scenario";
import { defaultState } from "@/state/defaultState";
import type {
  AppState,
  Asset,
  ExpenseItem,
  IncomeStream,
  LoanRepaymentType,
  ScenarioOverrides
} from "@/types/models";
import { ActionMenu } from "@/components/ActionMenu";
import { AdSlot } from "@/components/AdSlot";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { ItemCardHeader } from "@/components/ui/ItemCardHeader";
import { MenuToggleButton } from "@/components/ui/MenuToggleButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { currency, percent } from "@/utils/format";
import { clearState, exportStateJson, importStateJson, loadState, saveState } from "@/utils/storage";

const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const THEME_STORAGE_KEY = "ahlc-theme";
type ExpenseCadence = "weekly" | "monthly" | "yearly";

const cadenceToAnnualFactor: Record<ExpenseCadence, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1
};

const updateNumber = <T extends object>(obj: T, key: keyof T, value: string): T => {
  const parsed = Number(value);
  return {
    ...obj,
    [key]: Number.isFinite(parsed) ? parsed : 0
  };
};

export const Dashboard = () => {
  const [state, setState] = useState<AppState>(defaultState);
  const [expenseCadence, setExpenseCadence] = useState<ExpenseCadence>("yearly");
  const [importError, setImportError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const applyTheme = (dark: boolean) => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = dark ? "dark" : "light";
    setIsDark(dark);
  };

  useEffect(() => {
    const restored = loadState();

    if (restored) {
      setState(restored);
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(storedTheme ? storedTheme === "dark" : prefersDark);

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark, isHydrated]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  const output = useMemo(() => calculateAllScenarios(state), [state]);
  const scenarioResults = output.scenarioResults;
  const primaryScenario = scenarioResults[0];

  const borrowingComparison = scenarioResults.map((result) => ({
    scenario: result.scenarioLabel,
    borrowingPower: result.borrowingPower,
    stress: result.stressThresholdAnnual
  }));

  const rateSensitivityData = primaryScenario
    ? primaryScenario.rateSensitivity.map((point) => {
        const row: Record<string, number | string> = {
          rate: `${(point.rate * 100).toFixed(1)}%`
        };

        for (const result of scenarioResults) {
          const found = result.rateSensitivity.find((r) => r.rate === point.rate);
          row[result.scenarioLabel] = found?.monthlyRepayment ?? 0;
        }

        return row;
      })
    : [];

  const debtOverlayData = primaryScenario
    ? primaryScenario.debtTrajectory.map((point, index) => {
        const row: Record<string, number> = { year: point.year };

        for (const scenario of scenarioResults) {
          row[scenario.scenarioLabel] = scenario.debtTrajectory[index]?.debtBalance ?? 0;
        }

        return row;
      })
    : [];

  const scenarioCashflowData = scenarioResults.map((result) => ({
    scenario: result.scenarioLabel,
    netCashflow: result.annualNetCashflow,
    income: result.breakdown.netIncomeAnnual,
    expenses: result.breakdown.shadedExpensesAnnual,
    debt: result.borrowingPower > 0 ? result.stressThresholdAnnual : 0
  }));

  const minStressMonthly = borrowingComparison.length > 0 ? Math.min(...borrowingComparison.map((d) => d.stress || 0)) / 12 : 0;

  const handleIncomeChange = (index: number, patch: Partial<IncomeStream>) => {
    setState((prev) => ({
      ...prev,
      incomes: prev.incomes.map((income, i) => (i === index ? { ...income, ...patch } : income))
    }));
  };

  const handleAssetChange = (index: number, patch: Partial<Asset>) => {
    setState((prev) => ({
      ...prev,
      assets: prev.assets.map((asset, i) => (i === index ? { ...asset, ...patch } : asset))
    }));
  };

  const handleExpenseChange = (key: keyof AppState["expenses"], value: number) => {
    const annualValue = value * cadenceToAnnualFactor[expenseCadence];

    setState((prev) => ({
      ...prev,
      expenses: {
        ...prev.expenses,
        [key]: Number.isFinite(annualValue) ? annualValue : 0
      }
    }));
  };

  const handleCustomExpenseChange = (index: number, patch: Partial<ExpenseItem>) => {
    const annualPatch =
      patch.annual === undefined
        ? patch
        : {
            ...patch,
            annual: Number.isFinite(patch.annual) ? patch.annual * cadenceToAnnualFactor[expenseCadence] : 0
          };

    setState((prev) => ({
      ...prev,
      expenses: {
        ...prev.expenses,
        custom: prev.expenses.custom.map((item, i) => (i === index ? { ...item, ...annualPatch } : item))
      }
    }));
  };

  const handleScenarioChange = (index: number, patch: Partial<ScenarioOverrides>) => {
    setState((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((scenario, i) => (i === index ? { ...scenario, ...patch } : scenario))
    }));
  };

  const onExport = () => {
    const blob = new Blob([exportStateJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ahlc-state.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = (file?: File) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = importStateJson(String(reader.result));
        setState(parsed);
        setImportError(null);
      } catch {
        setImportError("Import failed. Please provide a valid exported JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const expensePeriodLabel =
    expenseCadence === "weekly" ? "Weekly" : expenseCadence === "monthly" ? "Monthly" : "Annual";
  const fromAnnualExpense = (annual: number) => annual / cadenceToAnnualFactor[expenseCadence];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6 fade-in">
      <section className="panel p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold md:text-2xl">Australian Home Loan Calculator</h1>
          </div>

          <div className="relative no-print flex items-center gap-2" ref={menuRef}>
            <ThemeToggleButton isDark={isDark} onToggle={() => applyTheme(!isDark)} />
            <MenuToggleButton expanded={menuOpen} onToggle={() => setMenuOpen((prev) => !prev)} />

            {menuOpen ? (
              <ActionMenu
                onClose={() => setMenuOpen(false)}
                onExport={onExport}
                onImport={onImport}
                onReset={() => {
                  clearState();
                  setState(defaultState);
                }}
              />
            ) : null}
          </div>
        </div>
        {importError ? <p className="mt-2 text-sm text-token-risk">{importError}</p> : null}
      </section>

      <section className="panel space-y-4 p-4 md:p-6">
          <SectionHeader
            title={<h2 className="text-2xl font-bold text-token-income">Income</h2>}
            action={
              <PrimaryButton
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    incomes: [
                      ...prev.incomes,
                      {
                        id: id(),
                        ownerId: id(),
                        label: "Additional income",
                        employmentType: "payg",
                        inputMode: "gross",
                        baseAnnual: 0,
                        bonusAnnual: 0,
                        overtimeAnnual: 0,
                        hasHecsHelpDebt: false
                      }
                    ]
                  }))
                }
                className="bg-token-income"
              >
                Add income stream
              </PrimaryButton>
            }
          />
          {state.incomes.length === 0 ? <p className="text-sm text-token-ink/70">No income streams yet. Add one to start calculations.</p> : null}
          {state.incomes.map((income, index) => (
            <div key={income.id} className="rounded border border-token-ink/15 p-4">
              <ItemCardHeader
                label={<span className="text-xs font-semibold text-token-ink/60">Income stream {index + 1}</span>}
                action={
                  index > 0 ? (
                    <DeleteIconButton
                      label="Remove income"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          incomes: prev.incomes.filter((_, i) => i !== index)
                        }))
                      }
                    />
                  ) : undefined
                }
              />
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Income Label</span>
                  <input
                    value={income.label}
                    onChange={(event) => handleIncomeChange(index, { label: event.target.value })}
                    className="rounded border p-2"
                    aria-label="Income label"
                    title="Income stream label"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Employment Type</span>
                  <select
                    value={income.employmentType}
                    onChange={(event) => handleIncomeChange(index, { employmentType: event.target.value as IncomeStream["employmentType"] })}
                    className="rounded border p-2"
                    title="Employment type"
                  >
                    <option value="payg">PAYG</option>
                    <option value="contractor">Contractor</option>
                    <option value="casual">Casual</option>
                    <option value="self-employed">Self-employed</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Income Input Mode</span>
                  <select
                    value={income.inputMode}
                    onChange={(event) => handleIncomeChange(index, { inputMode: event.target.value as IncomeStream["inputMode"] })}
                    className="rounded border p-2"
                    title="Income input mode"
                  >
                    <option value="gross">Gross</option>
                    <option value="net">Net</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={income.hasHecsHelpDebt}
                    onChange={(event) => handleIncomeChange(index, { hasHecsHelpDebt: event.target.checked })}
                    title="Has HECS or HELP debt"
                  />
                  HECS/HELP debt
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Base Income (Annual)</span>
                  <input
                    type="number"
                    value={income.baseAnnual}
                    onChange={(event) => handleIncomeChange(index, updateNumber(income, "baseAnnual", event.target.value))}
                    className="rounded border p-2"
                    aria-label="Base annual"
                    title="Base annual income"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Bonus Income (Annual)</span>
                  <input
                    type="number"
                    value={income.bonusAnnual}
                    onChange={(event) => handleIncomeChange(index, updateNumber(income, "bonusAnnual", event.target.value))}
                    className="rounded border p-2"
                    aria-label="Bonus annual"
                    title="Annual bonus income"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Overtime Income (Annual)</span>
                  <input
                    type="number"
                    value={income.overtimeAnnual}
                    onChange={(event) => handleIncomeChange(index, updateNumber(income, "overtimeAnnual", event.target.value))}
                    className="rounded border p-2"
                    aria-label="Overtime annual"
                    title="Annual overtime income"
                  />
                </label>
              </div>
            </div>
          ))}
      </section>

      <section className="xl:hidden">
        <AdSlot />
      </section>

      <section className="panel space-y-4 p-4 md:p-6">
        <SectionHeader
          title={<h2 className="text-2xl font-bold text-token-scenario">Assets, Equity, and Costs</h2>}
          action={
            <PrimaryButton
              className="bg-token-scenario"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  assets: [
                    ...prev.assets,
                    {
                      id: id(),
                      label: "New asset",
                      type: "ppor",
                      estimatedValue: 0,
                      loanBalance: 0,
                      maxLvrForEquity: 0.8,
                      rentalIncomeAnnual: 0,
                      rentalShading: assumptions.defaultRentalShading,
                      vacancyRate: 0,
                      costs: {
                        councilRatesAnnual: 0,
                        waterRatesAnnual: 0,
                        insuranceAnnual: 0,
                        maintenanceAnnual: 0,
                        managementFeesAnnual: 0,
                        vacancyAllowanceAnnual: 0,
                        bodyCorporateAnnual: 0
                      }
                    }
                  ]
                }))
              }
            >
              Add asset
            </PrimaryButton>
          }
        />
        {state.assets.length === 0 ? <p className="text-sm text-token-ink/70">No assets yet. Add an asset to include equity and property costs.</p> : null}
        {state.assets.map((asset, index) => (
          <div key={asset.id} className="rounded border border-token-ink/15 p-4">
            <ItemCardHeader
              label={<span className="text-xs font-semibold text-token-ink/60">Asset {index + 1}</span>}
              action={
                <DeleteIconButton
                  label="Remove asset"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      assets: prev.assets.filter((_, i) => i !== index)
                    }))
                  }
                />
              }
            />
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Asset Name</span>
                <input
                  className="rounded border p-2"
                  value={asset.label}
                  onChange={(event) => handleAssetChange(index, { label: event.target.value })}
                  aria-label="Asset label"
                  title="Asset name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Asset Type</span>
                <select
                  className="rounded border p-2"
                  value={asset.type}
                  onChange={(event) => handleAssetChange(index, { type: event.target.value as Asset["type"] })}
                  title="Asset type"
                >
                  <option value="ppor">PPOR</option>
                  <option value="investment">Investment</option>
                  <option value="future">Future purchase</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Estimated Value</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.estimatedValue}
                  onChange={(event) => handleAssetChange(index, { estimatedValue: Number(event.target.value) || 0 })}
                  aria-label="Estimated value"
                  title="Estimated property value"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Loan Balance</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.loanBalance}
                  onChange={(event) => handleAssetChange(index, { loanBalance: Number(event.target.value) || 0 })}
                  aria-label="Loan balance"
                  title="Current loan balance"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Rental Income (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.rentalIncomeAnnual}
                  onChange={(event) => handleAssetChange(index, { rentalIncomeAnnual: Number(event.target.value) || 0 })}
                  aria-label="Rental income annual"
                  title="Annual rental income"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Rental Shading Factor</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  step="0.01"
                  value={asset.rentalShading}
                  onChange={(event) => handleAssetChange(index, { rentalShading: Number(event.target.value) || 0 })}
                  aria-label="Rental shading"
                  title="Rental income shading factor"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Vacancy Rate</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  step="0.01"
                  value={asset.vacancyRate}
                  onChange={(event) => handleAssetChange(index, { vacancyRate: Number(event.target.value) || 0 })}
                  aria-label="Vacancy rate"
                  title="Vacancy rate"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Maximum LVR for Equity</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  step="0.01"
                  value={asset.maxLvrForEquity}
                  onChange={(event) => handleAssetChange(index, { maxLvrForEquity: Number(event.target.value) || 0.8 })}
                  aria-label="Max LVR for equity"
                  title="Maximum LVR for accessible equity"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Council Rates (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.councilRatesAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, councilRatesAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Council rates"
                  title="Annual council rates"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Water Rates (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.waterRatesAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, waterRatesAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Water rates"
                  title="Annual water rates"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Insurance (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.insuranceAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, insuranceAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Insurance"
                  title="Annual insurance cost"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Maintenance Allowance (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.maintenanceAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, maintenanceAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Maintenance"
                  title="Annual maintenance allowance"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Management Fees (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.managementFeesAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, managementFeesAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Management fees"
                  title="Annual property management fees"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Vacancy Allowance (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.vacancyAllowanceAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, vacancyAllowanceAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Vacancy allowance"
                  title="Annual vacancy allowance"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Body Corporate (Annual)</span>
                <input
                  className="rounded border p-2"
                  type="number"
                  value={asset.costs.bodyCorporateAnnual}
                  onChange={(event) =>
                    handleAssetChange(index, {
                      costs: { ...asset.costs, bodyCorporateAnnual: Number(event.target.value) || 0 }
                    })
                  }
                  aria-label="Body corporate"
                  title="Annual body corporate fees"
                />
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <div className="panel space-y-4 p-4 md:p-6">
          <SectionHeader
            title={<h2 className="text-2xl font-bold text-token-expenses">Household Expenses</h2>}
            action={
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold text-token-ink/75">Expense frequency</span>
                <select
                  className="rounded border p-2"
                  value={expenseCadence}
                  onChange={(event) => setExpenseCadence(event.target.value as ExpenseCadence)}
                  title="Household expense frequency"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Groceries</span>
              <input type="number" value={fromAnnualExpense(state.expenses.groceriesAnnual)} onChange={(event) => handleExpenseChange("groceriesAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Groceries" title={`${expensePeriodLabel} groceries expense`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Utilities</span>
              <input type="number" value={fromAnnualExpense(state.expenses.utilitiesAnnual)} onChange={(event) => handleExpenseChange("utilitiesAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Utilities" title={`${expensePeriodLabel} utilities expense`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Transport</span>
              <input type="number" value={fromAnnualExpense(state.expenses.transportAnnual)} onChange={(event) => handleExpenseChange("transportAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Transport" title={`${expensePeriodLabel} transport expense`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Insurance</span>
              <input type="number" value={fromAnnualExpense(state.expenses.insuranceAnnual)} onChange={(event) => handleExpenseChange("insuranceAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Insurance" title={`${expensePeriodLabel} insurance expense`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Childcare & Education</span>
              <input type="number" value={fromAnnualExpense(state.expenses.childcareEducationAnnual)} onChange={(event) => handleExpenseChange("childcareEducationAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Childcare and education" title={`${expensePeriodLabel} childcare and education expense`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Discretionary</span>
              <input type="number" value={fromAnnualExpense(state.expenses.discretionaryAnnual)} onChange={(event) => handleExpenseChange("discretionaryAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Discretionary" title={`${expensePeriodLabel} discretionary expense`} />
            </label>
          </div>
          <div className="space-y-2">
            {state.expenses.custom.length === 0 ? <p className="text-sm text-token-ink/70">No custom expenses yet.</p> : null}
            {state.expenses.custom.map((item, index) => (
              <div key={item.id} className="rounded border border-token-ink/15 p-3">
                <ItemCardHeader
                  className="mb-2"
                  label={<span className="text-xs font-semibold text-token-ink/60">Custom expense {index + 1}</span>}
                  action={
                    <DeleteIconButton
                      label="Remove custom expense"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          expenses: {
                            ...prev.expenses,
                            custom: prev.expenses.custom.filter((_, i) => i !== index)
                          }
                        }))
                      }
                    />
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Custom Expense Name</span>
                  <input
                    className="rounded border p-2"
                    value={item.label}
                    onChange={(event) => handleCustomExpenseChange(index, { label: event.target.value })}
                    title="Custom expense name"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Custom Expense Amount ({expensePeriodLabel})</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    value={fromAnnualExpense(item.annual)}
                    onChange={(event) => handleCustomExpenseChange(index, { annual: Number(event.target.value) || 0 })}
                    title={`Custom ${expensePeriodLabel.toLowerCase()} expense amount`}
                  />
                </label>
                </div>
              </div>
            ))}
            <PrimaryButton
              className="bg-token-expenses"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  expenses: {
                    ...prev.expenses,
                    custom: [...prev.expenses.custom, { id: id(), label: "Custom", annual: 0 }]
                  }
                }))
              }
            >
              Add custom expense
            </PrimaryButton>
          </div>
        </div>

        <div className="panel space-y-4 p-4 md:p-6">
          <h2 className="text-2xl font-bold text-token-risk">Loan and Scenario Settings</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Repayment Type</span>
              <select
                className="rounded border p-2"
                value={state.loanSettings.repaymentType}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, repaymentType: event.target.value as LoanRepaymentType }
                  }))
                }
                title="Loan repayment type"
              >
                <option value="pi">Principal & Interest</option>
                <option value="io">Interest Only</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Loan Term (Years)</span>
              <input
                className="rounded border p-2"
                type="number"
                value={state.loanSettings.termYears}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, termYears: Number(event.target.value) || 30 }
                  }))
                }
                title="Loan term in years"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Nominal Interest Rate</span>
              <input
                className="rounded border p-2"
                type="number"
                step="0.001"
                value={state.loanSettings.nominalRate}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, nominalRate: Number(event.target.value) || 0 }
                  }))
                }
                title="Nominal interest rate"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Assessment Rate Floor</span>
              <input
                className="rounded border p-2"
                type="number"
                step="0.001"
                value={state.loanSettings.assessmentRateFloor}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, assessmentRateFloor: Number(event.target.value) || 0 }
                  }))
                }
                title="Assessment rate floor"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Offset Account Balance</span>
              <input
                className="rounded border p-2"
                type="number"
                value={state.loanSettings.offsetBalance}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, offsetBalance: Number(event.target.value) || 0 }
                  }))
                }
                title="Offset account balance"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold text-token-ink/75">Extra Repayment (Monthly)</span>
              <input
                className="rounded border p-2"
                type="number"
                value={state.loanSettings.extraRepaymentMonthly}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, extraRepaymentMonthly: Number(event.target.value) || 0 }
                  }))
                }
                title="Extra monthly repayment"
              />
            </label>
          </div>
          <div className="space-y-2">
            {state.scenarios.length === 0 ? <p className="text-sm text-token-ink/70">No scenarios yet. Add a scenario to compare outcomes.</p> : null}
            {state.scenarios.map((scenario, index) => (
              <div key={scenario.label + index} className="grid gap-2 rounded border border-token-ink/15 p-3 md:grid-cols-3">
                <ItemCardHeader
                  className="md:col-span-3"
                  label={<span className="text-xs font-semibold text-token-ink/60">Scenario {index + 1}</span>}
                  action={
                    <DeleteIconButton
                      label="Remove scenario"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          scenarios: prev.scenarios.filter((_, i) => i !== index)
                        }))
                      }
                    />
                  }
                />
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Scenario Name</span>
                  <input
                    className="rounded border p-2"
                    value={scenario.label}
                    onChange={(event) => handleScenarioChange(index, { label: event.target.value })}
                    title="Scenario label"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Bank Profile Preset</span>
                  <select
                    className="rounded border p-2"
                    value={scenario.bankProfileId ?? ""}
                    onChange={(event) => handleScenarioChange(index, { bankProfileId: event.target.value || undefined })}
                    title="Bank profile preset"
                  >
                    <option value="">No bank preset</option>
                    {assumptions.bankProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scenario.keepAssets ?? true}
                    onChange={(event) => handleScenarioChange(index, { keepAssets: event.target.checked })}
                    title="Keep existing assets in this scenario"
                  />
                  Keep assets
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Income Shading Factor</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.incomeShading ?? assumptions.defaultVariableIncomeShading}
                    onChange={(event) => handleScenarioChange(index, { incomeShading: Number(event.target.value) || 0 })}
                    title="Scenario income shading"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Rental Shading Factor</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.rentalShading ?? assumptions.defaultRentalShading}
                    onChange={(event) => handleScenarioChange(index, { rentalShading: Number(event.target.value) || 0 })}
                    title="Scenario rental shading"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold text-token-ink/75">Expense Loading Factor</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.expenseLoading ?? assumptions.defaultExpenseLoading}
                    onChange={(event) => handleScenarioChange(index, { expenseLoading: Number(event.target.value) || 0 })}
                    title="Scenario expense loading"
                  />
                </label>
              </div>
            ))}
            <PrimaryButton
              className="bg-token-scenario"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  scenarios: [
                    ...prev.scenarios,
                    {
                      label: `Scenario ${prev.scenarios.length + 1}`,
                      assessmentBuffer: 0.03,
                      incomeShading: assumptions.defaultVariableIncomeShading,
                      rentalShading: assumptions.defaultRentalShading,
                      expenseLoading: assumptions.defaultExpenseLoading,
                      keepAssets: true
                    }
                  ]
                }))
              }
            >
              Add scenario
            </PrimaryButton>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {scenarioResults.map((result) => (
          <article key={result.scenarioLabel} className="panel p-4">
            <h3 className="text-lg font-semibold">{result.scenarioLabel}</h3>
            <p className="mt-1 text-sm text-token-ink/70">Borrowing Power</p>
            <p className="text-2xl font-bold">{currency(result.borrowingPower)}</p>
            <p className="mt-3 text-sm text-token-ink/70">Annual Net Cashflow</p>
            <p className="text-lg font-semibold">{currency(result.annualNetCashflow)}</p>
            <p className="mt-3 text-sm text-token-ink/70">Servicing Ratio</p>
            <p className="text-lg font-semibold">{percent(result.servicingRatio)}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel h-[320px] p-4 md:p-6">
          <h3 className="mb-3 text-lg font-semibold">Borrowing Power Comparison</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={borrowingComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scenario" />
              <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <ReferenceLine y={minStressMonthly} stroke="#b4003f" label="stress" />
              <Bar dataKey="borrowingPower" fill="#005f7f" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel h-[320px] p-4 md:p-6">
          <h3 className="mb-3 text-lg font-semibold">Net Cashflow Across Scenarios</h3>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={scenarioCashflowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scenario" />
              <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Legend />
              <Area type="monotone" dataKey="income" stackId="1" stroke="#14734b" fill="#14734b99" />
              <Area type="monotone" dataKey="expenses" stackId="2" stroke="#bb4d00" fill="#bb4d0099" />
              <Area type="monotone" dataKey="debt" stackId="3" stroke="#b4003f" fill="#b4003f99" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel h-[320px] p-4 md:p-6">
          <h3 className="mb-3 text-lg font-semibold">Debt Trajectory by Scenario</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={debtOverlayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Legend />
              {scenarioResults.map((scenario, idx) => (
                <Line
                  key={scenario.scenarioLabel}
                  type="monotone"
                  dataKey={scenario.scenarioLabel}
                  stroke={["#005f7f", "#14734b", "#b4003f", "#bb4d00"][idx % 4]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel h-[320px] p-4 md:p-6">
          <h3 className="mb-3 text-lg font-semibold">Rate Sensitivity (6%, 7.5%, 9%)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={rateSensitivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rate" />
              <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Legend />
              {scenarioResults.map((scenario, idx) => (
                <Line
                  key={scenario.scenarioLabel}
                  type="monotone"
                  dataKey={scenario.scenarioLabel}
                  stroke={["#005f7f", "#14734b", "#b4003f", "#bb4d00"][idx % 4]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {primaryScenario ? (
        <section className="panel h-[360px] p-4 md:p-6">
          <h3 className="mb-3 text-lg font-semibold">Offset Effectiveness vs Extra Repayments</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={primaryScenario.offsetVsExtra}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Legend />
              <Line type="monotone" dataKey="withOffset" name="With offset" stroke="#14734b" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="withExtraRepayment"
                name="With extra repayments"
                stroke="#005f7f"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      <section className="rounded border border-token-risk/25 bg-token-risk/5 p-4 text-sm">
        <p className="font-semibold">Privacy:</p>
        <p>All calculations happen locally in your browser. No data is transmitted, stored, or tracked.</p>
        <p className="mt-2 font-semibold">Disclaimer:</p>
        <p>This calculator provides general information only and does not constitute financial advice.</p>
      </section>

      </div>

      <aside className="hidden xl:block no-print">
        <div className="sticky top-6">
          <AdSlot />
        </div>
      </aside>
    </div>
  );
};
