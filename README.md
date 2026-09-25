# eai-zdravo-web

Landing stranica za **eai-zdravo.com** — "Jedite zdravo i povoljno".

- `index.html` — landing (responzivan: mobitel, tablet, desktop)
- `api/subscribe.js` — prijava u Brevo s double opt-in
- `hvala.html`, `privatnost.html`, `404.html`
- `assets/` — logo, hero, favicon, OG slika

Deploy: svaki push na `main` automatski ide na Vercel. Upute za održavanje i agenta: [AGENT.md](AGENT.md).

Lokalno: `python3 -m http.server 8000` (forma radi samo na Vercelu).
