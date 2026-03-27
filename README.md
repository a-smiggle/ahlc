# Australian Home Loan Borrowing Power Calculator

A privacy-first, fully client-side Australian home loan calculator built with Next.js, TypeScript, Tailwind, and Recharts.

## Principles

- Client-side only: no backend persistence
- No accounts, no tracking, no analytics tied to user inputs
- Deterministic, auditable calculations
- Free to use
- User data remains local to the browser

## Tech Stack

- Next.js App Router
- TypeScript (strict mode)
- Tailwind CSS
- Recharts
- Vitest for unit and snapshot tests

## Features

- Multi-income household modelling with input mode support:
	- gross or net income entry
	- PAYG, contractor, casual, self-employed
	- variable income shading
	- HECS/HELP repayment impact
- Multi-asset modelling:
	- PPOR, investment, future purchase
	- equity availability via configurable LVR
	- rental shading and vacancy assumptions
	- per-asset costs (council, water, insurance, maintenance, management, vacancy allowance, body corporate)
- Granular expense model:
	- groceries, utilities, transport, insurance, childcare/education, discretionary, custom categories
	- HEM-style floor with expense loading
- Loan and scenario engine:
	- P&I or IO repayment modes
	- term, rate, assessment buffers and floors
	- offset and extra repayment comparison
	- side-by-side scenario comparison
	- bank profile presets
- Visual outputs:
	- borrowing power comparison
	- net cashflow charting
	- debt trajectory overlays
	- rate sensitivity charts (6%, 7.5%, 9%)
	- offset effectiveness vs extra repayments
- Local persistence and portability:
	- localStorage restore on refresh
	- export full state to JSON
	- import full state from JSON
	- clear/reset
- Transparency pages:
	- methodology and assumptions summary
	- explicit privacy statement
	- plain-English disclaimer
- Optional isolated ad container (no access to app state)

## Project Structure

- app: Next.js routes and layout
- src/components: UI components only
- src/engine: pure calculation engine (no React)
- src/config: editable assumptions and bank profiles
- src/state: typed default application state
- src/types: domain types
- src/utils: persistence and formatting helpers
- src/test: unit and snapshot tests

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Testing

```bash
npm test
```

Test coverage includes:

- repayment formulas
- HECS threshold logic
- deterministic scenario snapshot output

## Build

```bash
npm run build
npm start
```

## Weekly Data Refresh

You can refresh reference assumptions (including real-world bank product data) weekly:

```bash
npm run update:reference-data
```

What it does:

- Loads and updates `src/data/reference-data.latest.json`
- Attempts to fetch live bank mortgage product feeds from `scripts/bank-data-sources.json`
- Rebuilds `bankProfiles` from observed variable-rate product data
- Stamps metadata with version, update timestamp, and fetch success/failure summary

Optional flags:

```bash
# Merge additional JSON data before writing
node scripts/update-reference-data.mjs --input=./my-overrides.json

# Skip live bank fetch
node scripts/update-reference-data.mjs --no-bank-fetch

# Increase request timeout (ms)
node scripts/update-reference-data.mjs --timeout-ms=12000

# Use an alternate bank source config file
node scripts/update-reference-data.mjs --sources-file=./scripts/bank-data-sources.json
```

Bank feed notes:

- Each source entry supports optional `headers` so you can pass provider-specific auth/version headers.
- Some public endpoints may reject generic requests (`406`/`400`) without provider-specific requirements.
- When all bank sources fail, the script keeps the curated `bankProfiles` baseline and records failure details in metadata.
- When live sources succeed, their profiles are **merged into** the curated baseline — existing profiles are updated in place and new ones are appended. The baseline is never fully replaced.

### Bank Profile Data

`bankProfiles` in `src/data/reference-data.latest.json` is seeded with indicative data for the major Australian lenders (as of March 2026, owner-occupied ≤80% LVR) and supplemented by any successful live CDR fetches.

**Standard Serviceability Assumptions (APRA-mandated for all ADI banks)**

| Parameter | Value | Notes |
|---|---|---|
| Assessment buffer | +3.00% | APRA-mandated minimum |
| Rental income shading | 70–80% | Higher end for existing tenancies |
| Variable/bonus income shading | 80% | Overtime, bonuses, commissions with history |
| Expense loading | 110% | Actual expenses or HEM, whichever is higher |

> **Disclaimer:** Interest rates and serviceability assumptions are indicative only and based on publicly available information, APRA requirements, and common Australian lending practices. They do not represent a formal credit assessment by any lender. Australian banks do not publicly disclose full internal credit models — broker consensus and publicly documented lending practices have been used where specific figures are unavailable.

### CDR Endpoint Conventions

The source list in `scripts/bank-data-sources.json` now includes many Australian data holder base URLs. The updater treats each source as a CDR-style Banking API and tries common public product routes:

- `{baseUrl}/banking/products` (primary)
- `{baseUrl}/products` (fallback)
- `{baseUrl}/banking/products/{productId}` for product detail fallback when rates are not present in list payloads

How this works in practice:

- A successful HTTP response is not always enough; some providers return products without inline lending rates, so the updater fetches product details to locate mortgage rates.
- `406` is common when gateway rules expect specific version/header negotiation. The updater now retries with multiple header variants before failing a source.
- Not all listed providers are residential mortgage lenders (for example card-only institutions), so a source may be reachable but still produce `no-mortgage-rates`.

If a source keeps failing, add provider-specific headers under that entry in `scripts/bank-data-sources.json`.

## Privacy Statement

All calculations happen locally in your browser. No data is transmitted, stored, or tracked.

## Disclaimer

This calculator provides general information only and does not constitute financial advice.
