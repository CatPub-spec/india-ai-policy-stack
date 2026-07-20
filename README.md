# India AI Policy & Investment Dashboard

## Current Release · July 2026

The current dashboard is the primary version of this project. It combines the expanded 2024–2026 evidence ledger with interactive state, industry, concentration, investment-scale, and institution-network views.

**[Open the current application source →](india-ai-dashboard/)**

Highlights include the master Ask the Analyst experience, the source-backed Institution Network, the redesigned Concentration Trajectory, the Data Atlas, and indexable detail pages for states, institutions, sectors, policies, and investment periods.

## Project Map

- `india-ai-dashboard/` - the Next.js dashboard application.
- `india-ai-dashboard/src/app/` - Next.js routing files. The folder name `app` is required by Next.js.
- `india-ai-dashboard/src/app/api/dashboard/` - REST-shaped Next.js API route for dashboard data.
- `india-ai-dashboard/src/components/` - reusable UI components, including shadcn-style primitives.
- `india-ai-dashboard/src/features/` - feature-specific UI and business logic.
- `india-ai-dashboard/src/services/` - typed data access layer. UI code should depend on services, not file paths.
- `india-ai-dashboard/src/lib/` - shared utilities, SEO helpers, and slug helpers.
- `india-ai-dashboard/src/types/` - shared platform types.
- `india-ai-dashboard/src/dashboard-ui/` - dashboard screens and interactive UI.
- `india-ai-dashboard/src/dashboard-data/` - dataset types, parsing, formatting, and metric helpers.
- `india-ai-dashboard/data/` - the canonical Excel dataset and generated JSON consumed by the service layer.
- `india-ai-dashboard/docs/` - architecture notes.
- `india-ai-dashboard/public/` - static files served by Next.js, including `indiaAI.jpeg`.
- `dashboard-tools/` - maintenance scripts for refreshing data and verifying the dashboard in a browser.

## Architecture

```text
Excel workbook
  |
  v
Parser script
  |
  v
Generated JSON in india-ai-dashboard/data/
  |
  v
Typed data services
  |
  v
Next.js pages and REST API routes
  |
  v
Dashboard UI
```

The current release intentionally does not include PostgreSQL, FastAPI, or a separate backend. The dashboard talks to typed service functions and `/api/dashboard`, so a future database or backend service can replace the service internals without rewriting the UI.

The app uses static generation and ISR for indexable entity pages, dynamic metadata for each state/company/sector/policy/investment page, JSON-LD, `sitemap.xml`, `robots.txt`, and OpenGraph/Twitter metadata. Interactive charts are lazy-loaded on the client to keep SEO pages lightweight.

## Run

```bash
cd india-ai-dashboard
npm ci
npm run dev
```

The dashboard opens at `http://127.0.0.1:3000`.

## Refresh Data

The Excel workbook at `india-ai-dashboard/data/dashboard.v1_industry_researched.xlsx` remains the source of truth. Generate structured JSON with:

```bash
cd india-ai-dashboard
npm run sync:data
```

The parser writes `india-ai-dashboard/data/dashboard.v1.json`. The dashboard does not read Excel directly.

The `Records` sheet includes a `Major Players` column containing semicolon-delimited,
canonical institution names. The sync step exposes this field as a `majorPlayers`
array, which powers the institution pages, search, analyst context, and Chart Lab
network.

To use another workbook temporarily, pass its path explicitly:

```bash
npm run ingest:excel -- /path/to/source.xlsx
```
