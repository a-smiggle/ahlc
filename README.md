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

## Privacy Statement

All calculations happen locally in your browser. No data is transmitted, stored, or tracked.

## Disclaimer

This calculator provides general information only and does not constitute financial advice.
