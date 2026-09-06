# DuneSuite — Desert Safari Operations Platform

All-in-one SaaS for desert safari operators in Dubai / UAE: **Lead → WhatsApp inquiry → Booking → Payment → Vehicle → Driver → Pickup → Safari → Completion → Review**, with multi-tenant isolation and role-based access.

Built with **React 18 · TypeScript · Vite · Tailwind CSS 4 · Recharts**. Data persists in the browser (localStorage) behind a tenant-scoped store with audit logging — swap the store for a REST/Postgres backend without touching the pages.

---

## Why it may have shown a blank page on GitHub Pages

Vite's default `base` is `/`, so a normal `npm run build` emits **absolute** asset URLs (`/assets/index-xyz.js`). GitHub Pages serves the site from `https://<user>.github.io/<repo>/`, where those absolute paths 404 → blank page.

**The fix (already included):** the deploy workflow builds with the CLI override

```bash
npx vite build --base=./
```

which makes every asset URL site-relative (`./assets/...`). This works on any sub-path, on a custom domain, or when served from a folder — and requires **no changes to `vite.config.js`**.

---

## Run locally

```bash
npm install
npm run dev      # → http://localhost:3000
npm run build    # production build → dist/
```

## Deploy to GitHub Pages

### Option A — automatic (recommended)

1. Push this repository to GitHub.
2. The workflow in `.github/workflows/deploy.yml` builds with `--base=./` and publishes on every push to `main`.
3. First run only: open **Settings → Pages** and confirm *Source* is **GitHub Actions** (the workflow usually switches it automatically).
4. Your site is live at `https://<username>.github.io/<repo>/`.

### Option B — manual

```bash
npx vite build --base=./        # relative asset paths — required for sub-path hosting
npx gh-pages -d dist            # or upload dist/ to any static host
```

> Using a **custom domain at the domain root**? Then even a plain `npm run build` works — but `--base=./` is safe everywhere, so keep it.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank page, console shows 404s on `/assets/...` | Rebuild with `npx vite build --base=./` (see above) |
| Old UI after an update | Hard-refresh (`Ctrl/Cmd+Shift+R`) — hashed assets are cached |
| Want a clean demo dataset | Sign in → avatar menu → **Reset demo data** (or delete the `dunesuite_db_v1` localStorage key) |
| Workflow fails on `npm ci` | Lock file missing — the workflow already falls back to `npm install` |

---

## Demo accounts (password: `demo1234`)

| Role | Email | Sees |
| --- | --- | --- |
| Super Admin | `super@dunesuite.app` | All tenants, plans, platform analytics |
| Company Admin | `admin@dunehorizon.ae` | Everything for *Dune Horizon Safaris* |
| Operations | `ops@dunehorizon.ae` | Ops board, fleet, drivers, pickups, trips |
| Sales Agent | `sales@dunehorizon.ae` | WhatsApp CRM, leads, quotations, customers |
| Driver (mobile UI) | `driver@dunehorizon.ae` | Today's trips, call/navigate/status buttons |
| 2nd tenant Admin | `admin@arabiannights.ae` | Proves full tenant isolation |

The login screen has one-click buttons for all of these, plus registration (creates a fresh tenant with a 14-day trial) and a public customer booking page preview.

## What's inside

- **Dashboard** — 12 live KPIs, today's operations table, revenue/booking charts, package donut, lead-conversion funnel, fleet & driver utilization, document-expiry alerts
- **WhatsApp CRM** — pipeline kanban with drag-and-drop, chat threads with read receipts, 10 message templates, quick quotes, lead → customer → booking conversion; Cloud-API adapter in *Settings → WhatsApp Integration* (messages queue locally until credentials are configured — no unofficial automation)
- **Bookings** — auto IDs (`DS-2026-000123`), live VAT/discount/add-on pricing, fleet assignment with **conflict detection** (driver/vehicle overlaps, seat capacity, expired licences), printable invoices
- **Fleet & Drivers** — doc-expiry warnings, 9-point daily inspection checklist, weekly shift scheduler, statuses, ratings
- **Planning** — day/week/month calendar with quick reassignment, drag-drop ops kanban, pickup run sheet with **route-map view** and week strip, 9-stage trip workflow
- **Finance** — payments, overpayment guard, refunds, invoices & quotations (print / save PDF / send via WhatsApp / convert to booking)
- **Reports & Analytics** — 13 report types with date/package/driver filters, CSV export and print-to-PDF
- **Platform** — global ⌘K search, notification center, automated-reminder queue, audit log, team & RBAC management, subscription plans with billing history, embeddable booking widget (`?tenant=<id>&embed=1#/public`)

## Business rules enforced

- A driver or vehicle can't take two overlapping safaris (±45 min window)
- Vehicle seating capacity can't be exceeded
- Off-duty / on-leave drivers and expired licences can't be assigned
- Cancelled bookings release their fleet and can't be re-assigned
- Payments can't exceed the booking total unless explicitly allowed
- Every mutation is tenant-scoped, audited, and notifies the right workspace

## Project structure

```
src/
  lib/        types · utils · seed data · tenant-scoped store (swap point for a real API)
  components/ ui kit · charts · app shell (sidebar, ⌘K search, notifications)
  pages/      Auth · Dashboard · Bookings · CRM · Customers · Fleet · Drivers ·
              Packages · Finance · Planning · Insights · Settings · AdminConsole ·
              DriverApp · PublicBooking
.github/workflows/deploy.yml   GitHub Pages deployment (--base=./)
```

## Notes

- Photography is served from the public **Unsplash CDN** (`images.unsplash.com`, free license). If an image ever fails to load, the UI automatically swaps in an inline SVG dune scene — layouts never break, even fully offline.
- State-based routing means there is exactly one URL (`index.html`) — no 404/redirect config needed on static hosts; the public booking page deep-links via `#/public`.
- The WhatsApp, payment-gateway, and email touchpoints are clean adapter interfaces marked *pending configuration* — ready for the official WhatsApp Business Cloud API, Stripe/checkout, etc.
