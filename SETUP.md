# Authsnap Grant Scout — Setup Guide

## What this is
A live grant scanning system that searches the web every Monday (and on demand) for funding opportunities matching Authsnap. No login required for end users.

## Architecture
```
GitHub Pages (index.html)
        ↕  fetch()
Cloudflare Worker (worker.js)   ← holds your API key securely
        ↕  API call
Anthropic Claude + Web Search
        ↕
GitHub Actions (cron Monday 9am)  ← triggers a refresh automatically
```

---

## Step 1 — Deploy the Cloudflare Worker (10 minutes, free)

1. Go to https://workers.cloudflare.com → Sign up free (no credit card needed)
2. Click **Create Application** → **Create Worker**
3. Name it: `authsnap-grant-scout`
4. Delete the default code, paste the entire contents of `worker.js`
5. Click **Deploy**
6. Go to **Settings → Variables** → Add:
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (from console.anthropic.com)
   - Click **Encrypt** then **Save**
7. Copy your worker URL — it looks like:
   `https://authsnap-grant-scout.YOUR-NAME.workers.dev`

---

## Step 2 — Update index.html with your Worker URL

In `index.html`, find this line near the top of the `<script>` section:

```js
const WORKER_URL = 'YOUR_WORKER_URL_HERE';
```

Replace `YOUR_WORKER_URL_HERE` with your actual Cloudflare Worker URL, e.g.:
```js
const WORKER_URL = 'https://authsnap-grant-scout.yourname.workers.dev';
```

---

## Step 3 — Push to GitHub Pages

1. Push `index.html` to your `denialrecovery/authsnap-grant-monitor` repo
2. GitHub Pages will serve it at `https://denialrecovery.github.io/authsnap-grant-monitor`

---

## Step 4 — Set up weekly auto-scan (GitHub Actions)

Your existing workflow file already runs every Monday at 9am. Update it to call your Worker:

```yaml
name: Weekly Grant Scan

on:
  schedule:
    - cron: '0 9 * * 1'   # Every Monday 9am UTC
  workflow_dispatch:        # Manual trigger button in GitHub

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger grant scan
        run: |
          curl -s -X POST "${{ secrets.WORKER_URL }}" \
            -H "Content-Type: application/json" \
            -d '{"category":"all","keywords":"","fundingMin":0,"existingIds":[]}' \
            | jq '.count'
          echo "Weekly scan triggered successfully"
```

Add `WORKER_URL` as a GitHub Actions secret (repo Settings → Secrets).

---

## Costs
- Cloudflare Workers free tier: 100,000 requests/day — more than enough
- Anthropic API: ~$0.10–0.30 per scan (Claude Sonnet + web search)
- GitHub Actions: free for public repos
- Total: essentially free except small Anthropic API usage

## API Key
Get your Anthropic API key at: https://console.anthropic.com
Cost per Monday scan: roughly $0.15–0.25
