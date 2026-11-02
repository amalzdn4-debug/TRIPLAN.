# TRIPLAN — Handover report: improvements release

Date: 2 November 2026. This release builds on the site already live at **triplan-plum-five.vercel.app**. The design, structure and existing features were kept, and only the parts listed below were changed.

> **Status in one sentence:** everything below is built and tested on Claude's side, but **not yet on GitHub or Vercel**. GitHub isn't linked to Claude, so nothing could be pushed. You upload this version (section 11), and Vercel deploys it.

---

## 1. What changed (summary)

| Brief section | Result |
|---|---|
| 1 Smarter planning, nearby cities | ✅ Stay-length analysis plus nearby suggestions; accept / choose another / keep; the itinerary re-plans itself |
| 2 Daily itineraries and distances | ✅ Balanced geographic days, best visiting order, meals and breaks; map follows the day |
| 3 Homepage slideshow, 300+ destinations | ✅ 351 destinations (was 56); slideshow mixes continents and landscape types |
| 4 Destination images and content | ✅ Wikipedia/Wikimedia/Wikidata import (8 languages, credited CC photos, attractions, hubs), nearby places, image fallbacks |
| 5 Community posts | ✅ Create/edit/delete with up to 6 photos and a location, comments, likes, profiles, reports, moderation, honest empty state |
| 6 Logo | ✅ Horizontal, **stacked (new)**, standalone TP and wordmark; header, footer, favicon, loading screen |
| 7 Affiliates | ✅ Admin-managed partners (approved only), "Partner" labels, disclosure, click tracking |
| 8 Monthly subscription | ✅ €6.99 / 4 trips per billing month (configurable), cancel/resume, test vs live mode |
| 9 Accommodation | ✅ Booked: name, address, pin, used as day start/end. Not booked: suggested area plus search links; can be added later |
| 10 Transport connections | ✅ Intercity journeys as itinerary stops, with station transfers. Typical times only, never invented timetables or prices |
| 11 Languages | ✅ 1,370 texts × 8 languages, **admin included**; localized city names; Arabic RTL checked |
| 12 Testing | ✅ See section 10; what couldn't be tested is listed there |

## 2. Existing features improved

- **Itinerary engine** (`src/lib/itinerary/engine.ts`):
  - Places are first divided into **one compact area per day**, with balanced numbers of sights.
  - Each day then uses the **shortest sensible order**: every order is tried up to 7 stops.
  - No museum starts after 16:30.
  - Well-known places rank higher.
  - Locked stops are never touched.
- **Map** (`TripMap.tsx`):
  - shows only the selected day and centres on that day's city;
  - draws the route back to your accommodation;
  - journeys have their own marker colour;
  - the "suggested area to stay" appears as a circle.
- **Destination pages:**
  - Wikipedia introduction in your language with a CC BY-SA source line;
  - photo gallery with credits;
  - attraction thumbnails and visit lengths;
  - nearby places with transport, journey time, distance and day-trip/overnight suitability;
  - transport hubs.
- **Homepage slideshow:**
  - up to 24 slides, mixing continents and landscape types (city, coast, island, nature);
  - the existing 6–8 s rotation, controls and dots are kept.
- **Pricing and billing:**
  - four plans;
  - the billing page shows trips used this month and the reset date, with a progress bar;
  - payment history labels test payments.
- **Outbound links:** plain search links no longer carry affiliate IDs. Partner links come only from approved partners and are labelled.
- **Admin:**
  - destinations show their content-import status;
  - moderation now covers comments and shows post photos;
  - the dashboard shows live revenue only, with test payments excluded, plus the status of every integration;
  - the whole admin area is translated.
- **Disclosure text:** the old wording promised partners never change the order of links. That would now be false, because partner links are listed first. The new wording says what is true: partner links are labelled, and partners can't pay to change itineraries or recommendations.

## 3. New features

1. **Nearby-city suggestions.** A 5-day Lisbon trip, for example, suggests 3 Lisbon + 2 Porto (train, typical 2 h 50, direct). Other options include Coimbra, or an Évora/Sintra day trip.
   - The suggestion appears only when the trip is longer than the destination fills at the chosen pace.
   - Options: **Use this plan**, **Choose another place** (any practical nearby place, as a day trip or a stay), or **Keep all days in Lisbon**. You can also go back to one city later.
2. **Travel days and day trips.**
   - A travel day runs: breakfast → transfer to the station (estimate) → the train as a stop (typical time, Google Maps and Rome2Rio links, "check before you travel") → a lighter afternoon in the new city.
   - A day trip goes out and back, with dinner at the base.
