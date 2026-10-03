import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';
import path from 'node:path';

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('SUPABASE_DATABASE_URL is required to run the migration.');
}

const sqlitePath = path.resolve(process.cwd(), 'data', 'decko_materials.db');
const sqlite = new DatabaseSync(sqlitePath);
const postgres = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15000 });

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function migrate() {
  await postgres.connect();
  try {
    const existingTables = await postgres.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    if (existingTables.rows.length > 0) {
      throw new Error('Supabase public schema is not empty; migration stopped without changing it.');
    }

    const definitions = sqlite.prepare(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string; sql: string }>;

    const definitionByName = new Map(definitions.map((item) => [item.name, item.sql]));
    const dependencies = new Map<string, string[]>();
    for (const { name } of definitions) {
      const references = sqlite.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(name)})`).all() as Array<{ table: string }>;
      dependencies.set(name, references.map((reference) => reference.table));
    }

    const orderedTables: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) throw new Error(`Foreign-key cycle detected involving table ${name}.`);
      visiting.add(name);
      for (const dependency of dependencies.get(name) || []) visit(dependency);
      visiting.delete(name);
      visited.add(name);
      orderedTables.push(name);
    };
    for (const { name } of definitions) visit(name);

    await postgres.query('BEGIN');
    for (const name of orderedTables) {
      const createSql = definitionByName.get(name);
      if (!createSql) throw new Error(`Missing schema definition for ${name}.`);
      await postgres.query(createSql.replace(/^CREATE TABLE(?! IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS'));
    }

    const migratedCounts: Record<string, number> = {};
    for (const table of orderedTables) {
      const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>;
      if (columns.length === 0) throw new Error(`No columns found for ${table}.`);
      const columnNames = columns.map((column) => column.name);
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as Array<Record<string, unknown>>;
      const columnSql = columnNames.map(quoteIdentifier).join(', ');
      const valueSql = columnNames.map((_, index) => `$${index + 1}`).join(', ');
      const insertSql = `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${valueSql})`;
      for (const row of rows) {
        await postgres.query(insertSql, columnNames.map((column) => row[column]));
      }
      migratedCounts[table] = rows.length;
    }

    for (const table of orderedTables) {
      const result = await postgres.query(`SELECT count(*)::integer AS count FROM ${quoteIdentifier(table)}`);
      if (result.rows[0].count !== migratedCounts[table]) {
        throw new Error(`Row count verification failed for ${table}.`);
      }
    }

    await postgres.query('COMMIT');
    console.log(JSON.stringify({ migratedTables: orderedTables.length, migratedRowCounts: migratedCounts }, null, 2));
  } catch (error) {
    await postgres.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await postgres.end();
    sqlite.close();
  }
}

migrate().catch((error: unknown) => {
  console.error('Supabase migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
