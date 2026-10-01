# AGENT.md — runbook za eai-zdravo.com

Upute za AI agenta (ili čovjeka) koji održava ovaj web. Sve promjene idu kroz Git: push na `main` = automatski deploy na Vercel.

## Stack
- Statički HTML (`index.html`, `hvala.html`, `privatnost.html`, `404.html`), bez build koraka.
- `api/subscribe.js` — Vercel serverless funkcija: forma → Brevo (double opt-in).
- `api/ask.js` — RAG upit: embeddings + pgvector retrieval (Vercel Postgres/Neon) + generacija, sve preko OpenRoutera. Sadržaj baze znanja u `rag-content/**.md`, upisuje se skriptom `scripts/rag-ingest.js`. Vidi "RAG sustav" ispod.
- Hosting: Vercel projekt `eai-zdravo-web`, tim `dowlaingreens-projects`.
- Domene: `www.eai-zdravo.com` (kanonska; `eai-zdravo.com` → 308 na www, postavka u Vercelu). `eaizdravo.com`, `e-ai.fit` (+www) → 308 na www.eai-zdravo.com preko `vercel.json` redirects.
- Pošta: `info@eai-zdravo.com` (Zoho Mail). Slanje newslettera/onboardinga: Brevo, pošiljatelj `info@eai-zdravo.com`.

## Dozvole agenta (najmanje potrebno)
| Sustav | Dozvola | Za što |
|---|---|---|
| GitHub | push samo na `DowlaInGreen/eai-zdravo-web` | izmjene koda |
| Vercel | projekt `eai-zdravo-web` | deploy, domene, DNS zapisi, env varijable (bez čitanja vrijednosti) |
| Brevo | NIJE potreban agentu | ključ živi samo u Vercel env |

Agent NIKAD ne traži, ne ispisuje i ne commita API ključeve. Ključeve upisuje vlasnik izravno u Vercel.

## Environment varijable (Vercel → Settings → Environment Variables, Production)
| Ime | Primjer | Obavezno |
|---|---|---|
| `BREVO_API_KEY` | (tajna) | da |
| `BREVO_DOI_TEMPLATE_ID` | `1` ("DOI potvrda prijave") | da |
| `BREVO_LIST_BESPLATNO` | `2` (01 Free Tier) | da |
| `BREVO_LIST_PODRZAVATELJ` | `3` (02 Korisnici, paket "Korisnici" 17,99 €) | ne |
| `BREVO_LIST_OSNIVAC` | `4` (03 Premium Korisnici, paket "Premium partneri" 49,99 €) | ne |
| `BREVO_LIST_FITNESS` | `5` (04 Fitness) | ne |
| `BREVO_LIST_ZDRAVLJE` | `6` (05 Zdravlje) | ne |
| `SITE_URL` | `https://eai-zdravo.com` | ne |
| `META_CAPI_TOKEN` | (tajna, Events Manager → dataset → Postavke → Conversions API) | ne — bez njega server-side Lead je isključen |
| `META_PIXEL_ID` | `1608983517302133` | ne |
| `META_TEST_EVENT_CODE` | `TEST12345` (samo za test, obriši nakon) | ne |
| `POSTGRES_URL` | (auto, vidi "RAG sustav") | ne — bez nje `/api/ask` vraća 503 |
| `OPENROUTER_API_KEY` | (tajna, openrouter.ai/keys) | ne — bez nje `/api/ask` vraća 503 |
| `RAG_MIN_SIMILARITY` | `0.30` (vrijednost iz `npm run rag:eval`) | ne |

Dok varijable nisu postavljene, forma vraća poruku "Prijave se otvaraju uskoro" (HTTP 503) — ništa se ne gubi tiho.

## RAG sustav (`/api/ask`)
Arhitektura: Vercel Postgres (Neon) + pgvector (HNSW indeks), OpenRouter za embeddings (`openai/text-embedding-3-small`) i generaciju (`anthropic/claude-sonnet-5`) — jedan ključ, oba koraka, model po koraku zamjenjiv jednim stringom u `api/ask.js`/`scripts/rag-ingest.js`.

Sadržaj (`rag-content/<kategorija>/*.md`, frontmatter: title/category/tags/sources):
- `kuharice/` — originalni članci, pisani ručno. Nikad kopiran tuđi copyrightani tekst; svaka brojka mora imati izvor s URL-om u `sources`.
- `prehrana/`, `trening/` — GENERIRANO iz `prehrana.html`/`trening.html` (`npm run rag:pages`). Ne uređuj ručno: izmijeni stranicu pa regeneriraj. Test pada ako su zastarjeli.

Ponašanje `/api/ask`:
- Chunkovi ispod `RAG_MIN_SIMILARITY` (default 0.30) ne idu modelu; ako nijedan ne prođe → `grounded:false` i standardna poruka, bez poziva LLM-a.
- Prompt: samo iz konteksta, bez dijagnoza/doza/zdravstvenih obećanja, bez preporuke dijete, uputa na liječnika za trudnoću/djecu/bolest/lijekove.
- `profile` se čisti na poznata polja (`clanova`, `cilj`, `dob`); pitanje max 500 znakova.
- Upiti se NE spremaju (pitanja mogu sadržavati zdravstvene podatke — GDPR posebna kategorija).

