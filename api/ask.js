// POST /api/ask — RAG upit: embeddduje pitanje, dohvaća najbliže chunkove iz
// Postgresa (pgvector cosine), generira odgovor preko Claudea utemeljen samo
// na dohvaćenom kontekstu, s popisom izvornih članaka na dnu.
//
// Env (set in Vercel → Project → Settings → Environment Variables, never in code):
//   POSTGRES_URL       required — Vercel Postgres (Neon), Storage tab → Create Database
//   OPENAI_API_KEY     required — za embeddings (text-embedding-3-small)
//   ANTHROPIC_API_KEY  required — za generaciju odgovora
//
// Dok varijable nisu postavljene, endpoint vraća 503 — ništa se ne lomi tiho.
//
// Tijelo zahtjeva: { "question": "...", "profile"?: { "clanova": 4, "cilj": "mrsavljenje", "dob": [35,34,8,5] } }
// `profile` je opcionalan — kad postoji, ubacuje se u prompt radi personalizacije.

const { Client } = require('pg');
const rateLimit = require('./_lib/rate-limit');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'claude-sonnet-5';
const TOP_K = 5;

async function embedQuery(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI embeddings ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return json.data[0].embedding;
}

async function retrieveChunks(embedding) {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select c.content, d.title, d.slug, d.sources,
              1 - (c.embedding <=> $1) as similarity
       from rag_chunks c
       join rag_documents d on d.id = c.document_id
       order by c.embedding <=> $1
       limit $2`,
      [`[${embedding.join(',')}]`, TOP_K]
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function generateAnswer(question, chunks, profile) {
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.title})\n${c.content}`)
    .join('\n\n');
  const profileLine = profile
    ? `\nProfil korisnika (koristi za personalizaciju ako je relevantno): ${JSON.stringify(profile)}`
    : '';
  const system = `Odgovaraš isključivo na temelju priloženih odlomaka iz baze znanja E-AI zdravo. ` +
    `Ne izmišljaj činjenice izvan konteksta. Ako kontekst ne sadrži odgovor, reci da nemaš tu informaciju ` +
    `umjesto da nagađaš. Piši na hrvatskom, kratko i praktično. Na kraju odgovora navedi brojeve izvora u ` +
    `uglatim zagradama koje si koristio, npr. [1][3].`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: `Kontekst:\n\n${context}${profileLine}\n\nPitanje: ${question}` }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return json.content.map((b) => b.text || '').join('');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.POSTGRES_URL || !process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'RAG još nije aktivan (nedostaju env varijable)' });
  }
  if (!rateLimit.allow(req)) {
    return res.status(429).json({ error: 'Previše upita, pokušaj za koju minutu' });
  }

  const { question, profile } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ error: 'Nedostaje "question"' });
  }

  try {
    const embedding = await embedQuery(question.trim());
    const chunks = await retrieveChunks(embedding);
    if (chunks.length === 0) {
      return res.status(200).json({ answer: 'Baza znanja je prazna — pokreni scripts/rag-ingest.js.', sources: [] });
    }
    const answer = await generateAnswer(question.trim(), chunks, profile);
    const sources = [...new Map(chunks.map((c) => [c.slug, { title: c.title, slug: c.slug }])).values()];
    return res.status(200).json({ answer, sources });
  } catch (err) {
    console.error('RAG /api/ask error:', err);
    return res.status(500).json({ error: 'Greška pri obradi upita' });
  }
};
