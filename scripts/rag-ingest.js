// RAG ingestion: čita rag-content/**/*.md, chunka, embedduje (OpenAI), upisuje u Postgres (pgvector).
//
// Env potreban: POSTGRES_URL (Vercel Postgres/Neon), OPENAI_API_KEY
// Pokretanje: node scripts/rag-ingest.js
//
// Idempotentno: ponovno pokretanje nad istim slugom briše stare chunkove tog
// dokumenta i upisuje nove, pa je sigurno za ponovno pokretati nakon izmjene teksta.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CONTENT_DIR = path.join(__dirname, '..', 'rag-content');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 700; // znakova po chunku, grubo ~150-200 tokena
const CHUNK_OVERLAP = 100;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Nedostaje frontmatter (--- ... ---) na vrhu fajla');
  const [, fmRaw, body] = match;
  const fm = {};
  for (const line of fmRaw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    let value = valueRaw.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }
  // sources: YAML lista oblika "- \"...\"" na sljedećim linijama nakon "sources:"
  const sourcesBlock = fmRaw.match(/^sources:\s*\n((?:\s*-\s*.*\n?)+)/m);
  if (sourcesBlock) {
    fm.sources = sourcesBlock[1]
      .split('\n')
      .map((l) => l.match(/^\s*-\s*"?(.*?)"?\s*$/))
      .filter(Boolean)
      .map((m) => m[1])
      .filter(Boolean);
  } else if (!Array.isArray(fm.sources)) {
    fm.sources = [];
  }
  return { frontmatter: fm, body: body.trim() };
}

function chunkText(text, size, overlap) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > size && current) {
      chunks.push(current.trim());
      const words = current.split(' ');
      current = words.slice(-Math.ceil(overlap / 6)).join(' ') + '\n\n' + p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embed(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

function findMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMarkdownFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

async function main() {
  if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL nije postavljen');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY nije postavljen');

  const files = findMarkdownFiles(CONTENT_DIR);
  console.log(`Pronađeno ${files.length} .md fajlova u rag-content/`);

  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  let totalChunks = 0;
  for (const file of files) {
    const slug = path.basename(file, '.md');
    const raw = fs.readFileSync(file, 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const chunks = chunkText(body, CHUNK_SIZE, CHUNK_OVERLAP);
    const embeddings = await embed(chunks);

    const docResult = await client.query(
      `insert into rag_documents (slug, title, category, tags, sources, content, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (slug) do update set
         title = excluded.title, category = excluded.category, tags = excluded.tags,
         sources = excluded.sources, content = excluded.content, updated_at = now()
       returning id`,
      [
        slug,
        frontmatter.title || slug,
        frontmatter.category || 'opce',
        frontmatter.tags || [],
        JSON.stringify(frontmatter.sources || []),
        body,
      ]
    );
    const documentId = docResult.rows[0].id;

    await client.query('delete from rag_chunks where document_id = $1', [documentId]);
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `insert into rag_chunks (document_id, chunk_index, content, embedding)
         values ($1, $2, $3, $4)`,
        [documentId, i, chunks[i], `[${embeddings[i].join(',')}]`]
      );
    }
    totalChunks += chunks.length;
    console.log(`  ✓ ${slug} — ${chunks.length} chunk(ova)`);
  }

  await client.end();
  console.log(`Gotovo: ${files.length} dokumenata, ${totalChunks} chunkova ukupno.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