Jednokratna postavka (vlasnik, ne agent):
1. Vercel projekt → **Storage** tab → **Create Database** → Postgres (Neon) → poveži s projektom `eai-zdravo-web`. Vercel sam upisuje `POSTGRES_URL` u env.
2. Napravi račun na openrouter.ai, generiraj ključ, dodaj `OPENROUTER_API_KEY` u Vercel env (Production). Postavi mjesečni limit potrošnje na ključu.
3. Lokalno (env iz Vercela, bez ispisivanja vrijednosti): `vercel env pull .env.rag --environment=production && set -a && . ./.env.rag && set +a`
4. `psql "$POSTGRES_URL" -f scripts/rag-schema.sql` (idempotentno, sigurno ponoviti)

Punjenje / ažuriranje (nakon svake izmjene sadržaja):
```bash
npm run test:rag     # offline: parser, sinkronizacija sa stranicama, regresije, /api/ask logika → "0 FAIL"
npm run rag:ingest   # upisuje samo promijenjene dokumente, briše one kojih više nema
npm run rag:eval     # recall@5 nad zlatnim pitanjima (scripts/rag-eval.json) + preporučeni prag; cilj ≥ 90 %
```
Provjera endpointa:
```bash
curl -s -X POST https://www.eai-zdravo.com/api/ask -H 'content-type: application/json' \
  -d '{"question":"Koliko dana kuhano jelo može stajati u hladnjaku?"}'   # grounded:true, izvor meal-prep-za-radni-tjedan
curl -s -X POST https://www.eai-zdravo.com/api/ask -H 'content-type: application/json' \
  -d '{"question":"Koja je najbolja kriptovaluta?"}'                        # grounded:false
```

## Brevo postavke (jednokratno, ručno u Brevo sučelju)
1. Senders & Domains → dodaj `eai-zdravo.com`, upiši DKIM/verifikacijske zapise u DNS → status "Authenticated".
2. Contacts → Lists: `01 Besplatno`, `02 Podržavatelj`, `03 Osnivač`, `04 Fitness`, `05 Zdravlje` → ID-eve upiši u Vercel env.
3. Contacts → Settings → Attributes (text): `PAKET`, `IZVOR`, `UTM_MEDIJ`, `KAMPANJA`, `PRIVOLA_DATUM`.
4. Templates → "Double opt-in" predložak s gumbom `{{ doubleoptin }}` → ID u `BREVO_DOI_TEMPLATE_ID`.
5. Automations → "Contact added to list 01" → mail 1 (odmah: 2 PDF-a), mail 2 (+2 dana), mail 3 (+4), mail 4 (+7, ponuda 17,99), mail 5 (+10, osnivač).

## DNS (Vercel DNS nakon prebacivanja nameservera)
- `MX` → Zoho (vrijednosti iz Zoho panela)
- `TXT @` → **jedan** SPF: `v=spf1 include:<zoho> include:<brevo> ~all`
- `TXT` DKIM za Zoho i Brevo (iz njihovih panela)
- `TXT _dmarc` → `v=DMARC1; p=none; rua=mailto:info@eai-zdravo.com`

## Provjere (checkpointi)
```bash
curl -sI https://eai-zdravo.com | head -1                       # HTTP/2 200
curl -sI https://eaizdravo.com | grep -i -E "^(HTTP|location)"   # 308 → https://eai-zdravo.com/
curl -s -X POST https://eai-zdravo.com/api/subscribe -H 'content-type: application/json' \
  -d '{"email":"test+1@example.com","consent":true,"paket":"besplatno"}'   # {"ok":true} (ili 503 dok env nije postavljen)
dig +short MX eai-zdravo.com; dig +short TXT eai-zdravo.com; dig +short TXT _dmarc.eai-zdravo.com
```

## Meta mjerenje
- Pixel `1608983517302133` ("E-AI zdravo web") se učitava tek nakon "Prihvati" (`assets/consent.js`).
- Lead ide dvaput s istim `event_id`: pixel iz preglednika + CAPI sa servera (`api/_lib/meta-capi.js`) → Meta deduplicira. CAPI radi i kad ad-blocker blokira pixel. Šalje se samo uz privolu.
- Nakon izmjene `consent.js` podigni `?v=N` u svim HTML-ovima (assets se keširaju 7 dana).

## Pravila sadržaja
- Bez tvrdnji o zdravstvenim ishodima (liječi, regulira, poboljšava zdravlje). Samo planiranje, cijene, vrijeme.
- Brojke prije pridjeva. Nema izmišljenih statistika.
- Plaćanje se uključuje tek kad postoji registrirani subjekt (obrt/d.o.o.) — do tada gumbi "Rezerviraj mjesto" vode na formu.
- Svaka izmjena: provjeri responzivnost na 390 px, 768 px i 1440 px (nema horizontalnog scrolla).

## Status (26.9.2026)
- Zoho (MX/SPF/DKIM/DMARC) ✅, Brevo domena autentificirana ✅, pošiljatelj info@ ✅, DOI predložak #1 ✅, forma → Brevo end-to-end test ✅.
- Brevo: blokada nepoznatih IP adresa isključena za API ključeve (Vercel ima promjenjive IP-eve).
- Česta greška: 401 "Key not found" = u Vercel upisan SMTP/MCP ključ umjesto API ključa (`xkeysib-`).
