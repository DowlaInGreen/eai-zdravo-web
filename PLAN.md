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
