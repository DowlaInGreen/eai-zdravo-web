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

Nothing unclear here — proceeding to P0.

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
**Verdict: PASS.** No secrets in frontend, build, or git history. Meta Pixel ID (public by design) is the only Meta identifier that appears client-side, in `assets/consent.js` behind the cookie banner.

### L1-#1 — Privacy placeholder: FIX applied, WAITING VLADO (legal entity)

Replaced `[NAZIV SUBJEKTA I OIB — popuniti nakon registracije]` with the neutral wording from the spec. Also added one sentence noting Vercel Web Analytics ("bez kolačića, bez osobnih podataka") ahead of wiring it in L1-#19. No processor beyond Brevo/Vercel/Meta found in code (no Supabase, no Telegram) — existing "Gdje se podaci čuvaju" text was already accurate.

```
$ grep -c "popuniti" privatnost.html
0
```
Local file verified. The spec's verify command targets the **live production URL** (`curl https://www.eai-zdravo.com/privatnost`) — that still shows the old placeholder until this branch is deployed to the preview and Vlado promotes to production. Re-checked against the preview URL after push (see below).

**WAITING VLADO:** legal entity name + OIB for Terms art. 5 and this page's "Tko obrađuje podatke" section. Neutral wording stands until then — never publish the bracket placeholder live.

---
