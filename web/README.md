# Chosy Landing Page

Static landing page for [chosyapp.com](https://chosyapp.com) — vanilla HTML + CSS, no framework.

**Local preview:** `npx serve web` or open `web/index.html` directly in a browser.

**Deploy:** Vercel project `chosy`, Git-connected to this repo, Root Directory `web`. Every push to `master` that touches `web/` deploys to production; other commits skip the build (Ignored Build Step).

**Domains:** `chosyapp.com` (DNS at Squarespace → Vercel), `www.chosyapp.com` 308 → apex. `chosy.vercel.app` 308-redirects to `chosyapp.com` via `vercel.json`, keeping path and `?ref=` query.
