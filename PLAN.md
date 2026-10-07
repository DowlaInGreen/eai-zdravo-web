# O1 — App: Google login + onboarding + dashboard — PLAN.md

Spec: `claude/uputa-o1-onboarding-dashboard.md` (project doc). Task: DEV-12 (proposed). Branch: `claude/o1-onboarding-dashboard`.
Visual spec: onboarding mockup canvas, 6 screens (no PDF attached in this session; the canvas source files are used directly).

## STATUS

| Step | Status |
|---|---|
| Phase 0 — recon | DONE |
| Stack decision | **WAITING VLADO** — repo is not Next.js/Supabase (see below) |
| O1.2 migration + data-access test | blocked by stack decision |
| O1.1 auth | blocked by stack decision |
| O1.3 onboarding | blocked by stack decision |
| O1.4 `computeSavings` tests + dashboard | blocked by stack decision |
| O1.5 pipeline hook | blocked by stack decision |
| Preview deploy + owner test | blocked by stack decision |

## FAZA 0 — recon

### 1. Framework
```
$ git log --oneline -1
ebfbfa4 RAG: ispravci činjenica, HNSW indeks, prag sličnosti + guardrail, 20 dokumenata, testovi i eval
$ cat package.json   (abridged)
"dependencies": { "pg": "^8.23.1" }, "devDependencies": { "@playwright/test": "^1.56.1" }
$ ls
404.html AGENT.md api/ assets/ emails/ founder.html hvala.html index.html k/ prehrana.html privatnost.html
rag-content/ scripts/ tests/ trening.html uvjeti.html vercel.json ...
```
- **Static HTML, no framework, no build step.** Pages are hand-written `.html` with `cleanUrls: true`.
- Backend = **Vercel serverless functions** in `api/*.js` (CommonJS): `subscribe.js` (Brevo DOI), `welcome.js`, `ask.js` (RAG).
- Deploy: push to any branch → automatic Vercel preview; `main` → production.

### 2. Database / auth
- **No Supabase anywhere in the repo.** No auth system at all today.
- Signups live in **Brevo** (lists 01–05), not in a DB.
- There **is** a Postgres: Vercel Postgres (Neon), env `POSTGRES_URL`, used by `api/ask.js` via `pg.Client`. Schema = `scripts/rag-schema.sql` (`rag_documents`, `rag_chunks`, pgvector). No `households` table exists (R1 table was planned for the local pipeline, not this repo).
- Env var names on Vercel (no values read): `BREVO_*`, `SITE_URL`, `META_*`, `WELCOME_SECRET`, `POSTGRES_URL`, `OPENROUTER_API_KEY`, `RAG_MIN_SIMILARITY`.

### 3. Plan outputs / report totals
- Not in this repo. Weekly plans, S3 savings and PDFs live in the local Mac pipeline (`~/Desktop/E AI Zdravo`). `weekly_savings` must be pushed in from there (O1.5), as specced.

### 4. Network (this session)
```
$ curl ... https://www.eai-zdravo.com/                         -> 000 (curl exit 56, proxy CONNECT 403)
$ curl ... https://eai-zdravo-web.vercel.app/                  -> 000 (curl exit 56)
$ curl ... https://accounts.google.com/.well-known/openid-configuration -> 000 (curl exit 56)
$ which vercel psql
/usr/bin/psql          (no vercel CLI)
```
Same blocker as L1: this session cannot reach the site, the Vercel preview, or Google. Code, migrations and unit tests can be done here; **live login + preview checks must be run by Vlado** (or after network access is opened for `*.vercel.app`, `eai-zdravo.com`, `accounts.google.com`, `oauth2.googleapis.com`).

## Stack decision — WAITING VLADO

The spec says: "Target stack if nothing exists: Next.js App Router + Supabase. If you want to diverge, stop and ask." Something exists, and it is a different stack, so I stopped.

| | A. Keep current stack (recommended) | B. Add Supabase, stay static | C. Migrate to Next.js + Supabase |
|---|---|---|---|
| Pages | static HTML + vanilla JS (like today) | static HTML + supabase-js from CDN | rewrite all pages in Next.js |
| Auth | own Google OAuth (code flow + PKCE) in `api/auth/*`, verify Google ID token, signed HttpOnly session cookie | Supabase Auth, Google provider | Supabase Auth |
| DB | existing Neon Postgres (`POSTGRES_URL`), new tables next to RAG | new Supabase project | new Supabase project |
| Data isolation | every query filtered by session `user_id` server-side + tests (no RLS: browser never talks to DB) | RLS | RLS |
| New vendors / accounts | none (only Google OAuth client) | Supabase (+ privacy page update) | Supabase |
| New env vars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` | Supabase URL + keys | Supabase URL + keys |
| Risk to live site | none — new pages/endpoints only | low | high — every existing page rebuilt |
| Effort | medium | medium | high |

Recommendation **A**: one database, no new processor to disclose in `/privatnost`, no build step, landing untouched. Trade-off: no RLS, so isolation relies on server code. That is covered by a test suite that runs every endpoint as user A against user B's ids and expects 0 rows/404.

Owner action needed regardless of A/B/C (Google Cloud Console): OAuth client type Web, consent screen "E AI Zdravo", authorized redirect URI:
- A: `https://www.eai-zdravo.com/api/auth/callback` + the preview domain callback
- B/C: the Supabase callback URL

Next step after the decision: O1.2 migration (`scripts/app-schema.sql`, idempotent like `rag-schema.sql`), then the order from the spec.

---
Previous plan (L1 pre-launch) moved to `docs/PLAN-l1-prelaunch.md`.
