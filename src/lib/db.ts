const DEMO_MODE = process.env.DEMO_MODE === "true";

let pool: any = null;

function getPool() {
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (DEMO_MODE) return [];
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: any) => Promise<T>
): Promise<T> {
  if (DEMO_MODE) return undefined as T;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with RLS context by setting the PostgreSQL session variable
 * `app.current_user_upn` before running the query. This activates the
 * ethical wall RLS policies that check current_setting('app.current_user_upn').
 *
 * Uses a transaction so SET LOCAL scopes correctly.
 */
export async function queryAsUser<T = Record<string, unknown>>(
  text: string,
  params: unknown[],
  upn: string
): Promise<T[]> {
  if (DEMO_MODE) return [];
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.current_user_upn = $1", [upn]);
    const result = await client.query(text, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export default { query, queryOne, withTransaction, queryAsUser };
