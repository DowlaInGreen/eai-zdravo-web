// Shared Postgres pool for app endpoints (same Neon DB as RAG, env POSTGRES_URL).
// One pool per warm serverless instance; small max so Neon connection limits hold.
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!process.env.POSTGRES_URL) return null;
  if (!pool) {
    const url = process.env.POSTGRES_URL;
    const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url) || url.includes('host=/');
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10000,
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function withTx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { getPool, withTx, closePool };
