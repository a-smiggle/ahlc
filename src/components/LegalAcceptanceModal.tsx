import { useState } from "react";

type LegalAcceptanceModalProps = {
  onAccept: () => void;
};

export const LegalAcceptanceModal = ({ onAccept }: LegalAcceptanceModalProps) => {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="legal-accept-title">
      <div className="w-full max-w-xl rounded-lg border border-token-ink/20 bg-token-panel p-6 shadow-xl">
        <h2 id="legal-accept-title" className="text-xl font-bold">
          Before You Continue
        </h2>
        <p className="mt-4 text-sm">
          <span className="font-semibold">Privacy:</span> All calculations happen locally in your browser. No data is transmitted, stored, or tracked.
        </p>
        <p className="mt-2 text-sm">
          <span className="font-semibold">Disclaimer:</span> This calculator provides general information only and does not constitute financial advice.
        </p>

        <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          <span>I understand and accept the privacy notice and disclaimer.</span>
        </label>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!confirmed}
            onClick={onAccept}
            className="rounded bg-token-income px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept and Continue
          </button>
        </div>
      </div>
    </div>
  );
};