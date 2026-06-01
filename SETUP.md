# Authsnap Grant Scout — Setup Guide

## Architecture
```
GitHub Pages (index.html)  ←  anyone visits this
        ↕  fetch()
Railway (server.js)         ←  you already have this!
        ↕  API call
Anthropic Claude + Web Search
        ↕
GitHub Actions (cron)       ←  Monday 9am auto-ping
```

---

## Step 1 — Add your Anthropic API key to Railway

1. Go to your Railway project dashboard
2. Click your service → **Variables** tab
3. Add new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from console.anthropic.com (starts with `sk-ant-...`)
4. Railway will automatically redeploy

---

## Step 2 — Deploy server.js to Railway

Your Railway project needs these files:
- `server.js`   ← the API server
- `package.json` ← tells Railway to run `node server.js`

Push both to whatever GitHub repo your Railway service is connected to, or drag-and-drop into Railway directly.

**Test it's working:**
Visit `https://your-railway-url.up.railway.app` in your browser.
You should see: `{"status":"ok","service":"Authsnap Grant Scout",...}`

---

## Step 3 — Get your Railway URL

1. In Railway → your service → **Settings** → **Domains**
2. Copy the URL (looks like `https://authsnap-grant-scout.up.railway.app`)

---

## Step 4 — Paste URL into index.html

Open `index.html`, find this near the top of the `<script>` section:

```js
const WORKER_URL = 'YOUR_RAILWAY_URL_HERE';
```

Replace with your Railway URL:
```js
const WORKER_URL = 'https://authsnap-grant-scout.up.railway.app';
```

Push the updated `index.html` to your GitHub Pages repo.

---

## Step 5 — Set up Monday auto-scan (GitHub Actions)

In your GitHub Pages repo:
1. Go to **Settings → Secrets and variables → Actions**
2. Add secret: `WORKER_URL` = your Railway URL

The `.github/workflows/weekly-scan.yml` file will then auto-ping your Railway server every Monday at 9am ET.

---

## Costs

| Service | Cost |
|---|---|
| Railway | Your existing plan |
| Anthropic API | ~$0.15–0.30 per scan |
| GitHub Actions | Free |
| GitHub Pages | Free |

New Anthropic accounts get $5 free credits — first ~20 scans are free.

Get your API key: https://console.anthropic.com

---

## Files in this repo

| File | Where it goes | Purpose |
|---|---|---|
| `index.html` | GitHub Pages repo | The front-end app |
| `server.js` | Railway repo | The API that calls Anthropic |
| `package.json` | Railway repo | Tells Railway how to run server.js |
| `.github/workflows/weekly-scan.yml` | GitHub Pages repo | Monday auto-scan |
| `SETUP.md` | Either | This guide |
| `worker.js` | ~~Not needed~~ | Cloudflare version — ignore |
