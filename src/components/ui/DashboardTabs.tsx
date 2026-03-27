type DashboardTab = "personal" | "lending" | "loan" | "charts";

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "personal", label: "Personal Details" },
  { id: "lending", label: "Lending Power" },
  { id: "loan", label: "Loan Details" },
  { id: "charts", label: "Charts" }
];

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export const DashboardTabs = ({ activeTab, onChange }: DashboardTabsProps) => {
  return (
    <div className="px-1 md:px-2">
      <div className="overflow-hidden rounded-md border-2 border-token-income/45 bg-token-income/5 shadow-sm">
        <div className="grid grid-cols-4 items-center">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`h-10 w-full border-r border-token-income/40 px-3 text-center text-sm font-semibold transition-colors duration-200 last:border-r-0 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-token-income/50 ${
                  isActive
                    ? "z-20 bg-token-income text-white hover:bg-token-income/90"
                    : "z-10 bg-token-panel text-token-ink hover:bg-token-income/20 hover:text-token-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export type { DashboardTab };