# India AI Dashboard Architecture

The dashboard uses a replaceable data boundary so UI components never need to know whether data came from Excel, generated JSON, a database, or a future API.

```text
Excel workbook
  -> parser script
  -> data/dashboard.v1.json
  -> services/dashboardData.ts
  -> Next.js pages and API routes
  -> dashboard UI
```

Version 1 intentionally avoids PostgreSQL and a separate FastAPI service. Next.js API routes expose REST-shaped endpoints today, while `services/dashboardData.ts` is the only module that knows the current storage format.

Future database or backend work should replace service internals first, preserving the exported service functions used by the frontend.

## Dashboard Widgets

Dashboard widgets are implemented as reusable React components in the dashboard UI layer: KPI cards, panels, chart frames, filters, state drill-down views, heatmap cells, and evidence cards. The data shaping functions stay typed and deterministic so these widgets can later be moved into a shared component package without changing their public props.

## SEO and Rendering

The public dashboard is built with the Next.js App Router. The homepage uses a Server Component to load the generated dataset and passes it into the interactive client dashboard. Entity routes for states, companies, sectors, policies, and investment periods use `generateStaticParams`, dynamic metadata, JSON-LD, sitemap entries, robots.txt, and canonical URLs so important pages are indexable.

Incremental Static Regeneration is set to `86400` seconds on the dashboard, API route, and generated entity routes. Next.js requires this segment config to be statically analyzable, so the value is exported as a literal in each route file.

## Performance

ECharts is dynamically imported on the client because the charting library depends on browser APIs. This keeps server-rendered SEO pages lighter and lets Next.js split the chart code away from static entity pages. The current data source is generated JSON, which keeps local development and Vercel deployment simple while preserving a clean service boundary.

## Future Growth

PostgreSQL, FastAPI, automated refresh, AI summaries, authentication, saved dashboards, watchlists, public APIs, Excel/PDF export, scheduled jobs, and email reports should be added behind the service/API boundary. This keeps the frontend stable: widgets consume typed dashboard data and do not need to know whether the backing source is JSON, Postgres, or a separate backend service.
