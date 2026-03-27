import Link from "next/link";

interface ActionMenuProps {
  onClose: () => void;
  onHelpClick?: () => void;
  onExport: () => void;
  onImport: (file?: File) => void;
  onResetBankProfiles: () => void;
  onReset: () => void;
}

export const ActionMenu = ({ onClose, onHelpClick, onExport, onImport, onResetBankProfiles, onReset }: ActionMenuProps) => {
  return (
    <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-token-ink/15 bg-token-panel p-2 shadow-lg" role="menu">
      <Link
        href="/how-it-works"
        role="menuitem"
        onClick={() => {
          onHelpClick?.();
          onClose();
        }}
        className="block rounded px-3 py-2 text-sm font-medium hover:bg-token-mist"
      >
        Help (How To)
      </Link>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExport();
          onClose();
        }}
        className="block w-full rounded px-3 py-2 text-left text-sm font-medium hover:bg-token-mist"
      >
        Save (Export JSON)
      </button>

      <label className="block cursor-pointer rounded px-3 py-2 text-sm font-medium hover:bg-token-mist" role="menuitem">
        Import JSON
        <input
          type="file"
          accept="application/json"
          className="hidden"
          title="Import calculator state JSON file"
          onChange={(event) => {
            onImport(event.target.files?.[0]);
            onClose();
          }}
        />
      </label>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onResetBankProfiles();
          onClose();
        }}
        className="block w-full rounded px-3 py-2 text-left text-sm font-medium hover:bg-token-mist"
      >
        Reset Bank Profiles to Latest
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onReset();
          onClose();
        }}
        className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-token-risk hover:bg-token-risk/10"
      >
        Clear & Reset
      </button>
    </div>
  );
};
