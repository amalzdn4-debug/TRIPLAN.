# Launching TRIPLAN online — Vercel + Neon

**Recommended hosting:** **Vercel** (made by the creators of Next.js, which TRIPLAN is built with) plus a **Neon** PostgreSQL database added through Vercel's built-in Neon integration. You don't need a domain, a paid plan or any API keys to get a first version online.

> Nothing here has been done for you yet. No Vercel project, database or domain exists. Follow these steps in order; allow about 30–45 minutes the first time. Button names in the Vercel and Neon dashboards change occasionally; if one differs slightly, look for the closest match.

**Before you start:** the code must be on GitHub (see `GITHUB_UPLOAD.md`), ideally with a ✅ green tick in the repository's **Actions** tab.

---

## Already live? Updating to the improvements release

Your site is already running (triplan-plum-five.vercel.app). This release adds database tables and columns, so take these steps **in this order**:

1. **Back up the database first (2 minutes).** Neon console (Vercel → Storage → your Neon database → *Open in Neon*) → **Branches → Create branch** → name it `backup-before-improvements`, parent `main`, *Current data* → **Create**. This is a full copy you can restore from (branches count toward your Neon plan's limits). Delete it after a few weeks once you're happy.
2. **Add the new settings** in Vercel → **Settings → Environment Variables** (Production, and Preview if you use it):
   - `CRON_SECRET` — any long random string (same generator as `AUTH_SECRET`). Turns on the daily job that imports destination content and removes abandoned photo uploads.
   - Optional now, recommended before inviting users: the **Blob store** for member photos (section *Member photo uploads* below).
3. **Put the new code on GitHub** (see `GITHUB_UPLOAD.md`). Vercel builds and deploys it automatically.
4. **What the deploy does by itself:** applies migrations `0003`–`0006` (each once, additive only: no table, row or column is deleted), adds the 295 new destinations, intercity connections and the **Monthly** plan, then imports Wikipedia/Wikimedia content for about 4 minutes. The daily job (and the **Import next batch** button in /admin/destinations) continues until all 351 destinations are done.
5. **Check:** the home page photo rotation, a destination page (e.g. `/en/destinations/porto` shows *Nearby*), `/en/pricing` (four plans), and `/en/admin` (Integrations shows what's switched on).

Your existing accounts, trips, posts and any prices you edited are kept. If anything looks wrong, use **Deployments → (previous one) → ⋯ → Promote to Production** to roll back the code instantly; the database changes are additive, so the old code keeps working with them.

---

## How the database works (summary)

| Question | Answer |
|---|---|
| Which variable does the app read? | **`DATABASE_URL`**, in `src/db/index.ts` (`process.env.DATABASE_URL`). |
| Other database variables? | **`DATABASE_URL_UNPOOLED`** (optional) is used only by the migration/seed scripts for a direct connection; they fall back to `DATABASE_URL`. The Neon integration creates **both automatically**. The `PG*` / `POSTGRES_*` variables it also adds are ignored. Optional: `DATABASE_POOL_MAX` (default 5). |
| Do I type the connection string anywhere? | **No.** The integration stores it in Vercel's encrypted Environment Variables. It is never in the code, on GitHub, or in any file you upload. |
| Pooled connections? | Neon's `DATABASE_URL` is a *pooled* connection (host contains `-pooler`). The app detects this and adjusts automatically; nothing to configure. |
| Migration steps? | **None by hand.** `vercel.json` makes every deployment run `npm run vercel-build` = **migrations → seed → `next build`**. Migrations are tracked in a `_migrations` table, so each runs once. The seed adds missing data (destinations, places, plans) but never overwrites prices or destinations you have edited in the admin area. |
| What if the database isn't connected? | The deployment stops with **"DATABASE_URL is not set"**, so a half-working site never goes live. |

---

## Step 1 — Create a Vercel account
1. Go to **https://vercel.com/signup**.
2. Choose **Continue with GitHub** and authorise Vercel. Your projects then connect to GitHub with no extra passwords.
3. Choose the free **Hobby** plan for now.

> **Important — Hobby is for non-commercial use only.** Vercel's own documentation says the Hobby plan is restricted to non-commercial, personal use and any commercial usage requires Pro. Testing and building TRIPLAN on Hobby is fine. **Upgrade to Pro (currently from about $20/month) before you switch on real payments or affiliate links**, i.e. before TRIPLAN earns money. Check https://vercel.com/pricing for current prices.

## Step 2 — Import the GitHub repository
1. In the Vercel dashboard click **Add New… → Project**.
2. Under **Import Git Repository**, find **`triplan`**. If it isn't listed, click **Adjust GitHub App Permissions** (or **Configure GitHub App**), give Vercel access to the `triplan` repository and return.
3. Click **Import**. Vercel detects **Next.js** automatically. Leave **Root Directory**, **Build Command** and **Output Directory** as they are: the project's `vercel.json` sets the build command.
4. Open **Environment Variables** on the same screen and add these three (the database comes in Step 3):

| Name | Value |
|---|---|
| `AUTH_SECRET` | A long random string, see below. **Required.** |
| `ADMIN_EMAILS` | The email address you'll sign up with, e.g. `you@example.com`. It becomes the admin account. |
| `NEXT_PUBLIC_SITE_URL` | Leave it out for now; you'll add it in Step 4 once you know your address. |

**Generating `AUTH_SECRET`** (any one way, then copy the output):
- **Mac (Terminal):** `openssl rand -base64 32`
- **Windows (PowerShell):** `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`
- Or use the password generator in your password manager (at least 40 random characters).

Never reuse it elsewhere and never put it in a file in the project.

5. Click **Deploy**. **This first deployment is expected to fail** with `DATABASE_URL is not set`, because there is no database yet. That's the safety check doing its job. Continue to Step 3.

## Step 3 — Add Neon through Vercel's integration and connect it
1. Open your **triplan** project in Vercel and click the **Storage** tab.
2. Click **Create Database** (or **Connect Store / Browse Marketplace**) and choose **Neon** (Serverless Postgres). Click **Continue**.
3. Accept Neon's terms. Then choose:
   - **Region:** the one closest to most of your visitors, e.g. **Europe (Frankfurt)** for Italy and Europe.
   - **Plan:** **Free** is enough to launch (no card required; storage is currently 1 GB per project).
   - **Database name:** `triplan`.
   Click **Create** / **Continue**.
4. In the **Connect Project** dialog, pick the `triplan` project and the environments:
   - ✅ **Production** — the live site. **Required.**
   - ✅ **Preview** — test deployments made from other Git branches. Recommended, **together with** the option to **create a database branch for each Preview deployment** if the dialog offers it. That gives every test deployment its own copy of the data, so tests and their migrations never touch your live database.
     *If no branching option is shown, untick Preview to keep test deployments away from live data.* They'll then fail with "DATABASE_URL is not set", which is harmless.
   - ☐ **Development** — only needed if you later run the site on your own computer with `vercel env pull`. Optional.
   - **Custom prefix:** type **`DATABASE`** (the box may suggest `STORAGE`). The app needs the variable to be called exactly `DATABASE_URL`, and this prefix produces `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
5. Click **Connect**.
6. Check it worked: **Settings → Environment Variables** now lists **`DATABASE_URL`** and **`DATABASE_URL_UNPOOLED`** (plus some `PG…` variables the app ignores), marked for the environments you chose. Values are hidden; you don't need to look at them.
7. Go to **Deployments**, open the failed deployment's **⋯** menu → **Redeploy**. This time the build log shows the migrations, then `Seed complete: 351 destinations…`, then the destination content import (`Content import: …`), then the Next.js build. When it says **Ready**, the site is live.

## Step 4 — Set the site address
1. Vercel gives you a free address like **`https://triplan-yourname.vercel.app`** (see **Domains** on the project page).
2. **Settings → Environment Variables → Add**: `NEXT_PUBLIC_SITE_URL` = that address (with `https://`, no trailing `/`), environment **Production**.
3. **Deployments → ⋯ → Redeploy**. (Variables only take effect on a new deployment.)

## Step 5 — Check that the live site works
1. Open your address. It should redirect to **`/en`** with the rotating destination photos.
2. Switch language to **العربية**. The layout should mirror right-to-left.
3. **Sign up** with the email you put in `ADMIN_EMAILS`.
   - Until email is set up (Step 7), the verification link isn't emailed. Find it in Vercel → your project → **Logs**, search for `verify-email`, and open that link.
4. **Plan a Trip → Fast Trip**, choose Rome and dates → you should get a day-by-day itinerary with a map.
5. Visit **`/en/admin`**. You should see the admin dashboard.
6. Visit **`/sitemap.xml`** and **`/robots.txt`**. Both should load.
7. If something fails: Vercel → **Deployments** (build errors) or **Logs** (errors while browsing). Copy the first red error line.

## Step 6 — Future updates are automatic
- Every push to the **`main`** branch on GitHub (Method B `git push`, or a web upload commit) makes Vercel **build and publish automatically**, including any new database migrations. This usually takes 2–4 minutes.
- Pushes to other branches create **Preview deployments** with their own test URL, so you can check a change before merging it into `main`.
- To undo a bad release: **Deployments** → pick the last good one → **⋯ → Promote to Production** (instant rollback).

## Step 7 — Connect a domain (later, when you have one)
1. Buy a domain from any registrar (or directly in Vercel → **Domains**).
2. Vercel → project → **Settings → Domains → Add** → type `yourdomain.com` and follow the DNS instructions shown (usually an **A** record for the root and a **CNAME** for `www`). HTTPS certificates are automatic.
3. Change `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com` and **Redeploy**.
4. Update the address anywhere else you registered it (Stripe webhook, Google sign-in redirect, Resend sending domain).

---

## Optional services (add when you're ready)

Add each variable in **Vercel → Settings → Environment Variables** (Production), then **Redeploy**. Mark secrets as **Sensitive** if offered.

| Feature | What you need | Variables |
|---|---|---|
| Real emails (verification, password reset, contact form) | Free **Resend** account + your own domain verified in Resend | `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `TRIPLAN <hello@yourdomain.com>`), `CONTACT_INBOX` |
| Payments (€2.99 trip, €6.99/month for 4 trips, €29.99/year) | **Stripe** account (verified business), **Vercel Pro** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, see below |
| Member photo uploads (community) | A **Vercel Blob** store connected to the project | `BLOB_READ_WRITE_TOKEN` (set automatically, see below) |
| Daily job (content import + cleanup) | Nothing extra | `CRON_SECRET` (any long random string) |
| Contact for Wikimedia's API policy | An email address that you read | `WIKIMEDIA_CONTACT` (falls back to `CONTACT_INBOX`) |
| "Continue with Google" | Google Cloud project with an OAuth client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| AI-assisted itineraries | Anthropic API key | `ANTHROPIC_API_KEY` (optional `AI_MODEL`) |
| Real travel times on legs | Google Maps Platform key with **Routes API** enabled and restricted to it | `GOOGLE_MAPS_API_KEY` |
| Map tiles for real traffic | A tile provider (e.g. MapTiler, Stadia Maps). OpenStreetMap's free tiles are for light use only | `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` |
| Affiliate commissions | Acceptance into each programme (Booking.com, GetYourGuide, Viator…) | None. Managed in **/admin/affiliates** (see below). The old `*_AFFILIATE_ID` variables are no longer used; delete them if you added any. |
| Footer social links | Real accounts only | `NEXT_PUBLIC_SOCIAL_INSTAGRAM`, `…_YOUTUBE`, `…_LINKEDIN`, `…_X` |

### Emails with Resend (verification, password reset, contact form)

Until this is set up the site says so honestly: members see "email verification isn't available yet, write to us", and the admin dashboard and **/admin/users** show a warning. Meanwhile you can verify people by hand with **Mark email as verified** in /admin/users (also for your own account).

1. You need your own domain first. Resend's test sender (`onboarding@resend.dev`) only delivers to the email address of your Resend account, so it can't serve real members.
2. Create an account at resend.com → **Domains → Add domain**. Enter your domain (or a subdomain such as `mail.yourdomain.com`).
3. Resend shows some DNS records (TXT and MX). Add them at the company where you bought the domain, exactly as shown, then click **Verify** in Resend. This can take from minutes to a few hours.
4. Resend → **API Keys → Create API key**, permission **Sending access**, restricted to your domain. Copy it straight away (it's shown once). Never paste it into code or GitHub.
5. Vercel → Settings → Environments → **Production** → add:
   - `RESEND_API_KEY` = the key (mark it **Sensitive**)
   - `EMAIL_FROM` = `TRIPLAN <no-reply@yourdomain.com>` — the domain must be exactly the one you verified
   - `CONTACT_INBOX` = an address you actually read (contact-form messages go there)
6. **Redeploy**. The warning disappears from /admin. Test it: sign up with a second email address of yours, or use "Forgot password", and check the inbox (and spam folder).

### Member photo uploads (Vercel Blob)
1. Vercel → your project → **Storage → Create Database → Blob** → name it `triplan-photos` → **Create**.
2. **Connect** it to the `triplan` project for **Production** (and **Preview** if you use previews). Vercel adds `BLOB_READ_WRITE_TOKEN` automatically. It's a server-only secret that is never sent to browsers.
3. **Redeploy.** The community "Share" form now shows **Add photos**. Before that, it honestly says photo uploads aren't enabled.
4. What happens to a photo: it's resized in the member's browser (longest side 2048 px), then the server checks it's a real JPEG/WebP of a sensible size, removes metadata such as GPS location, and stores it. Up to 6 photos per post, 4 MB each. Photos of deleted posts or accounts are deleted from storage; uploads never attached to a post are removed by the daily job after 24 hours.
5. Cost: Blob storage and transfer are billed by Vercel beyond the included allowance. Check **Usage** occasionally.

### Stripe setup (test mode first)
1. Start in **test mode**: set `STRIPE_SECRET_KEY` to your `sk_test_…` key. While a test key is set, the pricing and billing pages show a *test mode* notice, test payments are labelled **Test**, and the admin revenue figure excludes them.
2. Stripe Dashboard → **Developers → Webhooks → Add endpoint**: `https://YOUR-ADDRESS/api/stripe/webhook`. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
3. Copy the endpoint's **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, then **Redeploy**.
4. Stripe → **Settings → Billing → Customer portal** → activate it, allowing customers to **update payment methods**, **view invoices** and **cancel subscriptions** (at the end of the period). Members can also cancel or resume directly on their TRIPLAN billing page.
5. Test with card `4242 4242 4242 4242`, any future date and any CVC: buy a single trip, then the Monthly plan, create 4 trips and check that a 5th asks for payment, then cancel and resume. Access is granted only after Stripe's verified webhook arrives.
6. Prices come from the database and are editable in **/admin/pricing** (price, and trips per month for Monthly), so you don't create Products in Stripe. A price change applies to new purchases; existing subscriptions keep the price they were bought at.

### Stripe live mode: what's required before taking real payments
1. **Activate your Stripe account:** business type and details, a public business name and support contact, the bank account for payouts, and the identity verification Stripe asks for. Live keys only appear once this is complete.
2. **Vercel Pro**: Hobby doesn't allow commercial use.
3. **Legal pages complete and reviewed**: company details in `src/content/legal.ts`, the Subscription & Payment Policy (now including Monthly), refund/withdrawal wording for EU/UK consumers. Have a lawyer check them.
4. **Taxes:** decide with your accountant whether prices include VAT (the pricing page currently says they do) and whether to use **Stripe Tax**. Register for VAT/OSS where required.
5. In **live mode** in Stripe: create the **same webhook** (same URL and events) and copy its live `whsec_…`; activate the **Customer portal** again (live and test settings are separate); set your **statement descriptor**, brand colour and logo (Settings → Branding) and turn on **email receipts**.
6. In Vercel, replace `STRIPE_SECRET_KEY` with the **live** `sk_live_…` key (Sensitive) and `STRIPE_WEBHOOK_SECRET` with the live signing secret → **Redeploy**. The test-mode notices disappear.
7. Make **one real low-value purchase** (the €2.99 trip) with your own card, check it appears as *Paid* (not *Test*) on your billing page and in the admin revenue, then refund it from the Stripe dashboard.

### Affiliate partners (/admin/affiliates)
1. Apply to the programmes you want (e.g. Booking.com, GetYourGuide, Viator, a luggage-storage or eSIM provider). TRIPLAN doesn't apply for you and doesn't assume you're accepted.
2. When a programme accepts you, copy the **tracking link** it gives you (with your partner ID). In **/admin/affiliates → Add a partner**, paste it, adding placeholders where useful, e.g. `https://www.example-partner.com/search?aid=YOUR_ID&city={city}&checkin={checkin}&checkout={checkout}&adults={adults}`. Allowed placeholders: `{city} {country} {checkin} {checkout} {adults} {lat} {lng} {locale}`.
3. New partners start as **Pending**: nothing is shown to visitors. Click **Mark approved** only once the programme has actually accepted you. Approved partners appear first in the matching link groups (stays, flights, activities, transport, luggage) with a **Partner** label and the disclosure.
4. Clicks go through `/api/go/<name>` and are counted in the admin table (7 and 30 days, unique visitors). No IP addresses are stored. Commissions and payouts are only visible in each programme's own dashboard.
5. **Pause** hides a partner instantly; **Delete** removes it with its click history.

### Google sign-in setup
Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type *Web application*). Authorised redirect URI: `https://YOUR-ADDRESS/api/auth/google/callback`. Configure and publish the OAuth consent screen.

---

## Before a public launch — checklist
- [ ] Complete the legal templates in `src/content/legal.ts` (company name, address, contact email, governing law, affiliate programmes) **and have them reviewed by a lawyer**.
- [ ] Verify or edit the sample destination texts in `/admin/destinations` (they show an "Unverified" notice until then).
- [ ] Set up Resend so users receive verification and password-reset emails.
- [ ] Use a production map-tile provider.
- [ ] Upgrade Vercel to **Pro** before taking payments or affiliate commissions; switch Stripe to live mode (section above).
- [ ] Set `CRON_SECRET`, connect the Blob store, and check **/admin → Integrations**.
- [ ] Review the community guidelines and moderation queue (**/admin/moderation**) at least weekly.
- [ ] Submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console.

## Running the site on your own computer (optional, for developers)
```bash
npm install
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
npm run db:setup                  # creates a local embedded database in ./.data
npm run dev                       # open http://localhost:3000
```
No PostgreSQL installation is needed locally. To use the real Neon database locally instead, install the Vercel CLI and run `vercel env pull .env.local` (requires the **Development** environment ticked in Step 3).
