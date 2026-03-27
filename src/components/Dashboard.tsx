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
import { calculateAllScenarios, calculateScenario } from "@/engine/scenario";
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
import { LegalAcceptanceModal } from "@/components/LegalAcceptanceModal";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { ItemCardHeader } from "@/components/ui/ItemCardHeader";
import { MenuToggleButton } from "@/components/ui/MenuToggleButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { currency, percent } from "@/utils/format";
import {
  clearAllBankProfileOverrides,
  mergeBankProfilesWithOverrides
} from "@/utils/bankProfiles";
import {
  applyLiveRatesToProfiles,
  clearLiveRatesCache,
  isLiveRatesCacheStale,
  readLiveRatesCache,
  refreshLiveRates
} from "@/utils/liveRates";
import { clearState, exportStateJson, importStateJson, loadState, saveState } from "@/utils/storage";
import type { DashboardTab } from "@/components/ui/DashboardTabs";

const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const THEME_STORAGE_KEY = "ahlc-theme";
const LEGAL_ACCEPTED_STORAGE_KEY = "ahlc-legal-accepted";
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

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  return target.isContentEditable;
};

const normalizeScenario = (
  scenario: ScenarioOverrides,
  nominalRate: number,
  profiles: typeof assumptions.bankProfiles
): ScenarioOverrides => {
  const profile = scenario.bankProfileId ? profiles.find((candidate) => candidate.id === scenario.bankProfileId) : undefined;

  return {
    ...scenario,
    assessmentBuffer: scenario.assessmentBuffer ?? profile?.assessmentBuffer ?? 0.03,
    rentalShading: scenario.rentalShading ?? profile?.rentalShading ?? assumptions.defaultRentalShading,
    variableIncomeShading:
      scenario.variableIncomeShading ?? scenario.incomeShading ?? profile?.variableIncomeShading ?? assumptions.defaultVariableIncomeShading,
    expenseLoading: scenario.expenseLoading ?? profile?.expenseLoading ?? assumptions.defaultExpenseLoading,
    indicativeVariableRate: scenario.indicativeVariableRate ?? profile?.indicativeVariableRate ?? nominalRate,
    keepAssets: scenario.keepAssets ?? true
  };
};

const normalizeScenarios = (
  scenarios: ScenarioOverrides[],
  nominalRate: number,
  profiles: typeof assumptions.bankProfiles
): ScenarioOverrides[] => scenarios.map((scenario) => normalizeScenario(scenario, nominalRate, profiles));

