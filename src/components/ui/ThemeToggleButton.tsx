import { Moon, Sun } from "lucide-react";

interface ThemeToggleButtonProps {
  isDark: boolean;
  onToggle: () => void;
}

export const ThemeToggleButton = ({ isDark, onToggle }: ThemeToggleButtonProps) => {
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      onClick={onToggle}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-token-ink/20 bg-token-panel hover:bg-token-mist"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden="true" strokeWidth={2} /> : <Moon className="h-5 w-5" aria-hidden="true" strokeWidth={2} />}
    </button>
  );
};
