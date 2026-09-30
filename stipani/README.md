# Stipani

> **Jedan dom. Jedan pregled. Isti smjer.** — *Zajedno u istom smjeru.*

Privatni obiteljski dashboard za dvije osobe: objedinjeni pregled Google Calendara (danas, sljedeće, tjedan).
Pristup imaju samo dva Google računa s allowliste. Nema baze podataka, nema registracije.

## Tehnologije

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Auth.js v5 (`next-auth@beta`, Google OAuth, JWT sesija) ·
Google Calendar API (`calendar.readonly`) · Lucide React · timezone `Europe/Zagreb` · Vercel Hobby.

> Ovaj projekt živi u podmapi `stipani/` repozitorija `eai-zdravo-web`. Root repozitorija je zaseban statički web
> (eai-zdravo.com) — Stipani se deploya kao **zasebni Vercel projekt** (vidi "Vercel deploy").

## Lokalno pokretanje

```bash
cd stipani
npm install
cp .env.example .env.local   # popuni vrijednosti
npm run dev                  # http://localhost:3000
```

Provjere: `npm run lint` · `npm run typecheck` · `npm run build`

## Environment varijable

Koristi se Auth.js v5 konvencija (`AUTH_SECRET` / `AUTH_URL`), dosljedno kroz cijeli projekt.

| Varijabla | Opis |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth klijent iz Google Clouda (samo server, nikad `NEXT_PUBLIC_`) |
| `AUTH_SECRET` | dugi random string: `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` lokalno, produkcijski URL na Vercelu |
| `ALLOWED_EMAIL_1`, `ALLOWED_EMAIL_2` | jedini Google računi s pristupom (provjera server-side, lowercase + trim) |
| `USER_1_EMAIL`, `USER_1_CALENDAR_ID` | tvoj račun i kalendar (`primary`) — owner `me` |
| `USER_2_EMAIL`, `USER_2_CALENDAR_ID` | ženin račun i kalendar (`primary`) — owner `wife` |
| `USER_1_NAME`, `USER_2_NAME` | *opcionalno* — prikazana imena (inače ime iz Google profila) |

Ako allowlista nije postavljena, **nitko** ne može ući (fail-closed).

## Kako se čitaju dva kalendara (bez baze)

Svaka osoba se prijavljuje **svojim** Google računom; server čita:

- vlastiti kalendar (`primary`) i
- kalendar druge osobe **ako ga je ona podijelila** (Google Calendar → Postavke kalendara → *Dijeljenje s određenim osobama* →
  dodaj partnerov email s pravom *Vidi sve pojedinosti o događaju*). Kalendar se dohvaća po njezinom emailu.

Ako drugi kalendar nije dostupan, aplikacija ne pada: prikaže dostupne događaje i poruku
"Jedan kalendar trenutno nije dostupan." s gumbom za ponovno učitavanje. Isti događaj u oba kalendara (isti `iCalUID`)
ili događaj s oba pozvana označava se kao **Zajedno** (maslinasta).

## Google Cloud postavljanje

