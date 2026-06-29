# ShopWatch — deploy + email alerts setup

This bundle contains the site (`index.html`) and a small backend (two Netlify
functions) that emails people when a wishlisted item hits the Fortnite shop.

## What's in here

```
index.html                       the app (already built)
netlify.toml                     Netlify config + the daily schedule
package.json                     declares the @netlify/blobs dependency
netlify/functions/alerts.mjs       receives signups, stores them
netlify/functions/daily-check.mjs  runs daily, matches the shop, sends emails
```

Storage uses **Netlify Blobs**, which is built into Netlify — no separate
database account. Email sending uses **Resend**, which has a free tier.

---

## Part 1 — Deploy the site to Netlify

You can deploy by dragging the folder into Netlify, but the email functions
need a Git-connected site to build properly, so use the Git route.

1. Put this whole folder in a Git repository (GitHub is easiest). Create a repo,
   then from inside this folder:
   ```
   git init
   git add .
   git commit -m "ShopWatch"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. Go to https://app.netlify.com → **Add new site** → **Import an existing
   project** → connect GitHub → pick your repo.

3. Build settings: leave the build command empty, set **Publish directory** to
   `.` (a single dot). Netlify reads the rest from `netlify.toml`. Click
   **Deploy**.

4. After it deploys you'll get a URL like `https://your-name-123.netlify.app`.
   Open it — the shop should load. (Email isn't active yet; that's Part 3.)

---

## Part 2 — Turn on email sending (Resend)

1. Sign up at https://resend.com (free tier is fine).

2. Easiest path: in Resend, use their shared test/onboarding sender to start.
   For real delivery to any address, add and verify a domain you own (Resend →
   **Domains** → add domain → add the DNS records they give you). Until a domain
   is verified, Resend only lets you send to your own verified address — good
   enough for testing.

3. Resend → **API Keys** → create one → copy it (starts with `re_`).

---

## Part 3 — Connect the keys to Netlify

In Netlify: your site → **Site configuration** → **Environment variables** →
add two:

| Key              | Value                                                        |
|------------------|-------------------------------------------------------------|
| `RESEND_API_KEY` | the `re_...` key from Resend                                 |
| `ALERT_FROM_EMAIL` | the sender, e.g. `ShopWatch <alerts@yourdomain.com>`      |

If you haven't verified a domain yet, set `ALERT_FROM_EMAIL` to the onboarding
sender Resend shows you (often `onboarding@resend.dev`).

Then trigger a redeploy (Netlify → **Deploys** → **Trigger deploy** →
**Deploy site**) so the functions pick up the variables.

---

## Part 4 — Point the site at its own backend

One line in `index.html`. Find:

```js
const ALERTS_API = '';
```

Change it to:

```js
const ALERTS_API = 'same-origin';
```

Commit and push — Netlify redeploys automatically. Now the "Save Email" button
on the Alerts tab actually registers the person.

---

## How it runs

- When someone enters their email on the Alerts tab, the page POSTs their email
  + wishlisted item ids to `/api/alerts`, which stores one record per email in
  Netlify Blobs.
- Every day at 00:10 UTC (just after the shop resets), `daily-check` pulls the
  shop, compares today's item ids against every stored wishlist, and emails
  anyone with a match.

## Testing the daily check without waiting

Netlify → **Functions** → `daily-check` → **Run now**. It will check the current
shop against stored signups and send immediately. Use this to confirm email
works end to end: add your own email with a wishlisted item that's in the shop
today, then Run now.

## Costs

- Netlify free tier: enough for a personal project (functions + Blobs included).
- Resend free tier: a few thousand emails/month.
- fortnite-api.com: free, no key needed for the shop endpoint.

## Notes / limits

- Scheduled functions only run on the **published** (production) deploy, not on
  deploy previews.
- The signup stores a snapshot of the wishlist at save time. If someone changes
  their wishlist later, they should hit "Save Email" again to update it. (Adding
  auto-resync on every wishlist change is a possible later improvement.)
- There's no unsubscribe link yet. If you make this public, add one before
  sharing widely — happy to build it.
