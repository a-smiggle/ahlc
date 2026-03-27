import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-8">
      <div className="panel fade-in space-y-6 p-6 md:p-8">
        <h1 className="text-3xl font-bold">How This Works</h1>
        <p>
          This calculator models borrowing power and household cashflow using configurable Australian assumptions. The calculation
          engine is pure TypeScript and deterministic: the same inputs always produce the same outputs.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Methodology</h2>
          <p>
            Income is assessed from PAYG, contractor, casual, and self-employed streams with optional shading for bonus and overtime.
            Net income can be entered directly and converted to gross equivalent for serviceability calculations.
          </p>
          <p>
            Tax is estimated with resident tax brackets and a basic Medicare levy. HECS/HELP obligations are assessed using threshold
            tables and deducted from disposable income.
          </p>
          <p>
            Property assets include value, debt, rental income, vacancy assumptions, and asset-specific costs. Equity is available up to
            configured LVR limits. Household expenses are category-based, then compared against a HEM-style floor and expense loading.
          </p>
          <p>
            Borrowing power is derived from serviceability surplus under an assessment rate buffer and cross-checked with equity-based
            constraints.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Privacy and Data</h2>
          <p>
            All calculations happen locally in your browser. No data is transmitted, stored, or tracked.
          </p>
          <p>
            State is saved only to localStorage on your device unless you clear it. You can export or import your full scenario set as
            JSON at any time.
          </p>
        </section>

        <section className="space-y-2 rounded-md border border-token-risk/20 bg-token-risk/5 p-4">
          <h2 className="text-xl font-semibold text-token-risk">Disclaimer</h2>
          <p>
            This calculator provides general information only and does not constitute financial advice.
          </p>
        </section>

        <Link href="/" className="inline-block rounded-md bg-token-scenario px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Back to Calculator
        </Link>
      </div>
    </main>
  );
}
