// Mjeri kvalitetu retrievala nad živom bazom (bez LLM generacije — jeftino).
// Env: POSTGRES_URL, OPENROUTER_API_KEY. Pokretanje: node scripts/rag-eval.js
//
// Ispis po pitanju: najbolji slug + sličnost, pogodak u top 5.
// Sažetak: recall@5 za pokrivena pitanja i preporučeni RAG_MIN_SIMILARITY —
// prag između najslabijeg točnog pogotka i najjačeg rezultata za nepokrivena pitanja.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const TOP_K = 5;

async function embed(texts) {
  const r = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'X-Title': 'E-AI zdravo RAG eval',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!r.ok) throw new Error(`OpenRouter embeddings ${r.status}: ${await r.text()}`);
  return (await r.json()).data.map((d) => d.embedding);
}

async function main() {
  if (!process.env.POSTGRES_URL || !process.env.OPENROUTER_API_KEY) {
    throw new Error('Potrebni POSTGRES_URL i OPENROUTER_API_KEY');
  }
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'rag-eval.json'), 'utf8'));
  const vectors = await embed(cases.map((c) => c.q));
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  let covered = 0, hits = 0;
  const hitSims = [], offTopicSims = [];
  try {
    for (let i = 0; i < cases.length; i++) {
      const { q, expect } = cases[i];
      const { rows } = await client.query(
        `select d.slug, 1 - (c.embedding <=> $1::vector) as sim
         from rag_chunks c join rag_documents d on d.id = c.document_id
         order by c.embedding <=> $1::vector limit $2`,
        [`[${vectors[i].join(',')}]`, TOP_K]
      );
      const top = rows[0] || { slug: '-', sim: 0 };
      if (expect.length === 0) {
        offTopicSims.push(Number(top.sim));
        console.log(`OFF  ${Number(top.sim).toFixed(3)}  ${top.slug.padEnd(38)} ${q}`);
        continue;
      }
      covered++;
      const hit = rows.find((r) => expect.includes(r.slug));
      if (hit) { hits++; hitSims.push(Number(hit.sim)); }
      console.log(`${hit ? 'HIT ' : 'MISS'} ${Number(top.sim).toFixed(3)}  ${top.slug.padEnd(38)} ${q}`);
    }
  } finally {
    await client.end();
  }

  const minHit = Math.min(...hitSims);
  const maxOff = Math.max(...offTopicSims);
  console.log(`\nrecall@${TOP_K}: ${hits}/${covered} (${((hits / covered) * 100).toFixed(0)} %)`);
  console.log(`najslabiji točan pogodak: ${minHit.toFixed(3)} · najjači nepokriven: ${maxOff.toFixed(3)}`);
  if (minHit > maxOff) {
    console.log(`preporuka: RAG_MIN_SIMILARITY=${((minHit + maxOff) / 2).toFixed(2)} (u Vercel env)`);
  } else {
    console.log('upozorenje: pragovi se preklapaju — dio nepokrivenih pitanja dobit će odgovor. Ostavi 0.30 i dodaj sadržaj.');
  }
  if (hits / covered < 0.9) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
