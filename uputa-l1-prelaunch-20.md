# UPUTA ZA CODING AGENTA — L1: PRE-LAUNCH CHECKLIST (20 stavki)
Projekt: E AI Zdravo | Datum: 2026-09-28 | Stranica: https://www.eai-zdravo.com
Izvor nalaza: live audit (OpenSEO site audit 38be0bd6, 3 stranice + Lighthouse 6/6; ručni pregled /, /founder, /privatnost, robots.txt, sitemap.xml, 404 test).

> **NAPOMENA (dodano pri commitu u repo):** audit je rađen nad produkcijom 28.09. prije zadnjih commitova. U repou već postoje: `404.html`, JSON-LD (Organization, WebSite, FAQPage, Product/Offer), sitemap s /founder i lastmod, `llms.txt` + `llms-full.txt`, Meta CAPI uz privolu. Te stavke NE radi ponovno — samo ih verificiraj (korak Inspect) i zabilježi PASS s raw outputom.

## PRINCIP
Stranica je u dobrom stanju — 0 broken linkova, alt tekstovi postoje, webp slike, double opt-in, honeypot. Ovo nije rewrite. Popravi samo ono što je označeno ❌ / ⚠️, a ✅ stavke samo VERIFICIRAJ komandom i zalijepi raw output u `PLAN.md`.
Pravila: ne diraj copy osim gdje je ovdje navedeno; nijedan secret u frontend bundle; svaki fix ima verifikacijsku komandu; raw output, ne sažetak.

## STATUS PREGLED

| # | Stavka | Status | Prioritet |
|---|---|---|---|
| 1 | Privacy policy | ⚠️ postoji, ali LIVE placeholder `[NAZIV SUBJEKTA I OIB — popuniti]` | P0 (blokira Vlado) |
| 2 | Terms & conditions | ❌ ne postoji | P0 |
| 3 | Secrets off frontend | ❓ provjeriti bundle (Meta CAPI token!) | P0 |
| 4 | Force HTTPS | ❓ provjeriti curl-om + HSTS | P1 |
| 5 | Cookie consent | ⚠️ postoji po tekstu politike — provjeriti da Pixel NE ide prije pristanka; link "Postavke kolačića" je `#` | P0 |
| 6 | Meta title + description | ⚠️ 2 opisa preduga (/, /founder) | P1 |
| 7 | Social preview | ⚠️ og.png postoji — provjeriti 1200×630, dodati width/height/alt | P2 |
| 8 | Favicon | ❓ icon-96/192 postoje — provjeriti favicon.ico, apple-touch-icon, manifest | P2 |
| 9 | Sitemap + robots | ⚠️ /founder fali u sitemapu (audit: orphan page) | P1 |
| 10 | Alt tekst | ✅ sadržajne slike imaju alt; logo ikone alt="" (dekorativno, OK) | verify |
| 11 | Kompresija slika | ✅ webp | verify |
| 12 | Brzina | ❓ Lighthouse pokrenut, brojke izmjeriti lokalno | P1 |
| 13 | Kontrast | ❓ axe/Lighthouse a11y | P1 |
| 14 | Mobile | ✅ viewport postoji | verify |
| 15 | Custom 404 | ❌ vraća 404 status (dobro), ali nema custom stranice | P1 |
| 16 | Broken links | ✅ audit: 0 broken internal | verify + `#` linkovi |
| 17 | Form validation | ❓ testirati | P1 |
| 18 | Spam zaštita | ✅ honeypot ("Web") + double opt-in; dodati server rate limit | P1 |
| 19 | Analytics | ❌ samo Meta Pixel (uz privolu); nema cookieless analitike | P0 |
| 20 | Jedan CTA | ⚠️ home: dropdown s 5 opcija u formi | P2 |
| + | Schema / GEO | ❓ JSON-LD nije detektiran | P1 |

---

## FAZA 0 — IZVIDI (prije koda, u PLAN.md)
1. Gdje živi site (repo, framework ili čisti HTML), kako se deploya (Vercel projekt, grana).
2. Gdje ide POST forme (Vercel function? direktno Brevo?), gdje živi Meta CAPI poziv.
3. Popis env varijabli na Vercelu (samo imena, ne vrijednosti).
Ako nešto nije jasno — STANI i pitaj Vladu.

---

## P0

