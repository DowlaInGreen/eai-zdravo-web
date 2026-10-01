-- RAG shema za E-AI zdravo. Pokreni na Vercel Postgres (Neon) bazi:
--   psql "$POSTGRES_URL" -f scripts/rag-schema.sql
-- Idempotentno: sigurno ponovno pokrenuti nad postojećom bazom.

create extension if not exists vector;

create table if not exists rag_documents (
  id serial primary key,
  slug text unique not null,
  title text not null,
  category text not null,
  tags text[] default '{}',
  sources jsonb default '[]',
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Hash sadržaja + postavki chunkanja/modela: ingest preskače nepromijenjene
-- dokumente (ne plaća ponovno embeddings).
alter table rag_documents add column if not exists content_hash text;

create table if not exists rag_chunks (
  id serial primary key,
  document_id integer not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now(),
  unique (document_id, chunk_index)
);

-- HNSW umjesto IVFFlat: IVFFlat napravljen nad praznom tablicom ima loše
-- centroide i propušta relevantne chunkove dok se indeks ne izgradi ponovno.
-- HNSW radi ispravno od prvog upisanog reda, bez reindeksiranja.
drop index if exists rag_chunks_embedding_idx;
create index if not exists rag_chunks_embedding_hnsw_idx
  on rag_chunks using hnsw (embedding vector_cosine_ops);
