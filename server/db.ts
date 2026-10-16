import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface QueryResult<T> { rows: T[]; rowCount: number }
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<QueryResult<T>>;
}
export interface Database extends Queryable {
  transaction<T>(work: (transaction: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function pgQuery(client: Pool | PoolClient): Queryable {
  return {
    async query<T>(sql: string, parameters: unknown[] = []) {
      const result = await client.query<QueryResultRow>(sql, parameters);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    },
  };
}

/** No database or TLS fallback: production must explicitly supply DATABASE_URL. */
export async function createDatabase(options: { connectionString?: string; localPath?: string }): Promise<Database> {
  if (options.connectionString) {
    const pool = new Pool({ connectionString: options.connectionString, max: 5, connectionTimeoutMillis: 10_000 });
    return {
      ...pgQuery(pool),
      async transaction<T>(work: (transaction: Queryable) => Promise<T>) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work(pgQuery(client));
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (!options.localPath || process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('A production Postgres connection is required. Local storage is permitted only in explicit local development.');
  }
  const localPath = options.localPath.startsWith('file://') ? fileURLToPath(options.localPath) : options.localPath;
  if (!localPath.startsWith('memory://')) await mkdir(dirname(resolve(localPath)), { recursive: true });
  const local = await PGlite.create(localPath);
  const wrap = (client: Pick<PGlite, 'query'>): Queryable => ({
    async query<T>(sql: string, parameters: unknown[] = []) {
      const result = await client.query<T>(sql, parameters);
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    },
  });
  return {
    ...wrap(local),
    transaction: (work) => local.transaction((transaction) => work(wrap(transaction))),
    close: () => local.close(),
  };
}