3. **Accommodation panel** in the trip:
   - add your hotel or apartment (name, address, map pin) at any time, and the trip re-plans around it;
   - "From/Back to accommodation" legs on each day;
   - without a booking: the suggested area to stay, chosen as the neighbourhood closest to your planned sights, plus booking searches.
4. **Community:**
   - post page (`/community/posts/…`) and edit page;
   - member profiles (`/community/members/…`);
   - photo upload (resized in the browser; type, size and dimensions checked on the server; EXIF/GPS removed);
   - comments, comment reports, deleting your own post or comment;
   - posts under review are visible only to their author.
5. **Monthly plan:**
   - Stripe subscription; 4 trips per billing month, counted atomically and reset on renewal;
   - a 5th trip shows a clear "period limit" message;
   - cancel at the end of the period, or resume;
   - one subscription at a time.
6. **Affiliate admin** (`/admin/affiliates`):
   - add a partner with its tracking link and placeholders; new partners start as Pending;
   - approve, pause or reject;
   - click statistics over 7 and 30 days, and unique visitors (no IPs stored);
   - redirect `/api/go/<partner>`.
7. **Daily job** (`/api/cron/enrich`, 04:17 UTC): continues the content import and deletes abandoned photo uploads.
8. **Stacked logo** (`public/brand/triplan-stacked-*.svg`): built from the *unchanged* monogram and wordmark paths. **Loading screen** with the TP monogram.
9. **Localized city names** (Lisbonne, Lissabon, لشبونة, 里斯本…), taken from the matching Wikipedia article titles. Search works in both the local language and English; brand names are never translated.

## 4. Files and folders modified

**New**
- `db/migrations/0003_world_catalogue.sql`, `0004_multicity.sql`, `0005_community.sql`, `0006_monthly_affiliates.sql`
- `src/data/world/` (295 destinations), `src/data/connections.ts` (≈280 journeys)
- `src/lib/enrich/` (Wikipedia, Commons, Wikidata importer), `scripts/enrich.ts`, `src/app/api/cron/enrich/`
- `src/lib/nearby.ts`, `src/lib/itinerary/split.ts`, `src/lib/hero.ts`, `src/lib/images.ts`
- `src/lib/media.ts`, `src/lib/storage.ts`, `src/app/api/uploads/`
- `src/lib/affiliates.ts`, `src/lib/affiliate-template.ts`, `src/app/api/go/`, `src/app/[locale]/admin/affiliates/`
- `src/app/[locale]/community/posts/`, `src/app/[locale]/community/members/`, `src/app/[locale]/loading.tsx`
- `src/components/itinerary/PlanPanels.tsx`
- `src/components/community/` (`PhotoUploader`, `Comments`, `ReportForm`)
- `src/components/destinations/NearbyList.tsx`
- `src/components/media/`, `src/components/ui/OutboundLinks.tsx`, `src/components/account/SubscriptionControls.tsx`
- `src/db/raw.ts`
- `public/brand/triplan-stacked-{teal,white,black}.svg`
- Tests: `tests/unit/{multicity,nearby,enrich,media,affiliate,destinations}.test.ts`

**Changed:** `messages/*.json` (all 8), `src/db/schema.ts`, `scripts/seed.ts`, `scripts/check-i18n.ts`, `package.json` (adds `@vercel/blob`, `enrich` and `vercel-build` scripts), `vercel.json` (daily cron), `next.config.ts` (Wikimedia and Blob image hosts), `.env.example`, `README.md`, `docs/DEPLOYMENT.md`, this file, `src/content/legal.ts`. Also these files under `src/`:
- actions: `trips`, `community`, `billing`, `admin`, `account`
- lib: `trips`, `entitlements`, `destinations`, `community`, `links`, `validation`, `env`
- itinerary: `engine`, `types`, `routing`
- components: `TripWorkspace`, `TripMap`, `HeroCarousel`, `PostCard`, `PostForm`, `Footer`, `Logo`, `ExploreClient`, `DestinationCard`, `EntitlementBanner`, `Icon`
- admin pages; the destination, community, trip, pricing, billing and account pages
- `api/stripe/webhook`, `api/account/export`
- `styles/components.css`

Nothing was deleted except the three old affiliate-ID lines in `links.ts` and `.env.example`.

## 5. Database changes

All four migrations are **additive**: nothing is dropped, and existing rows aren't modified, apart from a one-time reorder that moves Annual after Monthly. They run automatically on deploy, once each, recorded in `_migrations`.