1. Otvori [Google Cloud Console](https://console.cloud.google.com/).
2. Kreiraj novi projekt, npr. `Stipani App`.
3. **APIs & Services → Library →** omogući **Google Calendar API**.
4. **OAuth consent screen:** tip *External*, upiši naziv "Stipani" i svoj email.
5. **Audience → Test users:** dodaj **oba** Google računa.
6. **Data access (Scopes):** dodaj `https://www.googleapis.com/auth/calendar.readonly` (uz `openid`, `email`, `profile`).
7. **Credentials → Create credentials → OAuth client ID.**
8. Tip aplikacije: **Web application**.
9. Authorized redirect URI (lokalno): `http://localhost:3000/api/auth/callback/google`
10. Nakon Vercel deploya dodaj: `https://TVOJ-STIPANI-PROJEKT.vercel.app/api/auth/callback/google`
11. Kopiraj *Client ID* u `GOOGLE_CLIENT_ID`.
12. Kopiraj *Client secret* u `GOOGLE_CLIENT_SECRET`.
13. Provjeri da su oba računa na popisu test usera.

**Važno — 7-dnevni istek u "Testing" modu:** dok je consent screen u statusu *Testing*, Google ističe refresh token nakon
7 dana pa se moraš ponovno prijaviti (aplikacija to pristojno javlja: "Sesija je istekla. Prijavi se ponovno."). Za trajnu
prijavu prebaci consent screen na **In production** — za 2 korisnika ne treba verifikacija, samo se pri prvoj prijavi pojavi
upozorenje "Google hasn't verified this app" (*Advanced → Go to Stipani*).

### Scope

MVP traži samo `calendar.readonly` (najmanje potrebno). Za fazu 2 (kreiranje/uređivanje događaja) pripremljena je
konstanta `CALENDAR_EVENTS_SCOPE` (`calendar.events`) u `lib/scopes.ts` — zasad se **ne** traži.

## Vercel deploy (Hobby/Free)

1. Pushaj repozitorij na GitHub.
2. Vercel → **Add New… → Project** → importaj repozitorij.
3. **Root Directory: `stipani`** (framework se prepozna kao Next.js). Ovo je zaseban projekt od web stranice u rootu.
4. Dodaj Environment Variables (tablica gore) — `AUTH_URL` = URL Vercel projekta.
5. **Deploy**.
6. Kopiraj dobiveni URL i dodaj `…/api/auth/callback/google` u Google OAuth redirect URI-je.
7. Ažuriraj `AUTH_URL` ako treba i **ponovno deployaj** (nakon svake promjene env varijabli treba novi deployment).

CLI (opcionalno): `npm i -g vercel && cd stipani && vercel login && vercel && vercel --prod`

## Obiteljska fotografija

1. Pripremi jednu obiteljsku fotografiju.
2. Preimenuj je u `family-photo.jpg`.
3. Stavi je u `public/family-photo.jpg`.
4. Pokreni aplikaciju.
5. Ako slike nema, aplikacija radi normalno (gradijent placeholder na desktopu, sakriveno na mobitelu i loginu — nema broken imagea).

## Sigurnost

- Allowlista se provjerava **server-side** u Auth.js `signIn` callbacku (email mora biti verificiran) i ponovno u `jwt` callbacku
  — nedopušteni korisnik nikad ne dobije sesiju; brisanje emaila s allowliste poništava postojeće sesije.
- Google tokeni žive samo u šifriranom (JWE) HttpOnly session cookieju; **nikad** u session objektu, API odgovoru ili klijentu.
  Calendar API se zove isključivo iz `/api/calendar/events`.
- `/api/calendar/events`: bez sesije → HTTP 401, `Cache-Control: no-store`, validacija `from`/`to`.
- Opisi događaja pretvaraju se u čisti tekst i renderiraju kroz React (bez `dangerouslySetInnerHTML`).
- Dopušteni emailovi se nikad ne prikazuju; stack trace se nikad ne prikazuje; tokeni se ne logiraju.
- `npm audit` prijavljuje PostCSS savjet unutar Next.js-a; odnosi se na build-time obradu vlastitog CSS-a (nema korisničkog
  inputa), a popravak traži skok na Next 16 — odgođeno.

## Test checklista

1. Neprijavljen → `/login` · 2. dopušten račun ulazi · 3. nedopušten dobiva poruku · 4. odjava radi ·
5. `/dashboard`, `/week` zaštićeni · 6. API bez sesije = 401 · 7. događaji se učitavaju, all-day na vrhu, sortirani ·
8. modal (Esc, fokus, scroll) · 9. Osvježi + toast · 10. loading/error/empty stanja · 11. mobitel bez horizontalnog scrolla ·
12. `npm run lint && npm run typecheck && npm run build`.

## Poznata ograničenja MVP-a

- Kalendar druge osobe vidi se samo ako ga je podijelila s tobom.
- Bez ručnog OAuth-a "za drugu osobu": svaka osoba čita s vlastitim tokenom (nema baze za pohranu tuđih tokena).
- Tjedni pregled je vertikalni timeline (ne mrežni grid); nema filtra "Važno" (Google za to nema podatak).
- Osvježavanje je polling svakih 5 min dok je stranica otvorena; nema webhookova/pusha.
- Samo čitanje — nema kreiranja, uređivanja ni brisanja događaja.
- U Testing modu Google consent screena prijava traje 7 dana.

## Ideje za fazu 2

Kreiranje događaja (`calendar.events`) · zajednička lista obaveza (Vercel KV/Upstash) · Google Calendar push webhook ·
jutarnji digest (email/Telegram) · browser push · mjesečni prikaz · PWA ("dodaj na početni zaslon").
