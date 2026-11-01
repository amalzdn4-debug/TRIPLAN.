# Launching TRIPLAN online — Vercel + Neon

**Recommended hosting:** **Vercel** (made by the creators of Next.js, which TRIPLAN is built with) plus a **Neon** PostgreSQL database added through Vercel's built-in Neon integration. You don't need a domain, a paid plan or any API keys to get a first version online.

> Nothing here has been done for you yet. No Vercel project, database or domain exists. Follow these steps in order; allow about 30–45 minutes the first time. Button names in the Vercel and Neon dashboards change occasionally; if one differs slightly, look for the closest match.

**Before you start:** the code must be on GitHub (see `GITHUB_UPLOAD.md`), ideally with a ✅ green tick in the repository's **Actions** tab.

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
   - **Custom prefix:** leave it **empty**. The app needs the variable to be called exactly `DATABASE_URL`.
5. Click **Connect**.
6. Check it worked: **Settings → Environment Variables** now lists **`DATABASE_URL`** and **`DATABASE_URL_UNPOOLED`** (plus some `PG…` variables the app ignores), marked for the environments you chose. Values are hidden; you don't need to look at them.
7. Go to **Deployments**, open the failed deployment's **⋯** menu → **Redeploy**. This time the build log shows the migrations, then `Seed complete: 56 destinations…`, then the Next.js build. When it says **Ready**, the site is live.

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
| Payments (€2.99 trip, €29.99/year) | **Stripe** account (verified business), **Vercel Pro** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, see below |
| "Continue with Google" | Google Cloud project with an OAuth client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| AI-assisted itineraries | Anthropic API key | `ANTHROPIC_API_KEY` (optional `AI_MODEL`) |
| Real travel times on legs | Google Maps Platform key with **Routes API** enabled and restricted to it | `GOOGLE_MAPS_API_KEY` |
| Map tiles for real traffic | A tile provider (e.g. MapTiler, Stadia Maps). OpenStreetMap's free tiles are for light use only | `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` |
| Affiliate commissions | Approval from each programme (Booking.com, GetYourGuide, Viator…) | `BOOKING_AFFILIATE_ID`, `GETYOURGUIDE_PARTNER_ID`, `VIATOR_PARTNER_ID` |
| Footer social links | Real accounts only | `NEXT_PUBLIC_SOCIAL_INSTAGRAM`, `…_YOUTUBE`, `…_LINKEDIN`, `…_X` |

### Stripe setup
1. Start in **test mode**: set `STRIPE_SECRET_KEY` to your `sk_test_…` key.
2. Stripe Dashboard → **Developers → Webhooks → Add endpoint**: `https://YOUR-ADDRESS/api/stripe/webhook`. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
3. Copy the endpoint's **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, then **Redeploy**.
4. Stripe → **Settings → Billing → Customer portal** → activate it (lets customers cancel and update cards).
5. Test with card `4242 4242 4242 4242`, any future date and any CVC. Paid access is granted only after Stripe's verified webhook arrives.
6. Prices come from the database and are editable in `/admin/pricing`, so there's no need to create Products in Stripe.
7. When ready: switch to live keys, create a live webhook, upgrade Vercel to Pro.

### Google sign-in setup
Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type *Web application*). Authorised redirect URI: `https://YOUR-ADDRESS/api/auth/google/callback`. Configure and publish the OAuth consent screen.

---

## Before a public launch — checklist
- [ ] Complete the legal templates in `src/content/legal.ts` (company name, address, contact email, governing law, affiliate programmes) **and have them reviewed by a lawyer**.
- [ ] Verify or edit the sample destination texts in `/admin/destinations` (they show an "Unverified" notice until then).
- [ ] Set up Resend so users receive verification and password-reset emails.
- [ ] Use a production map-tile provider.
- [ ] Upgrade Vercel to **Pro** before taking payments or affiliate commissions; switch Stripe to live mode.
- [ ] Submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console.

## Running the site on your own computer (optional, for developers)
```bash
npm install
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
npm run db:setup                  # creates a local embedded database in ./.data
npm run dev                       # open http://localhost:3000
```
No PostgreSQL installation is needed locally. To use the real Neon database locally instead, install the Vercel CLI and run `vercel env pull .env.local` (requires the **Development** environment ticked in Step 3).