### 1 — Privacy: ukloni live placeholder
- Sada: "E-AI zdravo, [NAZIV SUBJEKTA I OIB — popuniti nakon registracije], Zagreb."
- **Blokira Vlado** (treba pravni subjekt + OIB). Do tada zamijeni tekst u: "E-AI zdravo, Zagreb (podaci o pravnom subjektu bit će objavljeni prije otvaranja naplate). Kontakt: info@eai-zdravo.com" — nikad ne prikazuj uglate zagrade javno.
- Dodaj u "Gdje se podaci čuvaju" svaki procesor koji stvarno koristiš (provjeri kod: Supabase? Telegram?). Politika mora odgovarati kodu.
- Dodaj Vercel Web Analytics (vidi #19) u politiku: "bez kolačića, bez osobnih podataka".
**Verify:** `curl -s https://www.eai-zdravo.com/privatnost | grep -c "popuniti"` → mora biti `0`.

### 2 — Uvjeti korištenja (`/uvjeti`)
- Nova stranica iz nacrta u PRILOGU A (dno ovog dokumenta). Isti layout kao /privatnost.
- Link u footeru obje stranice (/ i /founder) pored "Privatnost", i u tekstu privole pored forme: "…Odjava jednim klikom. Privatnost · Uvjeti".
- Dodaj u sitemap.
**Verify:** `curl -sI https://www.eai-zdravo.com/uvjeti | head -1` → `200`; `curl -s https://www.eai-zdravo.com/ | grep -c '/uvjeti'` ≥ 1.

### 3 — Secrets off frontend
```bash
# nad build outputom (dist/ ili .vercel/output) i nad live stranicom
grep -rEn "(EAA[A-Za-z0-9]{20,}|xkeysib-|sk_live|sk_test|service_role|SUPABASE_SERVICE|BREVO_API|access_token)" dist/ .vercel/output 2>/dev/null
curl -s https://www.eai-zdravo.com/ https://www.eai-zdravo.com/founder | grep -oE "(EAA[A-Za-z0-9]{20,}|xkeysib-[A-Za-z0-9-]+|service_role)" | sort -u
git log -p | grep -E "xkeysib-|EAA[A-Za-z0-9]{20,}" | head
```
- Očekivano: sve prazno. Meta Pixel ID je javan (OK); **CAPI access token i Brevo API key moraju biti samo u serverless funkciji + Vercel env**.
- Ako je išta pronađeno u git historiji: rotiraj ključ kod providera (ne samo obriši iz koda) i javi Vladi.

### 5 — Cookie consent: dokaži da radi
- Playwright test `tests/consent.spec.ts`:
  1. Svjež kontekst, učitaj `/` → nijedan request na `connect.facebook.net` ni `facebook.com/tr` prije klika.
  2. Klik "Odbij" → i dalje nula Meta requestova, reload → banner se ne vraća, Pixel se ne učitava.
  3. Klik "Prihvati" → `fbevents.js` se učita.
- Link "Postavke kolačića" na /privatnost sada vodi na `#` → mora ponovno otvoriti banner (povlačenje privole mora biti jednako lako kao davanje — GDPR).
- CAPI poziv kod prijave: šalje se SAMO ako je privola = prihvaćeno (provjeri server kod; flag mora doći iz klijenta i biti poštovan).
**Verify:** `npx playwright test tests/consent.spec.ts` → raw output, 3/3 pass.

### 19 — Analytics (cookieless, bez bannera)
- Uključi **Vercel Web Analytics** (cookieless, ne treba privolu) na svim stranicama. Meta Pixel ostaje iza bannera.
- Custom eventi: `signup_submit` (s vrijednošću opcije iz dropdowna), `cta_click` (koji gumb), `founder_view`.
- UTM parametri se već šalju u Brevo kao "izvor posjeta" — provjeri da forma čita `utm_source/utm_medium/utm_campaign` iz URL-a i sprema ih uz kontakt (to je naš jedini način mjerenja koji kanal donosi prijave; Y6 checkpoint ovisi o tome).
**Verify:** deploy → otvori `/?utm_source=test&utm_medium=l1&utm_campaign=verify`, pošalji testnu prijavu s `vlado+l1test@…` → u Brevu kontakt ima source=test; Vercel Analytics dashboard pokazuje posjet i event. Screenshot u PLAN.md.

---

## P1

### 4 — HTTPS
```bash
curl -sI http://eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI http://www.eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI https://eai-zdravo.com/ | grep -iE "^(HTTP|location)"
curl -sI https://www.eai-zdravo.com/ | grep -iE "^(HTTP|strict-transport)"
```
Očekivano: sve 3 varijante → 301/308 na `https://www.eai-zdravo.com/` (jedan hop), i `strict-transport-security` header na zadnjoj. Ako HSTS fali, dodaj u `vercel.json` headers: `max-age=63072000; includeSubDomains; preload`.

### 6 — Meta opisi (≤155 znakova; naslovi su OK)
- `/`: `Tjedni plan od 14 obroka po dnevnim cijenama iz zagrebačkih trgovina. Kuhaš dvaput tjedno, jedna shopping lista. 2 knjige recepata besplatno.`
- `/founder`: `14 obroka, 2 kuhanja, 1 shopping lista po dnevnim cijenama. Founder paket 17,99 €: 120 recepata u 12 knjiga + 3 mjeseca tjednih planova.`
- `/uvjeti`: `Uvjeti korištenja E-AI zdravo: rani pristup, rezervacija paketa, digitalni sadržaj i pravo na odustanak.`
**Verify:** `for p in "" founder privatnost uvjeti; do curl -s https://www.eai-zdravo.com/$p | grep -oP '(?<=name="description" content=")[^"]*' | awk '{print length": "$0}'; done` → svi ≤155.

### 9 — Sitemap + robots
- sitemap.xml: dodaj `/founder` i `/uvjeti`, `<lastmod>` za sve (datum zadnje izmjene, generirano pri buildu, ne ručno).
- /founder: dodaj link na njega s home stranice (npr. u "Paketi" sekciji uz Korisnici paket: "Više o Founder paketu") — rješava orphan page.
- robots.txt: ostaje kako jest (Allow /, Disallow /hvala i /k/). AI crawleri su dopušteni — namjerno, zbog GEO. Dodaj `/llms.txt` (vidi GEO dolje).
**Verify:** `curl -s https://www.eai-zdravo.com/sitemap.xml` → 4 URL-a s lastmod.

### 12 + 13 + 14 — Brzina, kontrast, mobile
```bash
npx lighthouse https://www.eai-zdravo.com/ --form-factor=mobile --only-categories=performance,accessibility,seo,best-practices --output=json --output-path=out/lh-home.json --chrome-flags="--headless"
npx lighthouse https://www.eai-zdravo.com/founder --form-factor=mobile --only-categories=performance,accessibility,seo,best-practices --output=json --output-path=out/lh-founder.json --chrome-flags="--headless"
node -e 'for (const f of ["out/lh-home.json","out/lh-founder.json"]) { const r=require("./"+f); console.log(f, Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)])), "LCP", r.audits["largest-contentful-paint"].displayValue, "CLS", r.audits["cumulative-layout-shift"].displayValue); }'
npx @axe-core/cli https://www.eai-zdravo.com/ https://www.eai-zdravo.com/founder --tags wcag2aa
```
- Cilj (mobile): Performance ≥ 90, Accessibility ≥ 95, SEO 100, LCP < 2.5 s, CLS < 0.1, axe 0 serious/critical.
- Kontrast: popravi samo boje koje axe prijavi (npr. sivi tekst na bijelom, badgeovi "BESPLATNO / SAMO 20 MJESTA"). Akcentna boja ostaje.
- Hero slika: `fetchpriority="high"`, bez `loading="lazy"`; ostale slike `loading="lazy"` + eksplicitni `width/height`.
- Ručno: iPhone SE (375 px) — nema horizontalnog scrolla, forma se ne reže, CTA gumb ≥ 44 px visine.

### 15 — Custom 404
- Stranica `404.html` (Vercel je automatski servira sa statusom 404). Copy:
  > **Ova stranica ne postoji.** Ali tjedni plan postoji — 14 obroka, 2 kuhanja, 1 shopping lista.
  > [Na početnu] [Preuzmi 2 knjige besplatno → /#besplatno]
- `<meta name="robots" content="noindex">`, isti header/footer.
**Verify:** `curl -s -o /dev/null -w "%{http_code}\n" https://www.eai-zdravo.com/nepostoji` → `404`, i `curl -s https://www.eai-zdravo.com/nepostoji | grep -c "ne postoji"` ≥ 1.

### 16 — Linkovi
- Audit: 0 broken internal. Dodatno: pronađi sve `href="#"` bez handlera (npr. "Postavke kolačića") i spoji ih ili ukloni.
- `npx linkinator https://www.eai-zdravo.com --recurse` → raw output, 0 broken.

### 17 — Form validation
- Email: `type="email"` + `required` + server-side regex i odbijanje prazno/predugo (>254). Ime: max 80 znakova, strip HTML.
- Checkbox privole: `required` — prijava bez njega = odbijeno i na serveru, ne samo u HTML-u.
- Poruke na hrvatskom ispod polja (ne browser default na engleskom): "Upiši ispravnu email adresu." / "Za slanje knjiga trebamo tvoju privolu."
- Gumb disabled dok request traje (nema duplih prijava na dvoklik).
- Playwright test: prazan email, `abc@`, bez checkboxa, dvoklik → 4 slučaja, svi ispravno odbijeni/deduplicirani.

### 18 — Spam
- Honeypot ("Web" polje) postoji: provjeri da server tiho odbacuje zahtjev ako je popunjen (200 odgovor, bez upisa u Brevo).
- Dodaj: rate limit u serverless funkciji (npr. 5 prijava / IP / 10 min, Vercel KV ili in-memory za početak) + minimalno vrijeme ispunjavanja (odbaci ako je forma poslana < 2 s od učitavanja).
- Bez CAPTCHA-e za sada (ubija konverziju); Cloudflare Turnstile samo ako spam krene.
**Verify:** `for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -X POST <form_endpoint> -d "email=spam$i@test.hr&consent=1"; done` → prvih 5 prolazi, 6. i 7. → 429.

### GEO / Schema (nije na listi, ali je naš prioritet)
- JSON-LD na `/`: `Organization` (name, url, logo, email, sameAs: Instagram), `WebSite`, `FAQPage` (postojećih 6 pitanja, identičan tekst kao na stranici).
- JSON-LD na `/founder`: `Product` + `Offer` (17,99 EUR, `availability: PreOrder`) + `FAQPage` (6 pitanja).
- `/llms.txt`: 10 redaka — što je E-AI zdravo, 3 ključne činjenice (14 obroka / 2 kuhanja; dnevni cjenici hrvatskih lanaca; ~23 g proteina/€ u testnim planovima), linkovi na /, /founder, /privatnost, /uvjeti.
**Verify:** `curl -s https://www.eai-zdravo.com/ | grep -c 'application/ld+json'` ≥ 1; Google Rich Results Test na oba URL-a bez grešaka (screenshot).

---

## P2

### 7 — Social preview
- Provjeri `og.png`: `curl -s https://www.eai-zdravo.com/assets/og.png -o /tmp/og.png && file /tmp/og.png` → 1200×630, < 300 KB.
- Dodaj `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:image`, `og:locale` = `hr_HR`, `og:site_name` = `E-AI zdravo`.
- /founder: zasebna og slika s "17,99 €" (Founder oglasi dijele taj link).
**Verify:** Facebook Sharing Debugger + opengraph.xyz za oba URL-a (screenshot).

### 8 — Favicon set
- Treba postojati: `/favicon.ico` (32×32), `<link rel="icon" type="image/png" sizes="32x32">`, `<link rel="apple-touch-icon" href="/assets/icon-180.png">`, `site.webmanifest` (name, short_name "E-AI zdravo", icons 192/512, theme_color).
**Verify:** `curl -sI https://www.eai-zdravo.com/favicon.ico | head -1` → 200.

### 20 — Jedan jasan CTA
- /founder je već fokusiran (✅ ne diraj).
- `/`: primarni CTA je "Prijavi se za rani pristup" — zadrži. Dropdown "Što te zanima?" s 5 opcija dodaje odluku u trenutku prijave.
  → Default vrijednost ostaje "Rani pristup + 2 knjige"; gumbi "Rezerviraj mjesto" i "Postani premium partner" u Paketi sekciji neka pred-odaberu svoju opciju (npr. `#besplatno?paket=korisnici`), tako da korisnik ne mora ništa birati. Dropdown ostaje, ali nikad nije prvi korak.

---

## DoD
- Tablica gore prepisana u PLAN.md sa stvarnim statusom i raw outputom svake verifikacijske komande.
- P0: sve stavke ✅ osim #1 dijela koji čeka pravni subjekt (tekst placeholdera uklonjen).
- Lighthouse mobile brojke zalijepljene za / i /founder.
- `npx playwright test` zeleno (consent + forma).
- Ponovni OpenSEO audit → 0 warning (Vlado/Claude ga pokreće nakon deploya).

## ŠTO NE RADITI
- Ne mijenjati copy, cijene, pakete ni dizajn osim gdje je ovdje eksplicitno navedeno.
- Ne dodavati Google Analytics (treba banner i privolu; Vercel Analytics pokriva potrebu).
- Ne dodavati CAPTCHA-u.
- Ne objavljivati /uvjeti s placeholderima u uglatim zagradama — koristi formulaciju iz Priloga A dok subjekt ne postoji.

---

## PRILOG A — NACRT: UVJETI KORIŠTENJA (`/uvjeti`)
⚠️ Nacrt za pregled, nije pravni savjet. Prije otvaranja naplate: pravni subjekt + OIB upisani i pregled odvjetnika (posebno članak 5).

**Uvjeti korištenja**
Zadnje ažuriranje: 28. rujna 2026.

**1. Tko smo**
E-AI zdravo, Zagreb. Kontakt: info@eai-zdravo.com. Podaci o pravnom subjektu (naziv, OIB, adresa) bit će objavljeni ovdje prije otvaranja naplate.

**2. Što nudimo**
E-AI zdravo je usluga planiranja nabave i pripreme hrane: tjedni plan obroka složen prema javno objavljenim cijenama trgovačkih lanaca, shopping lista i upute za pripremu. Uz to nudimo PDF knjige recepata „Fast Prep High Protein".
Platforma je u razvoju. Trenutno su dostupni prijava za rani pristup, 2 besplatne PDF knjige i rezervacija paketa.

**3. Nije medicinski savjet**
Sadržaj nije prehrambeni, medicinski ni nutricionistički savjet i ne zamjenjuje liječnika ili nutricionista. Ako imaš alergiju, bolest ili posebne prehrambene potrebe, provjeri svaki recept i namirnicu sam i posavjetuj se sa stručnjakom.

**4. Cijene u planovima**
Cijene u planovima i listama preuzimamo iz javno objavljenih cjenika trgovina na dan izrade plana. Cijene i akcije se mijenjaju, pa se cijena na polici može razlikovati. Za razliku u cijeni ne odgovaramo.

**5. Rezervacija i plaćanje paketa**
Rezervacija paketa (Korisnici 17,99 €, Premium partneri 49,99 €) je besplatna i ne obvezuje te na kupnju. Kad otvorimo naplatu, emailom ti šaljemo link za uplatu po cijeni važećoj u trenutku rezervacije.
Cijene su u eurima. [Napomena o PDV-u upisati nakon registracije subjekta.]
Besplatno razdoblje korištenja platforme (3 ili 12 mjeseci, ovisno o paketu) počinje danom pokretanja platforme, ne danom uplate.
PDF knjige su digitalni sadržaj koji se isporučuje odmah nakon uplate. Kao potrošač imaš pravo na jednostrani raskid ugovora sklopljenog na daljinu u roku od 14 dana. Kod digitalnog sadržaja koji se isporučuje odmah, to pravo prestaje kad izričito pristaneš na početak isporuke i potvrdiš da znaš da time gubiš pravo na raskid; taj pristanak tražit ćemo od tebe u koraku plaćanja.

**6. Autorska prava**
Recepti, tekstovi, fotografije i PDF knjige zaštićeni su autorskim pravom. Knjige su za tvoju osobnu upotrebu. Ne smiješ ih dijeliti, prodavati ni javno objavljivati.

**7. Odgovornost**
Uslugu pružamo s pažnjom, ali ne jamčimo da će platforma uvijek biti dostupna ni da su svi podaci bez greške. Za štetu odgovaramo samo kad to zakon propisuje.

**8. Izmjene uvjeta**
Uvjete možemo izmijeniti. O bitnim izmjenama obavještavamo emailom. Važeća verzija je uvijek na ovoj stranici, s datumom zadnjeg ažuriranja.

**9. Mjerodavno pravo**
Primjenjuje se pravo Republike Hrvatske. Spor pokušavamo riješiti dogovorom na info@eai-zdravo.com. Potrošač može pokrenuti i izvansudsko rješavanje spora ili se obratiti nadležnom sudu.

**10. Privatnost**
Kako obrađujemo osobne podatke opisano je u [Politici privatnosti](/privatnost).
