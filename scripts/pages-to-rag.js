// Generira rag-content/<kategorija>/*.md iz objavljenih Q&A stranica baze znanja
// (prehrana.html, trening.html). Jedan dokument po sekciji (dijeta/program):
// uvod + svako pitanje i odgovor kao zaseban odlomak (chunker reže po odlomcima,
// pa pitanje ostaje uz svoj odgovor) + izvori s URL-ovima.
//
// Pokretanje nakon svake izmjene stranice: node scripts/pages-to-rag.js
// Zatim: node scripts/rag-ingest.js (upisuje samo promijenjene dokumente).
//
// Web stranica je izvor istine — generirane .md fajlove ne uređuj ručno.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  { file: 'prehrana.html', category: 'prehrana', url: 'https://www.eai-zdravo.com/prehrana', prefix: 'dijeta' },
  { file: 'trening.html', category: 'trening', url: 'https://www.eai-zdravo.com/trening', prefix: 'trening' },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", nbsp: ' ' };
function text(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x27|#39|amp|lt|gt|quot|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
}

function yamlString(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parsePage(html) {
  const sections = [];
  const re = /<section id="([^"]+)" class="diet">([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, id, body] = m;
    const title = text(body.match(/<h2>([\s\S]*?)<\/h2>/)[1]).replace(/^\d+\.\s*/, '');
    const lead = text((body.match(/<p class="lead">([\s\S]*?)<\/p>/) || [, ''])[1]);
    const qa = [...body.matchAll(/<details><summary><h3>([\s\S]*?)<\/h3><\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
      .map(([, q, a]) => ({ q: text(q), a: text(a) }));
    const sources = [...body.matchAll(/<li><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/li>/g)]
      .map(([, href, label]) => `${text(label)}: ${text(href)}`);
    sections.push({ id, title, lead, qa, sources });
  }
  return sections;
}

function toMarkdown(section, page) {
  const lines = [
    '---',
    `title: ${yamlString(`${section.title} — pitanja i odgovori`)}`,
    `category: ${page.category}`,
    `tags: [${page.category}, ${section.id}, q-and-a]`,
    'sources:',
    ...section.sources.map((s) => `  - ${yamlString(s)}`),
    `  - ${yamlString(`E-AI zdravo baza znanja: ${page.url}#${section.id}`)}`,
    '---',
    '',
    `<!-- Generirano iz ${page.file} skriptom scripts/pages-to-rag.js. Ne uređuj ručno. -->`,
    '',
    section.lead,
    '',
  ];
  for (const { q, a } of section.qa) lines.push(`**${q}** ${a}`, '');
  return lines.join('\n');
}

function main() {
  let total = 0;
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
    const sections = parsePage(html);
    if (sections.length === 0) throw new Error(`${page.file}: nije pronađena nijedna sekcija`);
    const dir = path.join(ROOT, 'rag-content', page.category);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of sections) {
      if (s.qa.length === 0) throw new Error(`${page.file}#${s.id}: nema pitanja`);
      if (s.sources.length === 0) throw new Error(`${page.file}#${s.id}: nema izvora`);
      const out = path.join(dir, `${page.prefix}-${s.id}.md`);
      fs.writeFileSync(out, toMarkdown(s, page));
      console.log(`  ✓ ${path.relative(ROOT, out)} — ${s.qa.length} pitanja, ${s.sources.length} izvora`);
      total++;
    }
  }
  console.log(`Gotovo: ${total} dokumenata.`);
}

if (require.main === module) main();
module.exports = { parsePage, toMarkdown, text };
