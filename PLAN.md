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

### L1-#15 — Custom 404: PASS

`404.html` already existed with `<meta name="robots" content="noindex">` and the shared header/style — that part of the spec's audit was already satisfied. Updated the copy to the spec's exact wording (was generic "Možda je link zastario") and added the second CTA to the free-books anchor.

```
$ curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8123/nepostoji   # local server mirrors Vercel's 404.html convention
404
$ curl -s http://127.0.0.1:8123/nepostoji | grep -c "ne postoji"
2
$ curl -s http://127.0.0.1:8123/nepostoji | grep -c 'name="robots" content="noindex"'
1
```
Live equivalent (`curl -s -o /dev/null -w "%{http_code}\n" https://www.eai-zdravo.com/nepostoji` → 404, `curl .../nepostoji | grep -c "ne postoji"` ≥ 1) is **WAITING VLADO (network policy)**, same blocker as above — Vercel's static-404 behavior is well-documented platform behavior, not something this change affects.

**Verdict: PASS** (code + local-serve proof); live proof pending network access.

---

### L1-#16 — Broken links + `href="#"` cleanup: PASS

```
$ grep -n 'href="#"' *.html
privatnost.html:30:<p>Privolu možeš povući u bilo kojem trenutku: <a href="#" data-consent-reset>Postavke kolačića</a>.</p>
```
Only one bare `href="#"` on the whole site, and it's the "Postavke kolačića" link the spec's own audit flagged as dead — it already has a working `data-consent-reset` click handler (proven in #5's Playwright test, which clicks exactly this link and asserts the banner reopens). Nothing to change.

```
$ npx linkinator http://127.0.0.1:8123 --recurse --skip "fonts.googleapis.com,fonts.gstatic.com,instagram.com,connect.facebook.net,facebook.com,_vercel,www.eai-zdravo.com"
...
✓ Successfully scanned 18 links in 0.136 seconds.
```
Ran against the local server (real domain excluded — network policy). 0 broken internal links, matching the spec's own audit finding. Absolute links to `www.eai-zdravo.com` (canonical tags, `og:url`, `og:image`) can't be crawled from here; they're plain static strings, not generated, so there's nothing code-side left to check once network access opens.

**Verdict: PASS.**

### L1-#17 — Form validation: FIX applied, PASS

Inspected first: `type="email"` + `required` already on both forms' email input, checkbox `required` already there, Croatian error copy already there client- and server-side, submit button already disables synchronously on submit and re-enables in `.finally()`.

Two real gaps found and fixed in `api/subscribe.js`:
- Overlong email (>254 chars) was silently **truncated** then validated — a malformed-but-truncated string could pass the regex. Now rejected outright before truncation, same error message.
- `name` wasn't stripped of HTML tags before being stored as the Brevo `FIRSTNAME` attribute. Added `.replace(/<[^>]*>/g, '')`.

```
$ node -e "const longEmail='a'.repeat(250)+'@x.co'; console.log(longEmail.length, '>254?', longEmail.length>254)"
255 >254? true
$ node -e "console.log('<script>alert(1)</script>Ana'.replace(/<[^>]*>/g,'').trim().slice(0,80))"
alert(1)Ana
```

Added `tests/form-validation.spec.ts` (4 cases, matching the spec's list) against the local server:
```
$ npx playwright test tests/form-validation.spec.ts --reporter=list

  ✓  1 prazan email — odbijeno, poruka na hrvatskom (2.8s)
  ✓  2 nevaljan email "abc@" — odbijeno (2.2s)
  ✓  3 bez checkboxa privole — odbijeno (2.1s)
  ✓  4 dvoklik na submit — samo jedan POST (gumb disabled dok traje) (3.0s)

  4 passed (11.1s)
```
The double-click case mocks `/api/subscribe` (no real Brevo call from this sandbox) and counts requests, holding the mocked response open 300ms to force a race — only 1 request ever lands, proving the synchronous `btn.disabled=true` guard actually dedupes rather than just looking right.

**Verdict: PASS**, 4/4.

### L1-#18 — Spam protection: FIX applied, PASS

Honeypot already existed and already returns a silent 200 without a Brevo write (verified below). Added the two missing pieces from the spec:
- **Minimum fill time**: both forms now send `loaded_at` (captured at script init, not at submit); the server rejects (silently, 200, like the honeypot — no point tipping off a bot that the check exists) anything submitted <2s after load.
- **Rate limit**: `api/_lib/rate-limit.js`, in-memory, 5 requests / IP / 10 min, 429 after that — explicitly the spec's "Vercel KV ili in-memory za početak" option. Documented caveat in the file itself: serverless instances aren't guaranteed warm/shared, so this throttles a burst on one warm instance, it isn't a hard global cap — move to Vercel KV if real abuse shows up.

This session can't run the spec's live curl loop against the real endpoint (network policy), so the same assertions run by calling the handler directly with a mocked Brevo `fetch` and fake req/res — same code, same 5-pass/429-after sequence, just in-process instead of over HTTP:

```
$ node tests/rate-limit.check.js
PASS — honeypot filled -> silent 200, no Brevo call
PASS — submitted <2s after load -> silent 200, no Brevo call
rate-limit sequence: 200 200 200 200 200 429 429
PASS — first 5 requests from one IP pass (200)
PASS — 6th and 7th request from same IP -> 429
```

Re-ran the full Playwright suite after wiring `loaded_at` into both forms' client JS to confirm nothing broke:
```
$ npx playwright test --reporter=list
  8 passed (11.6s)
```

**WAITING VLADO (network policy)** — the spec's own live-curl-loop verify (7× `curl -X POST <form_endpoint>`, expect 200×5 then 429×2) is ready to run once access opens or on Vlado's machine; identical behavior to the in-process check above.

**Verdict: PASS** (code + in-process proof).

### L1-GEO — Schema + llms.txt: PASS

Per the spec's own note, this was mostly already done in earlier commits (before this L1 pass): Organization/WebSite/FAQPage on `/` (HowTo added earlier today, see #5's session), Organization/Product+Offer/FAQPage on `/founder`, `/llms.txt` + `/llms-full.txt` live. Verified rather than rebuilt, and filled two gaps against the spec's exact ask:
- `llms.txt` didn't state the 3 key facts as a distinct list (14 obroka/2 kuhanja, daily HR chain prices, ~23 g protein/€) or link `/uvjeti` (didn't exist yet when it was written) — added both.
- `llms-full.txt` was missing a plain page-link list — added.