export const Dashboard = () => {
  const [state, setState] = useState<AppState>(defaultState);
  const [expenseCadence, setExpenseCadence] = useState<ExpenseCadence>("yearly");
  const [importError, setImportError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("personal");
  const [bankProfilesRevision, setBankProfilesRevision] = useState(0);
  const [liveRatesStatus, setLiveRatesStatus] = useState<"idle" | "fetching" | "done">("idle");
  const [providerToAdd, setProviderToAdd] = useState<string>("");
  const [isEditingField, setIsEditingField] = useState(false);
  const [hasUnsavedState, setHasUnsavedState] = useState(false);
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
      setState({
        ...restored,
        scenarios: normalizeScenarios(
          restored.scenarios,
          restored.loanSettings?.nominalRate ?? defaultState.loanSettings.nominalRate,
          assumptions.bankProfiles
        )
      });
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(storedTheme ? storedTheme === "dark" : prefersDark);

    const accepted = window.localStorage.getItem(LEGAL_ACCEPTED_STORAGE_KEY) === "true";
    setHasAcceptedLegal(accepted);

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setHasUnsavedState(true);
  }, [state, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !hasUnsavedState || isEditingField) {
      return;
    }

    saveState(state);
    setHasUnsavedState(false);
  }, [state, isHydrated, hasUnsavedState, isEditingField]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const onPageHide = () => {
      if (hasUnsavedState) {
        saveState(state);
      }
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [state, hasUnsavedState, isHydrated]);

  useEffect(() => {
    if (!isHydrated || isEditingField) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark, isHydrated, isEditingField]);

  useEffect(() => {
    if (!isHydrated || !hasAcceptedLegal || isEditingField) {
      return;
    }

    window.localStorage.setItem(LEGAL_ACCEPTED_STORAGE_KEY, "true");
  }, [hasAcceptedLegal, isHydrated, isEditingField]);

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

  // Refresh live CDR rates in the background on first load or when cache is > 1 day old.
  useEffect(() => {
    const cache = readLiveRatesCache();
    if (!isLiveRatesCacheStale(cache)) return;
    setLiveRatesStatus("fetching");
    refreshLiveRates()
      .then(() => {
        setLiveRatesStatus("done");
        setBankProfilesRevision((prev) => prev + 1);
      })
      .catch(() => {
        setLiveRatesStatus("done");
      });
  }, []);

  const bankProfiles = useMemo(
    () => {
      void bankProfilesRevision;
      const withLive = applyLiveRatesToProfiles(assumptions.bankProfiles);
      return mergeBankProfilesWithOverrides(withLive);
    },
    [bankProfilesRevision]
  );

  const output = useMemo(() => calculateAllScenarios(state, bankProfiles), [state, bankProfiles]);
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
  const highestBorrowingPower = borrowingComparison.length > 0 ? Math.max(...borrowingComparison.map((d) => d.borrowingPower || 0)) : 0;
  const desiredLoanExceedsCapacity = state.loanSettings.desiredLoanAmount > highestBorrowingPower;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (highestBorrowingPower <= 0) {
      return;
    }

    // Only apply the default when the user has not provided a desired amount yet.
    if (state.loanSettings.desiredLoanAmount > 0) {
      return;
    }

    setState((prev) => ({
      ...prev,
      loanSettings: {
        ...prev.loanSettings,
        desiredLoanAmount: highestBorrowingPower
      }
    }));
  }, [highestBorrowingPower, isHydrated, state.loanSettings.desiredLoanAmount]);

  const getScenarioBaseline = (profileId?: string) => {
    const profile = profileId ? bankProfiles.find((candidate) => candidate.id === profileId) : undefined;

    return {
      assessmentBuffer: profile?.assessmentBuffer ?? state.loanSettings.assessmentRateBuffer,
      rentalShading: profile?.rentalShading ?? assumptions.defaultRentalShading,
      variableIncomeShading: profile?.variableIncomeShading ?? assumptions.defaultVariableIncomeShading,
      expenseLoading: profile?.expenseLoading ?? assumptions.defaultExpenseLoading,
      indicativeVariableRate: profile?.indicativeVariableRate ?? state.loanSettings.nominalRate,
      keepAssets: true
    };
  };

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

  const handleBankProfileChange = (index: number, bankProfileId?: string) => {
    const baseline = getScenarioBaseline(bankProfileId);

    setState((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((scenario, i) =>
        i === index
          ? {
              ...scenario,
              bankProfileId,
              assessmentBuffer: baseline.assessmentBuffer,
              rentalShading: baseline.rentalShading,
              variableIncomeShading: baseline.variableIncomeShading,
              expenseLoading: baseline.expenseLoading,
              indicativeVariableRate: baseline.indicativeVariableRate,
              keepAssets: scenario.keepAssets ?? true
            }
          : scenario
      )
    }));
  };

  const buildScenarioFromProfile = (profile: (typeof bankProfiles)[number]): ScenarioOverrides => ({
    label: profile.label,
    bankProfileId: profile.id,
    assessmentBuffer: profile.assessmentBuffer,
    rentalShading: profile.rentalShading,
    variableIncomeShading: profile.variableIncomeShading,
    expenseLoading: profile.expenseLoading,
    indicativeVariableRate: profile.indicativeVariableRate ?? state.loanSettings.nominalRate,
    keepAssets: true
  });

  const generateTopProviders = () => {
    const ranked = bankProfiles
      .map((profile) => {
        const scenario = buildScenarioFromProfile(profile);
        const result = calculateScenario(state, scenario, bankProfiles);

        return {
          scenario,
          borrowingPower: result.borrowingPower,
          variableRate: scenario.indicativeVariableRate
        };
      })
      .sort((a, b) => {
        if (b.borrowingPower !== a.borrowingPower) {
          return b.borrowingPower - a.borrowingPower;
        }

        return a.variableRate - b.variableRate;
      })
      .slice(0, 3)
      .map((entry, index) => ({
        ...entry.scenario,
        label: `${entry.scenario.label} (${index + 1})`
      }));

    setState((prev) => ({
      ...prev,
      scenarios: ranked
    }));
  };

  const addProviderScenario = () => {
    const profile = bankProfiles.find((candidate) => candidate.id === providerToAdd);

    if (!profile) {
      return;
    }

    setState((prev) => ({
      ...prev,
      scenarios: [...prev.scenarios, { ...buildScenarioFromProfile(profile), label: profile.label }]
    }));
    setProviderToAdd("");
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
        setState({
          ...parsed,
          scenarios: normalizeScenarios(
            parsed.scenarios,
            parsed.loanSettings?.nominalRate ?? defaultState.loanSettings.nominalRate,
            assumptions.bankProfiles
          )
        });
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
  const isPersonalTab = activeTab === "personal";
  const isLendingTab = activeTab === "lending";
  const isLoanTab = activeTab === "loan";
  const isChartsTab = activeTab === "charts";

  return (
    <div
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"
      onFocusCapture={(event) => {
        if (isEditableElement(event.target)) {
          setIsEditingField(true);
        }
      }}
      onBlurCapture={() => {
        const active = document.activeElement;
        setIsEditingField(isEditableElement(active));
      }}
    >
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
                onResetBankProfiles={() => {
                  clearAllBankProfileOverrides();
                  clearLiveRatesCache();
                  setBankProfilesRevision((prev) => prev + 1);
                }}
                onReset={() => {
                  clearState();
                  setState(defaultState);
                }}
              />
            ) : null}
          </div>
        </div>
        {importError ? <p className="mt-2 text-sm text-token-risk">{importError}</p> : null}
        {liveRatesStatus === "fetching" ? (
          <p className="mt-2 text-xs text-token-ink/50">Refreshing live rate data&hellip;</p>
        ) : null}
      </section>

      <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

      {isPersonalTab ? (
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
                <label className="space-y-1 text-sm" title="Name this income stream so you can identify it later.">
                  <span className="block text-xs font-semibold text-token-ink/75">Income Label</span>
                  <input
                    value={income.label}
                    onChange={(event) => handleIncomeChange(index, { label: event.target.value })}
                    className="rounded border p-2"
                    aria-label="Income label"
                    title="Income stream label"
                  />
                </label>
                <label className="space-y-1 text-sm" title="Select employment type: PAYG = salaried wages, Contractor = contract income, Casual = variable shifts, Self-employed = business income.">
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
                <label className="space-y-1 text-sm" title="Choose income input mode: Gross = before tax, Net = after tax take-home.">
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
                <label className="flex items-center gap-2 text-sm" title="Enable if this income earner has HECS/HELP debt.">
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
                <label className="space-y-1 text-sm" title="Enter annual base salary before bonuses or overtime.">
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
                <label className="space-y-1 text-sm" title="Enter expected annual bonus income.">
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
                <label className="space-y-1 text-sm" title="Enter expected annual overtime income.">
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
      ) : null}

      {isPersonalTab || isLendingTab || isLoanTab ? (
      <section className="xl:hidden">
        <AdSlot />
      </section>
      ) : null}

      {isLendingTab ? (
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
              <label className="space-y-1 text-sm" title="Name this asset for easier tracking.">
                <span className="block text-xs font-semibold text-token-ink/75">Asset Name</span>
                <input
                  className="rounded border p-2"
                  value={asset.label}
                  onChange={(event) => handleAssetChange(index, { label: event.target.value })}
                  aria-label="Asset label"
                  title="Asset name"
                />
              </label>
              <label className="space-y-1 text-sm" title="Select asset type: PPOR = primary home, Investment = income-producing property, Future purchase = planned property not yet owned.">
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
              <label className="space-y-1 text-sm" title="Enter the current estimated market value of this asset.">
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
              <label className="space-y-1 text-sm" title="Enter the remaining loan balance secured against this asset.">
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
              <label className="space-y-1 text-sm" title="Enter expected annual gross rental income for this asset.">
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
              <label className="space-y-1 text-sm" title="Percentage of rental income recognised for servicing.">
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
              <label className="space-y-1 text-sm" title="Expected vacancy proportion for this property.">
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
              <label className="space-y-1 text-sm" title="Maximum LVR used to estimate usable equity.">
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
              <label className="space-y-1 text-sm" title="Annual council rates for this property.">
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
              <label className="space-y-1 text-sm" title="Annual water rates for this property.">
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
              <label className="space-y-1 text-sm" title="Annual insurance cost for this property.">
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
              <label className="space-y-1 text-sm" title="Annual maintenance allowance for this property.">
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
              <label className="space-y-1 text-sm" title="Annual property management fee amount.">
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
              <label className="space-y-1 text-sm" title="Annual vacancy allowance amount.">
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
              <label className="space-y-1 text-sm" title="Annual body corporate fees.">
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
      ) : null}

      <section className="space-y-6">
        {isPersonalTab ? (
        <div className="panel space-y-4 p-4 md:p-6">
          <SectionHeader
            title={<h2 className="text-2xl font-bold text-token-expenses">Household Expenses</h2>}
            action={
              <label className="space-y-1 text-sm" title="Choose expense frequency: Weekly = amount per week, Monthly = amount per month, Yearly = annual amount.">
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
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} groceries spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Groceries</span>
              <input type="number" value={fromAnnualExpense(state.expenses.groceriesAnnual)} onChange={(event) => handleExpenseChange("groceriesAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Groceries" title={`${expensePeriodLabel} groceries expense`} />
            </label>
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} utilities spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Utilities</span>
              <input type="number" value={fromAnnualExpense(state.expenses.utilitiesAnnual)} onChange={(event) => handleExpenseChange("utilitiesAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Utilities" title={`${expensePeriodLabel} utilities expense`} />
            </label>
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} transport spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Transport</span>
              <input type="number" value={fromAnnualExpense(state.expenses.transportAnnual)} onChange={(event) => handleExpenseChange("transportAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Transport" title={`${expensePeriodLabel} transport expense`} />
            </label>
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} insurance spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Insurance</span>
              <input type="number" value={fromAnnualExpense(state.expenses.insuranceAnnual)} onChange={(event) => handleExpenseChange("insuranceAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Insurance" title={`${expensePeriodLabel} insurance expense`} />
            </label>
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} childcare and education spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Childcare & Education</span>
              <input type="number" value={fromAnnualExpense(state.expenses.childcareEducationAnnual)} onChange={(event) => handleExpenseChange("childcareEducationAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Childcare and education" title={`${expensePeriodLabel} childcare and education expense`} />
            </label>
            <label className="space-y-1 text-sm" title={`${expensePeriodLabel} discretionary spend.`}>
              <span className="block text-xs font-semibold text-token-ink/75">Discretionary</span>
              <input type="number" value={fromAnnualExpense(state.expenses.discretionaryAnnual)} onChange={(event) => handleExpenseChange("discretionaryAnnual", Number(event.target.value) || 0)} className="rounded border p-2" aria-label="Discretionary" title={`${expensePeriodLabel} discretionary expense`} />
            </label>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-token-expenses">Custom Expenses</h3>
            {state.expenses.custom.length === 0 ? <p className="text-sm text-token-ink/70">No custom expenses yet.</p> : null}
            {state.expenses.custom.length > 0 ? (
              <div className="overflow-x-auto rounded border border-token-ink/15">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-token-mist/70">
                    <tr>
                      <th className="border-b border-token-ink/15 px-3 py-2 text-left text-xs font-semibold text-token-ink/70">Name</th>
                      <th className="border-b border-token-ink/15 px-3 py-2 text-left text-xs font-semibold text-token-ink/70">Amount ({expensePeriodLabel})</th>
                      <th className="border-b border-token-ink/15 px-3 py-2 text-center text-xs font-semibold text-token-ink/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.expenses.custom.map((item, index) => (
                      <tr key={item.id} className="border-b border-token-ink/10 last:border-b-0">
                        <td className="px-3 py-2" title="Name this custom expense item.">
                          <input
                            className="w-full rounded border p-2"
                            value={item.label}
                            onChange={(event) => handleCustomExpenseChange(index, { label: event.target.value })}
                            title="Custom expense name"
                          />
                        </td>
                        <td className="px-3 py-2" title={`Enter the custom expense amount per ${expensePeriodLabel.toLowerCase()}.`}>
                          <input
                            className="w-full rounded border p-2"
                            type="number"
                            value={fromAnnualExpense(item.annual)}
                            onChange={(event) => handleCustomExpenseChange(index, { annual: Number(event.target.value) || 0 })}
                            title={`Custom ${expensePeriodLabel.toLowerCase()} expense amount`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
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
        ) : null}

        {isLoanTab || isLendingTab ? (
        <div className="panel space-y-4 p-4 md:p-6">
          <h2 className="text-2xl font-bold text-token-risk">{isLoanTab ? "Loan Details" : "Lending"}</h2>
          {isLoanTab ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm" title="Select repayment type: Principal & Interest = repay balance and interest, Interest Only = pay interest only during IO period.">
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
            <label className="space-y-1 text-sm" title="Enter the loan term in years.">
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
            <label className="space-y-1 text-sm" title="Enter your target loan amount to compare against provider borrowing power.">
              <span className="block text-xs font-semibold text-token-ink/75">Desired Loan Amount</span>
              <input
                className="rounded border p-2"
                type="number"
                value={state.loanSettings.desiredLoanAmount}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    loanSettings: { ...prev.loanSettings, desiredLoanAmount: Number(event.target.value) || 0 }
                  }))
                }
                title="Desired loan amount"
              />
              {state.loanSettings.desiredLoanAmount > 0 ? (
                <p className={`text-xs font-semibold ${desiredLoanExceedsCapacity ? "text-token-risk" : "text-token-income"}`}>
                  {desiredLoanExceedsCapacity
                    ? `Desired loan exceeds highest borrowing power (${currency(highestBorrowingPower)}).`
                    : `Desired loan is within highest borrowing power (${currency(highestBorrowingPower)}).`}
                </p>
              ) : null}
            </label>
            <label className="space-y-1 text-sm" title="Enter the nominal annual interest rate.">
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
            <label className="space-y-1 text-sm" title="Minimum assessment rate used by lenders.">
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
            <label className="space-y-1 text-sm" title="Offset account balance applied to interest calculations.">
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
            <label className="space-y-1 text-sm" title="Additional monthly repayment amount.">
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
          ) : null}
          {isLendingTab ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton className="bg-token-scenario" onClick={generateTopProviders}>
                Generate Top 3 Providers
              </PrimaryButton>
              <select
                className="min-w-0 flex-1 rounded border p-2 md:max-w-sm"
                value={providerToAdd}
                onChange={(event) => setProviderToAdd(event.target.value)}
                title="Select provider to add"
              >
                <option value="">Select provider to add</option>
                {bankProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded border border-token-ink/20 px-3 py-2 text-xs font-semibold hover:bg-token-mist disabled:cursor-not-allowed disabled:opacity-50"
                onClick={addProviderScenario}
                disabled={!providerToAdd}
              >
                Add Provider
              </button>
            </div>
            {state.scenarios.length === 0 ? (
              <p className="text-sm text-token-ink/70">
                Enter your inputs, then click Generate Top 3 Providers.
              </p>
            ) : null}
            {state.scenarios.map((scenario, index) => (
              <div key={index} className="grid gap-2 rounded border border-token-ink/15 p-3 md:grid-cols-3">
                <ItemCardHeader
                  className="md:col-span-3"
                  label={<span className="text-xs font-semibold text-token-ink/60">Provider {index + 1}</span>}
                  action={
                    <DeleteIconButton
                      label="Remove provider"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          scenarios: prev.scenarios.filter((_, i) => i !== index)
                        }))
                      }
                    />
                  }
                />
                <label className="space-y-1 text-sm" title="Name this provider row.">
                  <span className="block text-xs font-semibold text-token-ink/75">Provider Name</span>
                  <input
                    className="rounded border p-2"
                    value={scenario.label}
                    onChange={(event) => handleScenarioChange(index, { label: event.target.value })}
                    title="Provider label"
                  />
                </label>
                <div className="space-y-1 text-sm" title="Choose a bank profile preset to apply that lender's servicing assumptions, or select No bank preset to use your custom scenario settings.">
                  <span className="block text-xs font-semibold text-token-ink/75">Bank Profile Preset</span>
                  <div className="flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded border p-2"
                      value={scenario.bankProfileId ?? ""}
                      onChange={(event) => handleBankProfileChange(index, event.target.value || undefined)}
                      title="Bank profile preset"
                    >
                      <option value="">No bank preset</option>
                      {bankProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="shrink-0 rounded border border-token-ink/20 px-3 py-2 text-xs font-semibold hover:bg-token-mist disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleBankProfileChange(index, scenario.bankProfileId)}
                      disabled={!scenario.bankProfileId}
                      title="Reset scenario values to selected bank defaults"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {(() => {
                  const selectedBank = scenario.bankProfileId
                    ? bankProfiles.find((candidate) => candidate.id === scenario.bankProfileId)
                    : undefined;
                  const baseline = getScenarioBaseline(scenario.bankProfileId);
                  const isModifiedFromBank =
                    !!selectedBank &&
                    (scenario.assessmentBuffer !== baseline.assessmentBuffer ||
                      scenario.rentalShading !== baseline.rentalShading ||
                      scenario.variableIncomeShading !== baseline.variableIncomeShading ||
                      scenario.expenseLoading !== baseline.expenseLoading ||
                      scenario.indicativeVariableRate !== baseline.indicativeVariableRate);

                  return selectedBank ? (
                    <p className="md:col-span-3 text-xs font-semibold text-token-ink/65">
                      {isModifiedFromBank
                        ? `Using ${selectedBank.label} as a base (modified from default values).`
                        : `Using ${selectedBank.label} default values.`}
                    </p>
                  ) : null;
                })()}
                <label className="flex items-center gap-2 text-sm" title="Keep assets options: enabled = include current assets/equity in this scenario, disabled = ignore existing assets.">
                  <input
                    type="checkbox"
                    checked={scenario.keepAssets ?? true}
                    onChange={(event) => handleScenarioChange(index, { keepAssets: event.target.checked })}
                    title="Keep existing assets in this scenario"
                  />
                  Keep assets
                </label>
                <label className="space-y-1 text-sm" title="Variable income recognition factor for this provider.">
                  <span className="block text-xs font-semibold text-token-ink/75">Variable Income Shading</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.variableIncomeShading}
                    onChange={(event) =>
                      handleScenarioChange(index, { variableIncomeShading: Number(event.target.value) || 0 })
                    }
                    title="Provider variable income shading"
                  />
                </label>
                <label className="space-y-1 text-sm" title="Rental income recognition factor for this provider.">
                  <span className="block text-xs font-semibold text-token-ink/75">Rental Shading Factor</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.rentalShading}
                    onChange={(event) => handleScenarioChange(index, { rentalShading: Number(event.target.value) || 0 })}
                    title="Provider rental shading"
                  />
                </label>
                <label className="space-y-1 text-sm" title="Expense uplift factor for this provider.">
                  <span className="block text-xs font-semibold text-token-ink/75">Expense Loading Factor</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.01"
                    value={scenario.expenseLoading}
                    onChange={(event) => handleScenarioChange(index, { expenseLoading: Number(event.target.value) || 0 })}
                    title="Provider expense loading"
                  />
                </label>
                <label className="space-y-1 text-sm" title="Assessment buffer applied above nominal rate for this provider.">
                  <span className="block text-xs font-semibold text-token-ink/75">Assessment Buffer</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.001"
                    value={scenario.assessmentBuffer}
                    onChange={(event) => handleScenarioChange(index, { assessmentBuffer: Number(event.target.value) || 0 })}
                    title="Provider assessment buffer"
                  />
                </label>
                <label className="space-y-1 text-sm" title="Indicative variable rate used for this provider's repayment assumptions.">
                  <span className="block text-xs font-semibold text-token-ink/75">Indicative Variable Rate</span>
                  <input
                    className="rounded border p-2"
                    type="number"
                    step="0.0001"
                    value={scenario.indicativeVariableRate}
                    onChange={(event) =>
                      handleScenarioChange(index, { indicativeVariableRate: Number(event.target.value) || 0 })
                    }
                    title="Provider indicative variable rate"
                  />
                </label>
              </div>
            ))}
          </div>
          ) : null}
        </div>
        ) : null}
      </section>

      {isLendingTab ? (
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
      ) : null}

      {isChartsTab ? (
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
      ) : null}

      {isChartsTab && primaryScenario ? (
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

      </div>

      <aside className="hidden xl:block no-print">
        <div className="sticky top-6">
          <AdSlot />
        </div>
      </aside>

      {isHydrated && !hasAcceptedLegal ? (
        <LegalAcceptanceModal
          onAccept={() => {
            setHasAcceptedLegal(true);
          }}
        />
      ) : null}
    </div>
  );
};
