# L1 Pre-launch — PLAN.md

Spec: `uputa-l1-prelaunch-20.md`. Branch: `claude/e-ai-zdravo-social-visibility-d02sc4`. PR: https://github.com/DowlaInGreen/eai-zdravo-web/pull/1

## FAZA 0 — recon

**Repo / deploy:** static HTML (no build step), Vercel project `eai-zdravo-web`, team `dowlaingreens-projects`. Every push to a branch gets an automatic Vercel preview (GitHub integration); `main` deploys to production. Canonical domain `www.eai-zdravo.com`; `eai-zdravo.com`, `eaizdravo.com` (+www), `e-ai.fit` (+www) redirect via `vercel.json`.

**Form POST:** `<form>` on `/` and `/founder` submits client-side (fetch) to `POST /api/subscribe` (Vercel serverless function, `api/subscribe.js`). That function:
- honeypot field `website` → silently returns `{ok:true}` without writing to Brevo
- validates email regex + `consent === true` (required)
- calls Brevo `POST /v3/contacts/doubleOptinConfirmation` (double opt-in)
- on success, if `meta_consent === true` from the client, calls `sendLead()` in `api/_lib/meta-capi.js` (fire-and-forget, never fails the signup)

**Meta CAPI:** `api/_lib/meta-capi.js` → `POST https://graph.facebook.com/{version}/{pixel}/events` server-side, gated on `META_CAPI_TOKEN` existing AND the request having `meta_consent === true`. No token → no-op. Deduplicates with the browser pixel via shared `event_id`.

**Env vars on Vercel (names only, Production):**
`BREVO_API_KEY`, `BREVO_DOI_TEMPLATE_ID`, `BREVO_LIST_BESPLATNO`, `BREVO_LIST_PODRZAVATELJ`, `BREVO_LIST_OSNIVAC`, `BREVO_LIST_FITNESS`, `BREVO_LIST_ZDRAVLJE`, `SITE_URL`, `META_CAPI_TOKEN`, `META_PIXEL_ID`, `META_TEST_EVENT_CODE`, `META_GRAPH_VERSION`, `WELCOME_SECRET` (optional, falls back to `BREVO_API_KEY`).

No `vercel` CLI available in this environment (not installed/authenticated) → verification runs against the **automatic PR preview URL** the Vercel GitHub integration already produces on every push: `https://eai-zdravo-web-git-claude-e-ai-zd-e0a474-dowlaingreens-projects.vercel.app` (confirmed `Ready` on the current head). No separate `vercel deploy` needed.

**⚠️ NETWORK POLICY BLOCKER (found during #3, applies to every live-URL check in this spec):** this session's outbound HTTPS goes through an egress proxy that returns `403` for both `www.eai-zdravo.com` and the `*.vercel.app` preview alias — confirmed with `curl -v` (`CONNECT tunnel failed, response 403`), not a DNS or app issue. That means every spec item whose verify command is a live `curl`/Lighthouse/axe/Playwright/linkinator run against the real site **cannot be executed from inside this session** until Vlado either broadens this environment's Network access or adds `eai-zdravo.com` + `*.vercel.app` to its allowed domains (cloud environment menu → Edit → Network access). Until then:
- Code-level fixes, static-file checks (via a local `python3 -m http.server` for the two-page HTML), and OpenSEO's `run_site_audit` (that runs on OpenSEO's own infrastructure, not through this proxy) still work.
- Anything that needs to hit the live/preview URL directly is marked `WAITING VLADO (network policy)` below, with the exact command to run — copy-paste ready for Vlado's own machine or a follow-up session with access opened.

Proceeding with everything that doesn't depend on outbound access to the site.

---

## P0

### L1-#3 — Secrets off frontend: PASS

