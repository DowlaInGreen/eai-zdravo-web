-- RAG shema za E-AI zdravo. Pokreni jednom na novoj Vercel Postgres (Neon) bazi:
--   psql "$POSTGRES_URL" -f scripts/rag-schema.sql

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

create table if not exists rag_chunks (
  id serial primary key,
  document_id integer not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now(),
  unique (document_id, chunk_index)
);

create index if not exists rag_chunks_embedding_idx
  on rag_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
