# O1 — App: Google login + onboarding + dashboard — PLAN.md

Spec: `claude/uputa-o1-onboarding-dashboard.md` (project doc). Task: DEV-12 (proposed). Branch: `claude/o1-onboarding-dashboard`.
Visual spec: onboarding mockup canvas, 6 screens (no PDF attached in this session; canvas source used directly). App pages use the landing page tokens (Figtree, leaf palette).
Stack decision (Vlado, 07.10.2026): **A — existing stack.** Static HTML + Vercel functions + existing Neon Postgres, own Google OAuth. No Supabase, no Next.js.

## STATUS

| Step | Status |
|---|---|
| Phase 0 — recon | PASS |
| O1.2 schema + data isolation | PASS (10/10) |
| O1.1 Google login | PASS (11/11, Google faked — no network to Google from this session) |
| O1.3 onboarding API + page | PASS (11/11 API, browser flow below) |
| O1.4 `computeSavings` (red → green) + dashboard | PASS (9/9 after 0/9 red) |
| Browser flow, local stand-in server | PASS (15/15) |
| O1.5 pipeline hook | PASS |
| Existing RAG offline tests (regression) | PASS (9/9) |
| Vercel preview | pushed; **WAITING VLADO** — env vars + Google client + DB migration, then live login test |

## What was built

| Path | What |
|---|---|
| `scripts/app-schema.sql` | `app_users`, `app_profiles`, `app_training`, `app_households`, `app_trainer_leads`, `app_weekly_savings`; idempotent; constraints enforce consent, Monday weeks, trainer mode, enums |
| `api/_lib/{db,store,session,oauth,onboarding,savings,guard,http}.js` | DB pool, all queries (always by `user_id`), signed HttpOnly session, Google OIDC (code + PKCE), validators, savings windows |
| `api/auth/google.js`, `api/auth/callback.js`, `api/auth/logout.js` | login flow; scopes `openid email profile` only |
| `api/me.js`, `api/onboarding.js`, `api/account.js` | state for pages, save one step, delete account |
| `prijava.html`, `onboarding.html` (+ `/onboarding/1..6` rewrite), `dashboard.html` | pages; `assets/app.css`, `app-common.js`, `onboarding.js`, `dashboard.js` |
| `scripts/push-week-savings.js` | O1.5 hook (pipeline → `app_weekly_savings`) |
| `scripts/dev-seed-savings.js` | DEV ONLY seed, `plan_ref='SEED'`, `--cleanup`; refuses `NODE_ENV=production` and non-local DB without `--remote` |
| `tests/app-*.check.js`, `tests/app-server.js`, `tests/local-pg.sh` | tests + local stand-in for Vercel |
| `privatnost.html` | updated: account data, consent for health fields, Google, Neon |
| `vercel.json`, `robots.txt` | rewrite `/onboarding/:step`, noindex + no-store on app pages |

Decisions inside spec latitude:
- **No RLS** (stack A): the browser never talks to Postgres. Isolation = every query filtered by session `user_id`, proven by tests.
- **ID token validation:** claims are checked strictly (`iss`, `aud`, `exp`, `nonce`, `email_verified`). Signature verification is skipped because the token comes server-to-server from Google's token endpoint over TLS (OIDC Core 3.1.3.7). No extra dependency.
- **"Obriši moje podatke"** deletes the whole account, including savings history, not only the health fields. Cleanest GDPR answer.
- **Consent:** the DB itself refuses birth year, height or weight without `health_consent_at`.
- **State-changing endpoints** require a JSON content type and an own-origin `Origin` header; the session cookie is `SameSite=Lax`.
- **Spec deviations:**
  - Dashboard date shown as `31.08.2026.`
  - Savings field `fromPlan` drives the "prema planu" note.
  - Test files are `*.check.js` (repo convention) so Playwright does not pick them up.

## Raw output

### O1.2 — schema twice (idempotent) + isolation
```
$ source tests/local-pg.sh start && psql "$POSTGRES_URL" -f scripts/app-schema.sql   (x2)
CREATE EXTENSION / CREATE TABLE x5 / CREATE INDEX / CREATE TABLE
--- second run: NOTICE ... already exists, skipping (all objects)
$ node --test tests/app-isolation.check.js
ok 1 - B reads none of A's data
ok 2 - A reads own data
ok 3 - B writing all steps never changes A
ok 4 - B deleting own account leaves A intact
ok 5 - DB refuses health data without consent
ok 6 - DB refuses trainer referral without mode
ok 7 - DB refuses week_start that is not a Monday
ok 8 - onboarding step never moves backwards; step 6 completes
ok 9 - one open trainer lead per user; unchecking closes it
ok 10 - withdrawing consent wipes health fields
# pass 10  # fail 0
```