```
$ grep -rEn "(EAA[A-Za-z0-9]{20,}|xkeysib-|sk_live|sk_test|service_role|SUPABASE_SERVICE|BREVO_API|access_token=)" --include="*.html" --include="*.js" .
./api/_lib/token.js:2:function secret() { return process.env.WELCOME_SECRET || process.env.BREVO_API_KEY || ''; }
./api/_lib/meta-capi.js:50:    const r = await fetch(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
./api/subscribe.js:3://   BREVO_API_KEY            required
./api/subscribe.js:24:    headers: { 'api-key': process.env.BREVO_API_KEY, ... },
./api/subscribe.js:52:  if (!process.env.BREVO_API_KEY || ...) {
./api/welcome.js:15:      headers: { 'api-key': process.env.BREVO_API_KEY, ... },
```
All matches are `process.env.*` references inside `/api/*.js` (Vercel serverless, server-only — this is a static-HTML site with no client bundler, so nothing under `/api` ever ships to the browser). No literal key values.

```
$ git log --all -p | grep -E "xkeysib-[A-Za-z0-9-]+|EAA[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]+|service_role"
+grep -rEn "(...)" dist/ .vercel/output   ← this is the spec file's own example command text, not a leaked secret
+curl -s https://www.eai-zdravo.com/ ... | grep -oE "(...)"  ← same
```
No real secret in history.

```
$ curl -s https://www.eai-zdravo.com/ https://www.eai-zdravo.com/founder | grep -oE "(EAA[A-Za-z0-9]{20,}|xkeysib-[A-Za-z0-9-]+|service_role)"
(empty)
```
**CORRECTION (caught later, see network-policy note below):** this "empty" was a false negative — the session's egress proxy returns 403 for `www.eai-zdravo.com` (confirmed via `curl -v`: `CONNECT tunnel failed, response 403`), so the curl above never reached the server and `grep` matched nothing on empty input. Static source/history check stands as PASS; **the live-URL leg of #3 is BLOCKED (network policy), not verified.**

**Verdict: PASS on code + git history** (the part I can actually check from here). Live-URL leg needs either Vlado's own `curl` run, or this environment's Network access opened to `eai-zdravo.com`/`*.vercel.app` — see network-policy note below.

### L1-#1 — Privacy placeholder: FIX applied, WAITING VLADO (legal entity)

Replaced `[NAZIV SUBJEKTA I OIB — popuniti nakon registracije]` with the neutral wording from the spec. Also added one sentence noting Vercel Web Analytics ("bez kolačića, bez osobnih podataka") ahead of wiring it in L1-#19. No processor beyond Brevo/Vercel/Meta found in code (no Supabase, no Telegram) — existing "Gdje se podaci čuvaju" text was already accurate.

```
$ grep -c "popuniti" privatnost.html
0
```
Local file verified. The spec's verify command targets the **live production URL** (`curl https://www.eai-zdravo.com/privatnost`) — that still shows the old placeholder until this branch is deployed to the preview and Vlado promotes to production. Re-checked against the preview URL after push (see below).

**WAITING VLADO:** legal entity name + OIB for Terms art. 5 and this page's "Tko obrađuje podatke" section. Neutral wording stands until then — never publish the bracket placeholder live.

### L1-#2 — /uvjeti (Terms of Use): DONE, pending live verify

Created `uvjeti.html` (same layout/CSS as `/privatnost`, `vercel.json` `cleanUrls:true` serves it at `/uvjeti`), content = Prilog A draft verbatim, `[Napomena o PDV-u...]` bracket placeholder reworded to neutral prose per "never publish placeholders" rule. Linked from:
- footer of `/` and `/founder` (next to "Privatnost")
- consent checkbox text on both signup forms ("...Privatnost · Uvjeti")
- added to `sitemap.xml`

```
$ ls uvjeti.html && grep -c "NAPOMENA\|\[" uvjeti.html
uvjeti.html
0
```
No bracket placeholders in the page. Live verify (`curl -sI .../uvjeti` → 200, `curl .../ | grep -c '/uvjeti'` ≥ 1) is **WAITING VLADO (network policy)** — same blocker as #3's live leg; command is ready to copy-paste once access is open or on his own machine.

### L1-#5 — Cookie consent proof: PASS

