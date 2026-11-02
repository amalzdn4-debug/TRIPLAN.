# TRIPLAN — Plan less. Explore more.

TRIPLAN is an international travel-planning website. Travellers describe a trip, either quickly or in detail, and get a realistic day-by-day itinerary with meals, breaks, travel times and a numbered interactive map. When a trip is longer than a destination needs, TRIPLAN suggests a nearby city or day trip (e.g. 3 days in Lisbon + 2 in Porto by train) and reorganizes the plan around it, including travel days and the traveller's accommodation. Members share recommendations with photos in the community. Travellers edit everything, then book through the sites they choose.

- **8 languages:** English, العربية (full right-to-left), Français, Español, Italiano, 简体中文, Русский, Português
- **Honest by design:** no invented prices, reviews, availability or restaurants. Estimates are labelled; sample content says "Unverified".
- **Blue brand identity** around the approved TRIPLAN logo (logo files unmodified).

## Start here

| I want to… | Read |
|---|---|
| Put the project on GitHub | [`docs/GITHUB_UPLOAD.md`](docs/GITHUB_UPLOAD.md) |
| Publish the website (Vercel + Neon) | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Know what's finished, tested and still needs me | [`docs/HANDOVER.md`](docs/HANDOVER.md) |

## Technology

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Languages | next-intl — `/en/…`, `/ar/…` URLs, hreflang, ICU plurals |
| Styling | Plain CSS design tokens (`src/styles/tokens.css`) with logical properties, so RTL works automatically |
| Database | PostgreSQL via Drizzle ORM (reads `DATABASE_URL`); embedded PGlite for local development |
| Accounts | Own secure implementation: bcrypt, hashed sessions, email verification, password reset, optional Google sign-in |
| Maps | Leaflet + OpenStreetMap (configurable tiles); "Open in Google Maps" for navigation |
| Itineraries | Rules engine, plus optional AI (Anthropic) restricted to places in the database |
| Payments | Stripe Checkout + Billing Portal, verified webhooks; Free, per trip, Monthly (trips per billing month) and Annual plans; test-mode payments labelled and excluded from revenue |
| Photos | Vercel Blob for member photos (resized in the browser, checked and metadata-stripped on the server) |
| Affiliates | Admin-approved partners only, labelled "Partner", clicks counted via `/api/go/…` without storing IPs |
| Hosting | Vercel (`vercel.json`), with migrations and seed run automatically on every deploy |
| CI | GitHub Actions (`.github/workflows/ci.yml`): install, translations check, type-check, tests, build |

## Folder structure

```
triplan/
├── .github/                        # GitHub Actions: automatic install, type-check, tests and build on every push
├── db/
│   └── migrations/                 # SQL migrations (run automatically on deploy)
├── docs/                           # Guides: GitHub upload, deployment, handover, screenshots
├── messages/                       # Interface translations — en, ar, fr, es, it, zh, ru, pt
├── public/                         # Static files
│   └── brand/                      # Approved TRIPLAN logo files (unmodified)
├── scripts/                        # migrate, seed, make-admin, translation check
├── src/                            # Application source
│   ├── actions/                    # Server actions: auth, trips, community, billing, account, admin, contact
│   ├── app/                        # Pages & API routes (Next.js App Router)
│   │   ├── [locale]/               # Every page, per language (/en, /ar, …)
│   │   └── api/                    # Stripe webhook, Google sign-in, GDPR data export
│   ├── components/                 # UI components
│   │   ├── account/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── community/
│   │   ├── destinations/
│   │   ├── home/
│   │   ├── itinerary/
│   │   ├── layout/
│   │   ├── map/
│   │   ├── planner/
│   │   └── ui/
│   ├── config/                     # Languages and site constants
│   ├── content/                    # Legal page templates
│   ├── data/                       # Seed destinations (56) and hero photos (13)
│   ├── db/                         # Database schema and connection (reads DATABASE_URL)
│   ├── i18n/                       # Language routing
│   ├── lib/                        # Itinerary engine, AI, auth, links, maps, SEO, Stripe, validation
│   │   ├── auth/
│   │   └── itinerary/
│   └── styles/                     # Design tokens (blue palette) and styles
├── tests/
│   ├── e2e/                        # Playwright browser tests
│   └── unit/                       # Vitest unit tests
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── playwright.config.ts
├── README.md
├── tsconfig.json
├── vercel.json
└── vitest.config.ts
```

## Running it on your own computer (developers)

Requires **Node.js 20.11+**. No database installation needed.

```bash
npm install
cp .env.example .env.local         # then set AUTH_SECRET (see .env.example)
npm run db:setup                   # creates and seeds an embedded database in ./.data
npm run dev                        # http://localhost:3000
```

Without email keys, verification and password-reset links are printed in the terminal. Make yourself admin by putting your email in `ADMIN_EMAILS` before signing up, or with `npm run make-admin -- you@example.com`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / start |
| `npm run vercel-build` | What Vercel runs: migrations → seed → build |
| `npm run db:setup` | Migrations + seed (safe to repeat: never overwrites admin edits or prices) |
| `npm run make-admin -- email` | Give a user admin rights (`--revoke` to remove) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) against a local production build |
| `npm run i18n:check` | Verifies all 8 languages have every text |

## Configuration

All settings are environment variables. **`.env.example` lists every one with explanations and no real values.** Only `DATABASE_URL` and `AUTH_SECRET` are required; everything else switches on an optional service (email, payments, photo uploads, the daily job, Google sign-in, AI, routing, map tiles, social links). Affiliate partners are managed in the admin area, not in variables. Secrets are never committed: `.env` and `.env.local` are git-ignored.

## Data, photos and content
- The seed creates **351 destinations** in 95 countries, landmark places for ~18 cities, about 280 curated intercity journey times (typical durations, not timetables), the four pricing plans and the hero rotation. Editorial text is **sample** content, shown as "Unverified" until an editor verifies it in `/admin/destinations`. No restaurants, prices, ratings, reviews or community members are seeded.
- On deploy and once a day, an importer adds **Wikipedia introductions in 8 languages, localized city names, freely licensed Wikimedia Commons photos (credited) and main attractions/transport hubs from Wikidata**. It never overwrites text or places an editor has written or verified.
- Hero and destination photos are from **Unsplash** under the [Unsplash License](https://unsplash.com/license), with photographer credits shown on each slide (`src/data/hero.ts`, editable in `/admin/hero`).
- Legal pages (`src/content/legal.ts`) are **templates with placeholders**. They must be completed and checked by a lawyer before launch.

## Licence
Private project. All rights reserved by the TRIPLAN owner. The TRIPLAN logo files in `public/brand/` are the owner's approved brand assets.