### O1.1 — Google login
```
$ node --test --test-reporter=spec tests/app-auth.check.js
  302 -> https://accounts.google.com/o/oauth2/v2/auth | scope = openid email profile
  cookie: eai_oauth=<signed>; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600
✔ start: redirects to Google with PKCE, nonce, minimal scopes; sets short-lived cookie
✔ start: unknown Host is refused
✔ start: preview and production hosts are allowed
  302 -> /onboarding/1
  db: { email: 'vlado@example.com', google_sub: 'g-123' }
✔ callback: new user -> session cookie -> /onboarding/1
✔ callback: returning user with finished onboarding -> /dashboard
✔ callback: wrong state -> /prijava?greska=istek, no session
✔ callback: token for another app (aud) or bad nonce or unverified email -> greska=google
✔ callback: user cancelled on Google -> greska=odustao
✔ session: tampered or expired token is rejected
✔ missing env -> login shows "uskoro", never crashes
✔ logout clears the session cookie
ℹ pass 11  ℹ fail 0
```
(On https hosts the cookies also carry `Secure`; localhost is http.)

### O1.4 — computeSavings, RED first
```
$ node --test tests/app-savings.check.js        # stub: throw 'not implemented'
✖ 1. no rows -> all zeros, pct null
✖ 2. two weeks same month: 5/25 + 3/15 -> 8,00 € and 20,0 % (not average of %)
✖ 3. year boundary ... ✖ 4. signup 15.07.2026 ... ✖ 5. baseline 0 ... ✖ 6. time zone ...
ℹ pass 0  ℹ fail 9
```
After implementation:
```
✔ 1 … ✔ 6, ✔ future weeks are not counted, ✔ promo/store split and "prema planu" flag, ✔ cents are rounded
ℹ pass 9  ℹ fail 0
```
(One assertion in my own test was wrong: a month containing a plan week must show "prema planu". The test was fixed, not the rule.)

### O1.3 — onboarding API
```
$ node --test --test-reporter=spec tests/app-onboarding.check.js
✔ unauthenticated -> 401
✔ cross-site requests are refused (form post / foreign origin)
✔ cannot jump ahead to step 4 before step 1
  400 -> {"error":"Provjeri označena polja.","errors":{"weight_kg":"Težina između 30 i 250 kg."}}
✔ out-of-range weight rejected with Croatian error
  db row: {"onboarding_step":7,"done":true,"birth_year":1986,"height_cm":182,"weight_kg":88,"consent":true,
  "goals":["save_money","less_time"],"trains":true,"training_goal":"build_muscle",
  "plan_status":["needs_ideas","online_challenges","wants_trainer_referral"],"trainer_mode":"in_person",
  "program":"old_school","plan_style":"old_school","diets":["vegan","lactose_free"],"allergens":["tree_nuts"],
  "dislikes":"jetrica","adults":2,"children":1,"lead_mode":"in_person","lead_status":"new"}
✔ full flow 1..6, resume after step 3, rows in DB
✔ /api/me returns profile + empty savings, no google_sub
✔ edit mode after completion returns to /dashboard
✔ step 3 "Ne" clears training fields and closes the lead
✔ delete account -> 200, session cleared, data gone
✔ validators
✔ household shares: 2 adults + 1 child = 2,5 portions, 40/40/20
ℹ pass 11  ℹ fail 0
```

### Whole suite + regression
```
$ npm run -s test:app
# tests 9   # pass 9   # fail 0      (savings)
# tests 32  # pass 32  # fail 0      (isolation + auth + onboarding)
$ npm run -s test:rag
9 PASS, 0 FAIL
```

