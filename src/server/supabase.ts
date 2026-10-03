import { Pool } from 'pg';

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error('SUPABASE_DATABASE_URL is required for Supabase-backed authentication.');
}

export const supabase = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 15000
});