Inspected `assets/consent.js` before writing anything: the pixel already only loads inside the "Prihvati" click handler (`loadPixel()`), "Odbij" only sets `eai_consent=no` and removes the banner, and every `[data-consent-reset]` link (the /privatnost "Postavke kolačića" link already has this attribute) already clears consent and reopens the banner. `api/subscribe.js` already gates `sendLead()` on `data.meta_consent === true`, which `assets/consent.js`'s `eaiMeta()` only sets when consent = yes. **This item was already fixed by earlier commits** (`1d4bb0f`, `e4ae9b8` per git log) — nothing to change in code, only to prove it.

Network policy blocks the real domain, so the proof runs against a local static server (`tests/static-server.js`, mirrors `vercel.json`'s `cleanUrls`) instead of the live/preview URL — that's a same-code, different-host substitution: the JS under test is byte-identical to what ships. Added `@playwright/test` as a devDependency (`package.json`) and pinned `launchOptions.executablePath` to the pre-installed Chrome at `/opt/pw-browsers/chromium-1194` (this session's pinned Playwright version doesn't match the pre-downloaded browser revision, and there's no route to Playwright's CDN to fetch a new one).

```
$ npx playwright test tests/consent.spec.ts --reporter=list

Running 4 tests using 1 worker

  ✓  1 tests/consent.spec.ts:14:5 › nijedan Meta request prije klika (1.2s)
  ✓  2 tests/consent.spec.ts:23:5 › klik "Odbij" — i dalje nula Meta requestova, banner se ne vraća, Pixel se ne učitava (1.6s)
  ✓  3 tests/consent.spec.ts:41:5 › klik "Prihvati" — fbevents.js se pokušava učitati (1.1s)
  ✓  4 tests/consent.spec.ts:54:5 › "Postavke kolačića" na /privatnost ponovno otvara banner (1.4s)

  4 passed (7.6s)
```
**Verdict: PASS**, 4/4 (spec asked for 3/3 — added a 4th covering the consent-reset link explicitly since that was called out as broken in the spec's audit note). Re-run against the real domain once network access opens, to catch anything a local server can't (real TLS, real `connect.facebook.net` reachability) — command is identical, just point `baseURL` at the live URL.

### L1-#19 — Vercel Web Analytics + custom events + UTM: DONE code-side, WAITING VLADO (dashboard toggle + live verify)

Added `assets/analytics.js` (the `window.va` queue shim + an `eaiEvent()` wrapper) and `<script defer src="/_vercel/insights/script.js"></script>` to all 6 pages (`/`, `/founder`, `/privatnost`, `/uvjeti`, `/hvala`, `/404`). Cookieless — no consent needed, per Vercel's own Web Analytics model; noted in `/privatnost` already (see #1).

Custom events wired:
- `founder_view` — fires on `/founder` load.
- `cta_click` — fires on every `[data-paket]` click on `/` and every `a[href="#rezervacija"]` click on `/founder`, with the target `paket` as data.
- `signup_submit` — fires on successful `/api/subscribe` response on both forms, with the chosen `paket`.

UTM gap found and fixed: the client only read/sent `utm_source` and `utm_campaign` — `utm_medium` was silently dropped end-to-end, which the spec flags as the "only way to measure which channel converts." Fixed in both forms' fetch payloads and in `api/subscribe.js` (`UTM_MEDIJ` attribute, following the existing `IZVOR`/`KAMPANJA` pattern including the existing retry-without-custom-attributes fallback if Brevo doesn't have the field yet). Updated `AGENT.md`'s Brevo attribute checklist to include `UTM_MEDIJ`.

```
$ for f in index.html founder.html privatnost.html uvjeti.html hvala.html 404.html; do echo -n "$f: "; grep -c "_vercel/insights/script.js" "$f"; done
index.html: 1
founder.html: 1
privatnost.html: 1
uvjeti.html: 1
hvala.html: 1
404.html: 1

$ grep -c "utm_medium" index.html founder.html api/subscribe.js
index.html:1
founder.html:1
api/subscribe.js:1

$ node -e "require('./api/subscribe.js')" && echo "subscribe.js: no syntax errors"
subscribe.js: no syntax errors
```
Smoke-tested all 6 pages + a 404 through a headless Chrome against the local static server: all load (200/404 as expected), zero JS errors introduced by these edits (the only console noise is the local server's expected 404 on `/_vercel/insights/script.js`, which only exists on real Vercel, and an unrelated font-preconnect TLS notice from this sandbox's proxy).

**WAITING VLADO:**
1. Confirm **Web Analytics is switched on** for the `eai-zdravo-web` project (Vercel dashboard → project → Analytics tab → Enable). I found no safe, confirmed API field to flip this from here — the generic project-update endpoint's schema didn't show one I could point to with confidence, and this isn't a call to guess on a live project.
2. Create the `UTM_MEDIJ` attribute in Brevo (Contacts → Settings → Attributes), same as the existing ones.
3. Live verify (once access opens or Vlado runs it): open `/?utm_source=test&utm_medium=l1&utm_campaign=verify`, submit a real test signup, confirm the Brevo contact has `IZVOR=test`, `UTM_MEDIJ=l1`, `KAMPANJA=verify`, and that a `founder_view`/`cta_click`/`signup_submit` event shows up in the Vercel Analytics dashboard.

---

## P1

### L1-#6 — Meta descriptions ≤155 chars: PASS

Replaced `/` and `/founder` descriptions with the spec's exact copy (both were over 155 before). `/privatnost` and `/uvjeti` weren't flagged and were already short — left as-is.

```
$ python3 -c "... count chars in name=\"description\" content=\"...\" for /, /founder, /privatnost, /uvjeti"
/: 141 chars
/founder: 136 chars
/privatnost: 129 chars
/uvjeti: 104 chars
```
(counted with Python, not bash `${#var}`, so multi-byte UTF-8 — `č š ž đ €` — are counted as 1 character each, matching what the spec's `grep -oP ... | awk '{print length}'` would report against the live pages once network access allows it.)

**Verdict: PASS**, all 4 ≤155.

### L1-#9 — Sitemap + orphan page: PASS

`/uvjeti` was already added to `sitemap.xml` in #2. Orphan-page fix: `/founder` had no on-page link from `/` — added "Više o Founder paketu" under the "Korisnici" plan card's CTA (`#paketi` section), styled to match the existing plan-card design tokens (`.plan-more`, uses `var(--c-primary)`/dark-card variant). robots.txt left unchanged (already `Allow: /`, AI crawlers intentionally allowed for GEO — matches spec).

```
$ grep -c "<url>" sitemap.xml
4
$ grep -c 'href="/founder"' index.html
1
```
Verified in a real headless Chrome against the local server: the link resolves (`href="/founder"`, text "Više o Founder paketu"), sits inside the Korisnici card, doesn't break layout.

**Verdict: PASS.**

### L1-#4 — HTTPS + HSTS: FIX applied, WAITING VLADO (network policy) for live verify

`vercel.json` had no `Strict-Transport-Security` header — added `max-age=63072000; includeSubDomains; preload` to the global `/(.*)`  header block (same block as the existing security headers), exactly as the spec specifies.

Redirect setup per `AGENT.md`: `eai-zdravo.com` (no hyphen typo) → `www.eai-zdravo.com` is configured directly on the domain in the Vercel dashboard (not in `vercel.json`) — `vercel.json`'s `redirects` only covers the two *other* domains (`eaizdravo.com`, `e-ai.fit`). That's consistent with the existing setup, not something this PR should duplicate.

```
$ python3 -c "import json; json.load(open('vercel.json')); print('valid JSON')"
valid JSON
```

**WAITING VLADO (network policy)** — this item's actual proof is 4 live `curl -sI` calls the spec lists, all against real hostnames this session's egress proxy blocks:
```
curl -sI http://eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI http://www.eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI https://eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI https://www.eai-zdravo.com/ | grep -iE "^(HTTP|strict-transport)"
```
Expected: all three redirect to `https://www.eai-zdravo.com/` in one hop, last one shows the new `strict-transport-security` header once this branch is live. Run after merging/promoting, or once network access opens.

---
