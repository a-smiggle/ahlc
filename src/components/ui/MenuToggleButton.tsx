import { MoreVertical } from "lucide-react";

interface MenuToggleButtonProps {
  expanded: boolean;
  onToggle: () => void;
}

export const MenuToggleButton = ({ expanded, onToggle }: MenuToggleButtonProps) => {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-token-ink/20 bg-token-panel text-lg font-bold hover:bg-token-mist"
      title="Actions"
    >
      <MoreVertical className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
    </button>
  );
};
