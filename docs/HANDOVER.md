# TRIPLAN — Handover report

*Prepared 1 November 2026. Project version 0.1.0.*

---

## A. Project status

TRIPLAN is a complete website project in its final pre-launch stage:
- **Public site:** every page from the brief, in 8 languages with full Arabic right-to-left support.
- **Accounts and trip planner:** registration and login, Fast and Detailed trip planning, itinerary generation and editing on an interactive map.
- **Partner links:** links to booking and travel partners, with an affiliate disclosure.
- **Business features:** pricing and subscriptions, community and reviews with moderation, an admin area, GDPR tools.
- **Brand:** a refined **blue identity** built around the approved logo files, which are unchanged.

**What "ready" means here.** The code is finished and tested as far as this build environment allowed. The **one thing not yet done is a full Next.js production build**: this environment's network policy blocks the npm package registry, so the framework packages couldn't be installed here. The project therefore includes a GitHub Actions workflow. The first time you upload it to GitHub, GitHub installs everything and runs the type-check, tests and production build automatically. A green tick in your repository's **Actions** tab is the final confirmation; if it shows red, send the first error line.

Nothing has been uploaded to GitHub, deployed, or connected to any external account. Those steps are yours (sections D and E).

---

## B. Functional features: implemented and tested

### How it was tested
| Test layer | What runs | Result |
|---|---|---|
| **Backend integration tests** | The real server code (accounts, trips, itinerary, billing, community, admin, GDPR) against a real **PostgreSQL 16** database | **85 / 85 passed** |
| **Browser interaction tests** | The real page components and styles, running in Chromium (desktop + mobile), clicking through every major feature | **98 / 98 passed** |
| **Page sweep** | All 18 public page types × **8 languages** (144 page loads): console errors, broken internal links, missing images, untranslated text, unlabelled buttons, text direction, one main heading | **144 / 144 clean** |
| **Unit tests** | Itinerary engine, maps maths, validation, redirects, partner links, formatting, translations | **55 / 55 passed** |
| **Type-check** | Whole project against the real React, Drizzle and next-intl type definitions | **clean** |
| **Translations** | 1,087 texts × 8 languages, placeholders and plural rules | **complete** |
| **Database setup** | Migrations and seed on PostgreSQL 16, run twice to confirm it's safe to repeat; admin edits and prices survive a redeploy | **passed** |

The browser and backend tests replace only the framework layer (Next.js routing and request plumbing) with small stand-ins. The application's own code, styles, translations and database logic are the real thing.

### Features verified by those tests
- **Homepage & navigation:**
  - Hero carousel: 13 licensed photos, 7-second rotation, Next/Previous, pause/resume, dots, keyboard arrows. It stops for reduced-motion users and loads photos lazily; photographer credits are shown.
  - Header and mobile drawer (mirrored in Arabic); mobile bottom navigation; "Skip to content" for keyboard users.
- **Language selector:** all 8 languages, keeps you on the same page, remembers the choice; Arabic is fully right-to-left.
- **Destination search (Explore):** text search, region/style/budget/climate/month filters, reset, empty state.
- **Destination pages:**
  - Overview, attractions, neighbourhoods, sample-content notice, structured data for Google.
  - **Food searches for halal, vegetarian, vegan, seafood, local, fine dining and budget.** These are live Google Maps searches; restaurants are never invented.
- **Accommodation, flights, transport, luggage storage and activities:** working links to Booking.com, Airbnb, Expedia, Hotels.com, Hostelworld, Google Flights, Skyscanner, Kiwi.com, Rome2Rio, Rentalcars, Bounce, Radical Storage, LuggageHero, GetYourGuide, Viator and Tiqets. All open safely in a new tab, with an **affiliate disclosure** next to them.
- **Accounts:**
  - Sign-up (with terms consent), login, logout, email verification, password reset.
  - Sessions stored hashed; passwords hashed with bcrypt.
  - Repeated failed logins are rate-limited; error messages never reveal which emails have accounts; redirect tricks are blocked.
- **Trip planning:**
  - Fast Trip, and the 7-step Detailed Trip with validation, an accommodation map picker and a review step.
  - Answers survive a reload or a language switch; you must sign in before saving, and your choices are kept.
- **Itinerary generation:** places grouped by area, realistic meal times (lunch 11:30–15:00, dinner from 19:00), free time, arrival and departure days, pace and walking preferences. Only real database places are used; no prices are invented; travel times are labelled as estimates.
- **Saving & editing trips:**
  - My Trips list; reorder (drag or buttons), lock, replace, remove, change duration, move to another day, add a place or a custom stop.
  - Regenerate a day or the whole trip (locked stops are kept); rename, change status, duplicate, delete.
  - Other users cannot see or edit your trips.
