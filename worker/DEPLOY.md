# Cloudflare Worker — Deployment Checklist

Follow these steps **once** on any machine to activate email notifications.

---

## Prerequisites

| Tool | Install command |
|------|----------------|
| Node.js ≥ 18 | https://nodejs.org |
| Wrangler CLI | `npm install -g wrangler` |
| Cloudflare account | https://dash.cloudflare.com (free tier is fine) |
| Resend account | https://resend.com (free tier sends up to 3 000 emails/month) |

---

## Step 1 — Get your Resend API key

1. Go to **https://resend.com/api-keys**
2. Click **Create API Key** → give it a name like `acrosscargo`
3. Copy the key — it starts with `re_` — you'll need it in Step 4.

> **Tip:** Also verify your sending domain in Resend (**Domains** tab) so emails land in the inbox, not spam.

---

## Step 2 — Log in to Wrangler

```bash
wrangler login
```

A browser window opens → authorise with your Cloudflare account.

---

## Step 3 — Edit `wrangler.toml`

Open `worker/wrangler.toml` and replace the placeholder with your real Firebase Hosting URL:

```toml
ALLOWED_ORIGIN = "https://your-actual-project.web.app"
```

Also update `FROM_EMAIL` if you want a different sender name/address:

```toml
FROM_EMAIL = "AcrossCargo <notifications@yourdomain.com>"
```

---

## Step 4 — Set the three secrets

Run these three commands from inside the `worker/` folder.  
Wrangler will prompt you to paste the value — it is **never** stored in any file.

```bash
cd worker

wrangler secret put RESEND_API_KEY
# Paste your re_... key from Step 1

wrangler secret put ADMIN_EMAIL
# Paste the email address that should receive AWB stock-low alerts
# e.g.  admin@acrosscargo.com

wrangler secret put WORKER_SECRET
# Paste any long random string — this is a shared password between
# the React app and the Worker.
# Generate one now:  openssl rand -hex 32
```

> Write down the `WORKER_SECRET` value — you'll need it again in Step 6.

---

## Step 5 — Deploy the Worker

```bash
# Still inside worker/
npm install
wrangler deploy
```

At the end you'll see a line like:

```
Published acrosscargo-notifications (x.xx sec)
  https://acrosscargo-notifications.<your-subdomain>.workers.dev
```

**Copy that URL.**

---

## Step 6 — Add the Worker URL to the React app

Open (or create) the file `.env` in the **root of the React project** (next to `package.json`) and add:

```env
VITE_WORKER_URL=https://acrosscargo-notifications.<your-subdomain>.workers.dev
VITE_WORKER_SECRET=<the same random string you set in Step 4>
```

> The `.env.example` file at the root shows the exact variable names to use.

---

## Step 7 — Rebuild & redeploy the React app

```bash
# From the React project root
npm run build
firebase deploy
```

---

## Verification

1. Create a test booking in the app.
2. Check the agent's email inbox — a confirmation email should arrive within a few seconds.
3. If nothing arrives, open the Cloudflare dashboard → **Workers** → **acrosscargo-notifications** → **Logs** to see any errors.

---

## Quick reference — re-deploying after code changes

```bash
cd worker
wrangler deploy
```

Secrets are stored in Cloudflare and survive redeployments — you only need to set them once.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| No emails, no Worker logs | `VITE_WORKER_URL` not set or app not rebuilt | Check `.env`, rebuild |
| Worker logs show `401` | `VITE_WORKER_SECRET` doesn't match `WORKER_SECRET` wrangler secret | Re-run `wrangler secret put WORKER_SECRET` with the same value |
| Worker logs show `422` from Resend | Sending domain not verified | Verify domain in Resend dashboard |
| CORS error in browser console | `ALLOWED_ORIGIN` in `wrangler.toml` doesn't match app URL | Update `wrangler.toml` and redeploy Worker |