| Migration | Adds |
|---|---|
| `0003_world_catalogue` | Destination type, Wikipedia fields and import status; image licence/source/size; place Wikidata id, popularity and image; new table `destination_connections` |
| `0004_multicity` | `itinerary_days.destination_id` and `kind` (normal/travel/day_trip); `itinerary_stops.details` (journey info) |
| `0005_community` | Post place/pin/edited/comment count; tables `media_uploads` and `post_comments`; reports can target comments |
| `0006_monthly_affiliates` | `monthly` billing; subscription period start, trips used, test/live flag; payment test/live flag; `trips.subscription_id`; tables `affiliate_partners` and `affiliate_clicks` |

Row-level security is switched on for every new table, matching the existing lock-down. Tested by upgrading a copy of the v1 database: all 6 migrations applied, existing users, trips and admin edits were kept, and the new seed data was added. **Backup:** create a Neon branch before deploying (`DEPLOYMENT.md` → *Already live?* step 1).

## 6. Environment variables

| Variable | Needed? | Where it comes from |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Already set | Neon integration (prefix `DATABASE`) |
| `AUTH_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL` | Already set | You |
| **`CRON_SECRET`** | **New, add now** | Any long random string. Turns on the daily job |
| **`BLOB_READ_WRITE_TOKEN`** | New, for photo uploads | Set automatically when you connect a Vercel Blob store |
| `WIKIMEDIA_CONTACT` | Optional | An email you read (Wikimedia asks API users for one) |
| `TRIPLAN_SKIP_ENRICH` | Optional | `1` skips the import during a build |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | For payments | Stripe (test first, then live) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_INBOX` | Before launch | Resend |
| ~~`BOOKING_AFFILIATE_ID`, `GETYOURGUIDE_PARTNER_ID`, `VIATOR_PARTNER_ID`~~ | **Removed** | Use /admin/affiliates instead. Delete them in Vercel if you added any |

## 7. External accounts and keys still needed

| What | Why | Cost |
|---|---|---|
| Vercel **Blob** store | Member photos | Included allowance, then usage-based |
| **Stripe** account (activated for live) | Payments | Fees per transaction |
| **Vercel Pro** | Commercial use (payments, affiliates) | About $20/month |
| **Affiliate programmes** (Booking.com, Viator, GetYourGuide, Skyscanner, Airbnb where eligible, Bounce, Radical Storage, LuggageHero…) | Commissions | Free to apply; acceptance is the programme's decision |
| **Resend** plus your domain | Verification and password-reset emails | Free tier |
| Lawyer | Review the legal templates (now covering Monthly, photos, click tracking) | — |
| Optional: Google Maps Routes key, a map-tile provider, Anthropic key | Real travel times, heavy map traffic, AI drafting | Usage-based |

## 8. Fully functional, tested end to end

- **Trip planning:** multi-city suggestions and re-planning, travel days, day trips, balanced days, accommodation start/end, area suggestion, regenerate/replace/add per city, duplicate.
- **Accounts and trips:** sign-up, login, verification, password reset, and trip privacy (others can't read or edit).
- **Community:** posts with photos, edit and delete, comments, likes, reports, auto-hide after 3 reports, admin moderation, profiles, account deletion removing photos, GDPR export including comments and photos.
- **Monthly plan logic:** checkout request, webhook activation, 4-trip limit, renewal reset, out-of-order events, cancel/resume, test-mode flagging, invoices against the right plan.
- **Affiliates:** pending partners hidden, approval, labelled links, redirect with filled-in details, click counting, injection attempts blocked, pause.
- **Languages and content:** 8 languages including the admin area, Arabic right-to-left, localized city names, legal pages updated.

## 9. Features that still need your action

1. **Upload this version to GitHub** (section 11). Until then the live site is the old version.
2. **`CRON_SECRET`** (2 min): Vercel → triplan → **Settings → Environment Variables → Add** → name `CRON_SECRET`, value from a password generator (40+ characters), Production → **Save** → **Redeploy**.
3. **Photo uploads** (3 min): Vercel → triplan → **Storage → Create Database → Blob** → name `triplan-photos` → **Create** → **Connect** to `triplan`, Production → **Redeploy**. The community form then shows **Add photos**.
4. **Stripe test mode** (20 min): `DEPLOYMENT.md` → *Stripe setup*. Then the **live-mode checklist** in the same file, which lists exactly the account settings, keys, webhook events and legal information required. Don't switch to live keys before completing it.
5. **Affiliates:** apply to programmes. When one accepts you: **/en/admin/affiliates → Add a partner** → paste the tracking link → **Mark approved**. Steps are in `DEPLOYMENT.md` → *Affiliate partners*.
6. **Legal:** fill the `[brackets]` in `src/content/legal.ts` and have it reviewed. The legal pages are in English in every language for now, on purpose: translating them before legal review would multiply the review work.
7. **Content:** the import works in batches: about 4 minutes on every deploy, plus about 40 seconds every day. How many destinations fit depends on Wikipedia's response times. To speed it up, use **Import next batch** in **/en/admin/destinations** a few times. Check the status column there after a few days. "Failed" usually means the Wikipedia title needs correcting; edit **Wikipedia article title** and re-import.
8. **Opening hours:** the database has a field, but no hours are filled in, and none are invented. The planner keeps museums out of the late afternoon as a safe default. Adding verified hours per place is future work.

## 10. How it was tested, and how you can test it

**Claude's tests (all pass):**

| Suite | Result | What it covers |
|---|---|---|
| Unit tests | 101/101 | Planner, splits, routes, nearby, importer parsing, image checks, affiliate templates, translations |
| Database integration (real PostgreSQL 16) | 183/183 | Every server action and webhook above, privacy, data safety |
| Importer end-to-end (fixtures + PostgreSQL) | 18/18 | Introductions, localized names, photos, attractions, never overwriting editors |
| Browser interactions (Chromium, desktop and mobile, en and ar) | 154/154 | Slideshow, search, planner, map sync, multi-city flow, accommodation, uploads, comments, pricing |
| Page sweep | 168 loads (21 pages × 8 languages) | No errors, raw keys or broken links/images; one heading; correct direction |
| Upgrade test | ✅ | Migrations 0003–0006 on a copy of the v1 database |

**Not tested here, and why:**
- **`npm install` / `next build`:** the package registry is blocked in Claude's environment. GitHub Actions CI runs both on your first push; wait for the ✅.
- **Real Wikipedia, Stripe and Vercel Blob calls:** those networks are blocked here. They were tested with recorded responses and test doubles. The first real runs happen on your deploy.
- **The live site itself:** Claude can't reach it from here.

**Your 10-minute check after deploying:**

1. `/en` — the photos rotate every few seconds; try ◀ ▶ and the dots.
2. `/en/destinations/porto` — introduction, photos with credits, *Nearby* (Lisbon by train).
3. `/en/plan/fast` → Lisbon, 5 days → open the trip. The suggestion card appears → **Use this plan** → day 4 is "Lisbon → Porto" with the train.
4. In the trip → **Where you're staying → I've booked a place** → name plus map pin → **Save and re-plan**. Days now start "From …".
5. `/en/community` → share a post with 2 photos (after Blob is connected) → open it → comment → edit → delete.
6. `/en/pricing` shows four plans. With Stripe test keys, subscribe to Monthly using card 4242 4242 4242 4242; Billing shows "0 of 4 used" and *Test*.
7. `/en/admin/affiliates` → add a test partner → leave it **Pending**. Nothing appears on the site. Then delete it.
8. Switch to **العربية**: everything mirrors and nothing is left in English, admin included.

## 11. Deploying this version through GitHub and Vercel

GitHub isn't linked to Claude, so you upload it. You have two options.

**Option A, the easiest for future updates: link GitHub once.** claude.ai → **Settings → Connectors → GitHub → Connect** → authorise `amalzdn4-debug`, including the repository **TRIPLAN.**. Then tell Claude "push it", and Claude can commit directly to `main`.

**Option B, upload the ZIP on github.com:**
1. **Back up the database first:** `DEPLOYMENT.md` → *Already live?* step 1 (Neon branch).
2. Unzip **`triplan-github-web-upload.zip`** and turn on hidden files (Mac: Cmd+Shift+. — Windows: View → Show → Hidden items).
3. github.com → your repository **TRIPLAN.** → **Add file → Upload files**. Drag in the **contents** of each numbered folder **in order**, one batch per commit (GitHub accepts at most 100 files per upload), with messages like `Improvements — part 1`. Files with the same name are replaced; nothing else is deleted.
4. Open **Actions** and wait for the ✅ (about 3 minutes). If it's red, copy the first red error line and send it to Claude.
5. Vercel deploys automatically after each commit. The last one (≈5–8 min including the import) is the one that counts. Check **Deployments** for **Ready**.
6. Add `CRON_SECRET` and the Blob store (section 9), then **Redeploy**.
7. Run the 10-minute check (section 10).

**Rollback:** Vercel → **Deployments** → the previous *Ready* deployment → **⋯ → Promote to Production**. The database changes are additive, so the old code runs fine on them.

---

### Maintenance notes
- The daily job keeps importing until every destination is done; after that it only refreshes failed ones and cleans up uploads.
- Review **/admin/moderation** weekly. Posts and comments with 3 reports hide automatically until you decide.
- Price changes in **/admin/pricing** apply to new purchases. Existing subscriptions keep their Stripe price; the Monthly trip allowance applies to everyone immediately.
- Keep CI green; update dependencies every few months.