```
$ python3 -c "... validate + list @graph @type for index.html and founder.html"
index.html -> valid JSON, 4 items: ['Organization', 'WebSite', 'FAQPage', 'HowTo']
founder.html -> valid JSON, 3 items: ['Organization', 'Product', 'FAQPage']

$ for f in index.html founder.html; do echo -n "$f: "; grep -c 'application/ld+json' "$f"; done
index.html: 1
founder.html: 1
```
Both `≥ 1` JSON-LD block per page, both parse as valid JSON. Google Rich Results Test (needs to fetch the live URL) is **WAITING VLADO (network policy)** — code is unchanged from what a JSON-LD validator would see, so no surprises expected, but only a live fetch proves it.

**Verdict: PASS** (schema + llms.txt content); live Rich-Results screenshot pending network access.

### L1-#12/13/14 — Speed, contrast, mobile: mostly PASS, one real finding for Vlado

Ran Lighthouse mobile against the local server (real domain blocked by network policy — **numbers below are directional, not the production numbers**: no real TLS handshake, no CDN edge latency, no real font-loading round trip, all of which only exist on the live domain and only push these numbers down, never up).

```
$ CHROME_PATH=.../chrome npx lighthouse http://127.0.0.1:8123/ --form-factor=mobile --throttling-method=simulate --only-categories=performance,accessibility,seo,best-practices ...
out/lh-home.json     { performance: 93, accessibility: 97, best-practices: 96, seo: 100 } LCP 2.48s CLS 0
out/lh-founder.json  { performance: 99, accessibility: 100, best-practices: 92, seo: 100 } LCP 1.54s CLS 0
```
Home's LCP (2480ms) clears the spec's <2.5s target by only 19ms **on a local server with zero network latency** — this is the one number I'd flag as at real risk on production and worth Vlado re-running live before calling it done. Everything else clears its target with real margin (Performance ≥90, Accessibility ≥95, SEO 100, CLS 0).

axe-core WCAG2AA: `@axe-core/cli` itself reaches out to `googlechromelabs.github.io` to resolve a Chrome build (blocked by network policy) — ran `axe-core` directly against the pinned Chrome via Playwright instead (`tests/axe.check.js`), same engine and ruleset, no CLI wrapper.

First pass (page load, no settle time) showed violations on the hero lead, hero note, and primary CTA button — all with real design-token colors (`--c-muted` alone is documented in the CSS as 6.1:1) that don't match what axe measured. These are `[data-hero]`/`[data-reveal]` elements with a JS entrance animation (fade/slide on load); axe was catching them mid-transition. Re-ran with a 2s settle wait:

```
$ node tests/axe.check.js
=== / ===
violations (all): 1 | serious/critical: 1
  [serious] color-contrast: Elements must meet minimum color contrast ratio thresholds (9 node(s))
=== /founder ===
violations (all): 0 | serious/critical: 0
TOTAL serious/critical violations: 1
```
The hero/CTA false positives are gone. What's left is real and narrower: the 3 scroll-story steps (`article[data-step="1/2/3"]`, the "Kako radi" 4-step visual) sit at `opacity:.3` until the user scrolls to them — by design, that's the reveal effect (commit `dac1f8c`). At 0.3 opacity the effective blended color fails contrast (ratios 1.5–1.9 against a 3:1/4.5:1 requirement); once a step becomes `.on` (opacity 1) it's fine, and `prefers-reduced-motion` users already get `opacity:1` on all steps permanently (existing CSS: `html:not(.js-story) .story-step{opacity:1}`).

I didn't touch this: raising the inactive-step opacity enough to pass contrast (roughly 0.3 → ~0.6+) would visibly dull the reveal effect this feature was built for — that's a design tradeoff, not a color-picking bug, and outside "popravi samo boje" without a design call.

**WAITING VLADO:** pick one for the 3 scroll-story steps — (a) raise inactive-step opacity to whatever still passes contrast (I can compute and ship the exact value once you say go), or (b) leave as-is, since screen readers read the text regardless of opacity and reduced-motion users already see full contrast — this only affects sighted, motion-enabled users who haven't scrolled to a step yet, and self-corrects the moment they do.

Manual checks skipped for the same reason as everything else here (no live URL): iPhone SE (375px) horizontal-scroll check, CTA tap-target height — these are unchanged from before this PR touched anything, so no regression risk, but worth Vlado's 60-second manual pass on the promoted preview.

**Verdict:** PASS on Performance/SEO/Best-Practices/CLS, PASS on accessibility except the one flagged design tradeoff above, LCP flagged as at-risk pending a live re-run.

---

## P2

### L1-#8 — Favicon set: FIX applied, PASS

`favicon.ico` (has both 16×16 and 32×32 in one file), `favicon-32.png`, `apple-touch-icon.png` (180×180, correct convention size) all already existed and were linked on every page. Missing: `site.webmanifest`. Created it (`name`/`short_name` "E-AI zdravo", icons 192/512, `theme_color` #FFFFFF matching the rest of the site) and linked `<link rel="manifest">` on all 6 pages.

```
$ python3 -c "import struct; ..." # apple-touch-icon.png, icon-192.png, icon-512.png, icon-96.png
apple-touch-icon.png: 180 x 180
icon-192.png: 192 x 192
icon-512.png: 512 x 512
icon-96.png: 96 x 96

$ python3 -c "import json; json.load(open('site.webmanifest')); print('valid JSON')"
valid JSON

$ for f in index.html founder.html privatnost.html uvjeti.html hvala.html 404.html; do grep -c 'rel="manifest"' "$f"; done
1 1 1 1 1 1
```
Live verify (`curl -sI https://www.eai-zdravo.com/favicon.ico` → 200) is **WAITING VLADO (network policy)** — file already existed and is unchanged, so no risk expected.

**Verdict: PASS.**

### L1-#7 — Social preview: FIX applied, PASS (one item WAITING VLADO — needs a design asset)

```
$ python3 -c "import struct; ..." # assets/og.png
1200 x 630, 136284 bytes (<300 KB target)
```
Already correct. Added the missing meta on both `/` and `/founder`: `og:image:width/height/alt`, `og:locale=hr_HR`, `og:site_name`, `twitter:image` (was missing — `twitter:card` existed but had no image to show).

```
$ grep -c 'og:image:width\|og:image:height\|og:image:alt\|og:locale\|og:site_name\|twitter:image' index.html founder.html
index.html: 6
founder.html: 6
```

**WAITING VLADO:** the spec also asks for a *separate* `/founder` OG image showing "17,99 €" (Founder ads share that link). That's a designed graphic, not a meta-tag change — I'm not generating a brand visual unilaterally. `/founder` currently reuses the same `og.png` as `/`, with an `og:image:alt` that at least states the price in text. Send me the asset (or say go-ahead to draft one) and I'll wire it in.

Live verify (Facebook Sharing Debugger, opengraph.xyz screenshots) is **WAITING VLADO (network policy)** — both need to fetch the live URL from outside this session anyway (Facebook's own crawler), so this one was never going to run from here regardless of the proxy issue.

**Verdict: PASS** on the meta-tag fixes; founder-specific image is a separate, explicit ask for Vlado.

---
