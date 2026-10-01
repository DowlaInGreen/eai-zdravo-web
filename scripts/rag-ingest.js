// RAG ingestion: čita rag-content/**/*.md, chunka, embedduje (OpenRouter), upisuje u Postgres (pgvector).
//
// Env potreban: POSTGRES_URL (Vercel Postgres/Neon), OPENROUTER_API_KEY
// Pokretanje:
//   node scripts/rag-ingest.js            # upis u bazu
//   node scripts/rag-ingest.js --dry-run  # samo parsiranje + chunkanje, bez mreže i baze
//
// Ponašanje:
// - Idempotentno po slugu: izmijenjen dokument dobiva nove chunkove, nepromijenjen
//   (isti hash teksta + postavki) se preskače i ne troši embeddings.
// - Dokumenti čiji .md fajl više ne postoji brišu se iz baze (prune).
// - Svaki dokument upisuje se u jednoj transakciji: pola-upisan dokument ne postoji.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONTENT_DIR = path.join(__dirname, '..', 'rag-content');
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const CHUNK_SIZE = 700; // znakova po chunku, grubo ~150-200 tokena
const CHUNK_OVERLAP = 100;

function parseFrontmatter(raw) {
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
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
  // HTML komentari (npr. oznaka "generirano, ne uređuj") nisu sadržaj i ne idu u embedding.
  return { frontmatter: fm, body: body.replace(/<!--[\s\S]*?-->/g, '').trim() };
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

// Tekst koji se embedduje: naslov dokumenta + chunk. Bez naslova chunk iz
// sredine članka ("Praktično za tjedni plan: ...") ne zna o čemu je članak,
// pa ga upit "što jesti u trudnoći" ne nalazi.
function embeddingInput(title, chunk) {
  return `${title}\n\n${chunk}`;
}

function contentHash(raw) {
  return crypto
    .createHash('sha256')
    .update(`${EMBEDDING_MODEL}|${CHUNK_SIZE}|${CHUNK_OVERLAP}|v2|${raw}`)
    .digest('hex');
}

function findMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMarkdownFiles(full));
    else if (entry.name.endsWith('.md') && entry.name !== 'README.md') out.push(full);
  }
  return out.sort();
}

// Učita i provjeri sve dokumente prije ijednog mrežnog poziva: greška u jednom
// fajlu ne smije ostaviti bazu napola ažuriranu.
function loadDocuments(dir = CONTENT_DIR) {
  const docs = [];
  const seen = new Map();
  for (const file of findMarkdownFiles(dir)) {
    const slug = path.basename(file, '.md');
    if (seen.has(slug)) {
      throw new Error(`Duplikat sluga "${slug}": ${seen.get(slug)} i ${file}`);
    }
    seen.set(slug, file);
    const raw = fs.readFileSync(file, 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    if (!frontmatter.title) throw new Error(`${file}: nedostaje title u frontmatteru`);
    if (!body) throw new Error(`${file}: prazan sadržaj`);
    const title = frontmatter.title;
    const chunks = chunkText(body, CHUNK_SIZE, CHUNK_OVERLAP);
    docs.push({
      file,
      slug,
      title,
      category: frontmatter.category || path.basename(path.dirname(file)),
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      sources: frontmatter.sources || [],
      body,
      chunks,
      hash: contentHash(raw),
    });
  }
  return docs;
}

async function embed(texts) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.SITE_URL || 'https://www.eai-zdravo.com',
      'X-Title': 'E-AI zdravo RAG ingest',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenRouter embeddings ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.data || json.data.length !== texts.length) {
    throw new Error(`OpenRouter embeddings: očekivano ${texts.length} vektora, dobiveno ${json.data?.length}`);
  }
  return json.data.map((d) => d.embedding);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const docs = loadDocuments();
  const totalChunks = docs.reduce((n, d) => n + d.chunks.length, 0);
  console.log(`Pronađeno ${docs.length} dokumenata, ${totalChunks} chunkova u rag-content/`);

  if (dryRun) {
    for (const d of docs) console.log(`  · ${d.category}/${d.slug} — ${d.chunks.length} chunk(ova), ${d.sources.length} izvor(a)`);
    console.log('Dry run: ništa nije upisano.');
    return;
  }

  if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL nije postavljen');
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY nije postavljen');

  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  let written = 0;
  let skipped = 0;
  try {
    const { rows: existing } = await client.query('select slug, content_hash from rag_documents');
    const existingHash = new Map(existing.map((r) => [r.slug, r.content_hash]));

    for (const d of docs) {
      if (existingHash.get(d.slug) === d.hash) {
        skipped++;
        continue;
      }
      const embeddings = await embed(d.chunks.map((c) => embeddingInput(d.title, c)));

      await client.query('begin');
      try {
        const docResult = await client.query(
          `insert into rag_documents (slug, title, category, tags, sources, content, content_hash, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, now())
           on conflict (slug) do update set
             title = excluded.title, category = excluded.category, tags = excluded.tags,
             sources = excluded.sources, content = excluded.content,
             content_hash = excluded.content_hash, updated_at = now()
           returning id`,
          [d.slug, d.title, d.category, d.tags, JSON.stringify(d.sources), d.body, d.hash]
        );
        const documentId = docResult.rows[0].id;
        await client.query('delete from rag_chunks where document_id = $1', [documentId]);
        for (let i = 0; i < d.chunks.length; i++) {
          await client.query(
            `insert into rag_chunks (document_id, chunk_index, content, embedding)
             values ($1, $2, $3, $4)`,
            [documentId, i, d.chunks[i], `[${embeddings[i].join(',')}]`]
          );
        }
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
      written++;
      console.log(`  ✓ ${d.slug} — ${d.chunks.length} chunk(ova)`);
    }

    const slugs = docs.map((d) => d.slug);
    const pruned = await client.query(
      'delete from rag_documents where not (slug = any($1)) returning slug',
      [slugs]
    );
    for (const r of pruned.rows) console.log(`  ✗ obrisan ${r.slug} (fajl više ne postoji)`);

    const { rows: [counts] } = await client.query(
      'select (select count(*) from rag_documents) as docs, (select count(*) from rag_chunks) as chunks'
    );
    console.log(
      `Gotovo: ${written} upisano, ${skipped} nepromijenjeno, ${pruned.rowCount} obrisano. ` +
      `Baza: ${counts.docs} dokumenata, ${counts.chunks} chunkova.`
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { parseFrontmatter, chunkText, embeddingInput, contentHash, loadDocuments, CHUNK_SIZE, CHUNK_OVERLAP };