- **Interactive map:** real Leaflet map, a numbered marker per stop that stays in sync with the list (click either one), route line, attribution, "Open in Google Maps" directions. Stops at the same spot are fanned out so none is hidden.
- **Pricing & subscriptions:**
  - Free plan (1 trip), €2.99 extra trip, €29.99/year.
  - The free limit is enforced, and you're sent to pricing without being charged.
  - Stripe checkout session creation and **signed webhook handling** were verified with simulated Stripe events: extra-trip credit, annual unlimited, cancellation, duplicate-event protection, rejection of forged events.
- **Community & reviews:** posting requires a verified email, link-heavy posts are held for moderation, likes, reports; platform reviews are published only after moderation. No fake reviews.
- **Contact & FAQ:** contact form with bot protection and no invented address or phone; FAQ with structured data.
- **Account & GDPR:** preferences, password change, data export (never includes password or session data), account deletion; cookie consent (necessary-only by default, reopenable from the footer).
- **Admin:** admin-only access; edit prices, hero slides, destinations and places, translations; moderation; users.

### Implemented but only verifiable once deployed with real accounts
Sending real emails (Resend), real Stripe payments, Google sign-in, AI itineraries (Anthropic), Google route durations, the sitemap/robots/metadata as served by Next.js, and the first full Next.js build (done by GitHub Actions on upload).

---

## C. Outstanding requirements (need your action or decision)

### Accounts and keys
| Item | Needed for | Required? | Where it goes |
|---|---|---|---|
| **GitHub account** | Storing the code | Yes | You have it |
| **Vercel account** (free Hobby to start) | Hosting | Yes | vercel.com |
| **Neon database** via Vercel's Storage tab | Data | Yes | Vercel → Storage (creates `DATABASE_URL` automatically) |
| **`AUTH_SECRET`** | Account security | Yes | Vercel → Environment Variables |
| **`ADMIN_EMAILS`** | Your admin account | Yes | Vercel → Environment Variables |
| **`NEXT_PUBLIC_SITE_URL`** | Correct links, emails, SEO | Yes, after first deploy | Vercel → Environment Variables |
| **Resend account + your domain** | Verification, password-reset and contact emails | Before public launch | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_INBOX` |
| **Stripe account** (business verification) | Payments | When charging | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` + webhook |
| **Vercel Pro plan** | Hobby is non-commercial only | Before taking payments or affiliate income | Vercel billing |
| **Google OAuth client** | "Continue with Google" | Optional | `GOOGLE_CLIENT_ID/SECRET` |
| **Anthropic API key** | AI-assisted itineraries (rules engine works without) | Optional | `ANTHROPIC_API_KEY` |
| **Google Maps Routes API key** | Real travel durations (estimates otherwise) | Optional | `GOOGLE_MAPS_API_KEY` |
| **Map tile provider** (MapTiler, Stadia…) | Map tiles at real traffic levels | Recommended before launch | `NEXT_PUBLIC_MAP_TILE_URL/ATTRIBUTION` |
| **Affiliate approvals** (Booking.com, GetYourGuide, Viator) | Earning commission | Optional | `BOOKING_AFFILIATE_ID`, `GETYOURGUIDE_PARTNER_ID`, `VIATOR_PARTNER_ID` |
| **Domain name** | Your own address | Optional at first | Vercel → Domains |

All links work without affiliate approval; they just don't earn commission. Airbnb, Expedia, Hotels.com, Hostelworld, Skyscanner, Kiwi.com, Tiqets and the luggage services are plain links. Adding their programmes later needs a small code change in `src/lib/links.ts`.

### Content and legal (your decisions)
- **Legal pages:** `src/content/legal.ts` has placeholders in square brackets (company name, address, contact email, governing law, affiliate programmes). Fill these in and have **a lawyer review** the privacy policy, terms, cookie and subscription policies before launch. No company details were invented.
- **Destination texts:** the 56 destinations carry sample text marked "Unverified". Review and verify them in `/en/admin/destinations`.
- **Logo colour:** your approved logo artwork is dark teal (`#123C43`) and has been kept exactly as supplied, as instructed. If you'd prefer the black or white versions (also supplied) in some places on the blue site, that's a one-line change.
- **Prices:** confirm €2.99 / €29.99 (changeable any time in `/en/admin/pricing`).

