import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient, type QueryResult } from 'pg';

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error('SUPABASE_DATABASE_URL is required for the PostgreSQL-backed API.');
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX) || 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  keepAlive: true
});

types.setTypeParser(20, Number);

interface RequestDatabase {
  client: PoolClient;
  inTransaction: boolean;
}

const requestClient = new AsyncLocalStorage<RequestDatabase>();
let databaseReady: Promise<void> | undefined;

function postgresPlaceholders(sql: string): string {
  let result = '';
  let position = 0;
  let placeholder = 0;
  let quote: "'" | '"' | '`' | null = null;
  let lineComment = false;
  let blockComment = false;

  while (position < sql.length) {
    const char = sql[position];
    const next = sql[position + 1];

    if (lineComment) {
      result += char;
      if (char === '\n') lineComment = false;
      position++;
      continue;
    }
    if (blockComment) {
      result += char;
      if (char === '*' && next === '/') {
        result += next;
        position += 2;
        blockComment = false;
      } else {
        position++;
      }
      continue;
    }
    if (quote) {
      result += char;
      if (char === quote) {
        if (next === quote) {
          result += next;
          position += 2;
          continue;
        }
        quote = null;
      } else if (char === '\\' && quote === "'" && next) {
        result += next;
        position += 2;
        continue;
      }
      position++;
      continue;
    }

    if (char === '-' && next === '-') {
      result += '--';
      position += 2;
      lineComment = true;
    } else if (char === '/' && next === '*') {
      result += '/*';
      position += 2;
      blockComment = true;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
      result += char === '`' ? '"' : char;
      position++;
    } else if (char === '?') {
      result += `$${++placeholder}`;
      position++;
    } else {
      result += char;
      position++;
    }
  }

  return result;
}

async function execute<T extends object = Record<string, unknown>>(
  sql: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  const context = requestClient.getStore();
  const statement = postgresPlaceholders(sql);
  return context
    ? context.client.query<T>(statement, values)
    : pool.query<T>(statement, values);
}

export const db = {
  prepare(sql: string) {
    return {
      async get<T extends object = Record<string, unknown>>(...values: unknown[]): Promise<T | undefined> {
        const result = await execute<T>(sql, values);
        return result.rows[0];
      },
      async all<T extends object = Record<string, unknown>>(...values: unknown[]): Promise<T[]> {
        const result = await execute<T>(sql, values);
        return result.rows;
      },
      async run(...values: unknown[]): Promise<{ changes: number }> {
        const result = await execute(sql, values);
        return { changes: result.rowCount || 0 };
      }
    };
  },
  async exec(sql: string): Promise<void> {
    await execute(sql);
    const command = sql.trim().toUpperCase();
    const context = requestClient.getStore();
    if (!context) return;
    if (command.startsWith('BEGIN')) context.inTransaction = true;
    if (command.startsWith('COMMIT') || command.startsWith('ROLLBACK')) {
      context.inTransaction = false;
    }
  }
};

export async function initDatabase(): Promise<void> {
  const readiness = databaseReady ??= (async () => {
    await pool.query('SELECT 1');
    await pool.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('users', 'projects', 'teams', 'materials', 'material_requests')
      GROUP BY table_schema
      HAVING count(*) = 5
    `).then((result) => {
      if (result.rowCount !== 1) {
        throw new Error('Supabase schema is incomplete. Apply the migrations in supabase/migrations before deploying.');
      }
    });
  })();

  try {
    await readiness;
  } catch (error) {
    if (databaseReady === readiness) databaseReady = undefined;
    throw error;
  }
}

export async function withDatabaseConnection(
  _req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): Promise<void> {
  try {
    await initDatabase();
    const client = await pool.connect();
    const context: RequestDatabase = { client, inTransaction: false };
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (!context.inTransaction) {
        client.release();
        return;
      }
      void client.query('ROLLBACK')
        .then(() => client.release())
        .catch((error: unknown) => {
          console.error('Failed to clean up the request database transaction:', error);
          client.release(error instanceof Error ? error : new Error(String(error)));
        });
    };
    res.once('finish', release);
    res.once('close', release);
    requestClient.run(context, next);
  } catch (error) {
    next(error);
  }
}