### Browser flow (real pages + real handlers + local Postgres; Google replaced by a signed test session)
```
$ node tests/app-browser.check.js
PASS  no session: /dashboard -> /prijava?next=/dashboard
PASS  login error message shown (greska=istek)
PASS  /onboarding/4 before step 1 -> sent back to /onboarding/1
  error text: Težina između 30 i 250 kg.
PASS  step 1: fields locked until consent; out-of-range weight shows error
PASS  step 2: max 2 goals
PASS  step 3: Da + mišićna masa + preporuka trenera (Uživo)
PASS  step 4: protein_150 preselected from training goal; refresh resumes at 4
PASS  step 5: allergens + dislikes
  portion card: Porcija po obroku2,5Trošak obroka dijelimo 40 % · 40 % · 20 %
PASS  step 6: 2 + 1 -> 2,5 porcije, 40/40/20, -> /dashboard
PASS  dashboard, no weeks yet: 0,00 € and "Prvi plan stiže u nedjelju"
PASS  edit Ciljevi -> /onboarding/2?edit=1 -> save -> back on /dashboard
  seeded 6 SEED weeks for vlado.test@example.com
  panel: Tvoja uštedaOvaj tjedan8,30 €−15,4 %Ovaj mjesec8,30 €−15,4 %Ove godine48,40 €−15,7 %
         Ukupno od prijave (31.08.2026.)48,40 € · −15,7 %akcije 36,00 € + izbor trgovine 12,40 € · prema planu
PASS  dev seed (6 weeks) -> savings panel shows weeks, month, year, total
PASS  no horizontal scroll at 390 px on all app pages
PASS  delete account -> back on /, session gone
PASS  no JavaScript errors on any page
ALL PASS
```
Hand check of the seeded totals:
- promo 6,1 + 4,8 + 7,2 + 5,4 + 6,6 + 5,9 = 36,00 €; store = 12,40 €; total 48,40 €
- baseline 308,10 € → 48,40 / 308,10 = 15,7 % ✔
- this week: (5,9 + 2,4) / 53,8 = 15,4 % ✔

Screenshots (390 px for every step, dashboard at 390 and 1280) were sent to Vlado in chat. They are not committed.

### O1.5 — pipeline hook
```
$ node scripts/push-week-savings.js week.json --dry-run
DRY  pilot@example.com 2026-10-05 saving 8.40 €
SKIP nobody@example.com: no app account
$ node scripts/push-week-savings.js week.json            (run twice: upsert, still 1 row)
OK   pilot@example.com 2026-10-05 saving 8.40 €
$ node scripts/push-week-savings.js bad.json             (Tuesday)
FAIL row 0: week_start must be a Monday (YYYY-MM-DD)     exit 1
 week_start | spent_eur | baseline_eur | saving_promo_eur | saving_store_eur | source | plan_ref
 2026-10-05 |     41.20 |        49.60 |             6.10 |             2.30 | plan   | plan-2026-10-05
$ NODE_ENV=production node scripts/dev-seed-savings.js pilot@example.com
REFUSED: NODE_ENV=production
$ POSTGRES_URL=<remote> node scripts/dev-seed-savings.js pilot@example.com
REFUSED: POSTGRES_URL is not local; add --remote if this is really a test DB
```

### Secrets
```
$ grep -rnE "(xkeysib-|sk_live|sk_test|GOCSPX-|AIza…|-----BEGIN|apps.googleusercontent.com)" (js/html/sql/json, excl. node_modules)
tests/app-auth.check.js:6: process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';   ← fake test value only
```

## WAITING VLADO — to get a working preview (in this order)
1. **Google Cloud Console** → APIs & Services:
   - OAuth consent screen: External, app name "E-AI zdravo", support email info@eai-zdravo.com, scopes `openid email profile` only. Testing mode is fine for the pilot; add the testers' Gmail addresses.
   - Credentials → Create OAuth client ID → Web application. Authorized redirect URIs:
     - `https://www.eai-zdravo.com/api/auth/callback`
     - `https://<branch preview alias>/api/auth/callback`. Copy the alias exactly from Vercel → Deployments → this branch → Domains. Vercel shortens long branch aliases (e.g. `eai-zdravo-web-git-claude-o1-…-<hash>-dowlaingreens-projects.vercel.app`). The login code accepts any `eai-zdravo-web-…-dowlaingreens-projects.vercel.app` host, but Google needs the exact string.
2. **Vercel → eai-zdravo-web → Settings → Environment Variables** (Preview + Production; values never in chat):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` — random, ≥ 32 characters, e.g. `openssl rand -base64 48`
   - `POSTGRES_URL` already exists.
   - Then Redeploy the preview.
3. **DB migration** (same flow as RAG, nothing printed):
   ```
   vercel env pull .env.app --environment=production && set -a && . ./.env.app && set +a
   psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f scripts/app-schema.sql
   rm .env.app
   ```
4. **Live test on the preview alias:**
   - `/prijava` → Nastavi s Googleom → your account → onboarding 1–6 → dashboard.
   - Expected: savings 0,00 € with "Prvi plan stiže u nedjelju" until the pipeline pushes a week.
5. Production: merge to `main` only after your OK.