### Not implemented in this version
- Photo uploads in community posts (needs file storage and image moderation).
- Live partner prices and availability (requires official partner API agreements).
- Collaborative trip editing with invited travellers.
- Offline mode and mobile apps.
- Admin screens in languages other than English.
- A Content-Security-Policy header, and a shared rate limiter for multiple servers (Redis/Upstash). Other security headers are in place.

---

## D. GitHub instructions

Full beginner guide: **`docs/GITHUB_UPLOAD.md`**. In short:

**Method A, website (no installs):**
1. github.com → **+** → **New repository** → name `triplan`, **Private**, nothing else ticked → **Create repository**.
2. Extract **`triplan-github-web-upload.zip`** and turn on hidden files.
3. **Uploading an existing file** → drag the *contents* of `1-root-files` → **Commit changes**.
4. **Add file → Upload files** → drag the `src` folder from `2-src-part-1` → commit.
5. Repeat with the `src` folder from `3-src-part-2` → commit.
6. Check the **Actions** tab for a green tick.

**Method B, Git commands:**
```bash
cd ~/Downloads                     # Windows PowerShell: cd $HOME\Downloads
unzip triplan.zip                  # Windows: Expand-Archive -Path .\triplan.zip -DestinationPath .
cd triplan
git init -b main
git add .
git commit -m "Initial version of TRIPLAN"
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/triplan.git
git push -u origin main
```

---

## E. Deployment instructions

Full guide: **`docs/DEPLOYMENT.md`**. In short:
1. vercel.com → sign up with GitHub (Hobby).
2. **Add New → Project** → import `triplan` → add `AUTH_SECRET` and `ADMIN_EMAILS` → **Deploy**. This first attempt stops with "DATABASE_URL is not set", which is expected.
3. Project → **Storage** → **Neon** → Free plan, region near your users → connect to **Production** (and **Preview** with per-preview database branches) → **Redeploy**.
   - The app reads **`DATABASE_URL`**.
   - The integration also adds `DATABASE_URL_UNPOOLED`, which the migrations use.
   - **No manual migration steps:** every deploy runs migrations → seed → build automatically.
4. Add `NEXT_PUBLIC_SITE_URL` = your `https://….vercel.app` address → **Redeploy**.
5. Test: sign up with your admin email (verification link is in Vercel **Logs** until email is set up), plan a trip, open `/en/admin`.
6. Later: domain, Resend, Stripe (with Vercel Pro), optional services.

---

## F. Future maintenance

**Without touching code (admin area, `/en/admin`):**
- Edit or verify destinations and their places, and add new ones.
- Change the homepage hero photos: add, reorder, switch on and off.
- Change prices.
- Moderate community posts, reviews and reports; manage users.
- Override any interface text in any language.

**Code changes:** edit files → `git add . && git commit -m "…" && git push` (or upload changed files on github.com). Vercel rebuilds and publishes automatically in 2–4 minutes, including any database changes. If a release goes wrong, use Vercel → **Deployments** → previous version → **Promote to Production** to roll back instantly.

**Good habits:**
- Keep the CI tick green; it runs on every push.
- Every few months, update dependencies (`npm outdated`, then `npm update`) and check that CI stays green. GitHub's free **Dependabot** can open these updates for you (repository → Settings → Code security).
- Watch Vercel **Logs** after releases.
- Back up the database: Neon keeps a short restore window (shorter on the free plan). For real safety, also export a backup regularly from the Neon console, or upgrade before launch.
- Never commit secrets. Rotate any key you suspect was exposed.

---

## G. Final files

| File | Contents |
|---|---|
| **`triplan.zip`** | The complete project: source code, styles, translations, logo assets, database migrations and seed data, tests, CI workflow, Vercel config, `.env.example`, `.gitignore`, README and these guides |
| **`triplan-github-web-upload.zip`** | The same files pre-split into 3 batches under 100 files each, for GitHub's website uploader |
| `docs/GITHUB_UPLOAD.md` | Step-by-step GitHub guide (both methods, plus how to update later) |
| `docs/DEPLOYMENT.md` | Step-by-step Vercel + Neon launch guide, optional services, launch checklist |
| `docs/HANDOVER.md` | This report |
| `docs/screenshots/` | Desktop and mobile screenshots (photos shown as placeholders: the build environment cannot load Unsplash) |

**Fonts:** Manrope and Noto Sans Arabic (open-source, SIL Open Font Licence) are loaded through Next.js's font system at build time, so no font files are needed in the repository.
**Photos:** loaded from Unsplash under the Unsplash License, with credits; no photos are stored in the project.
