import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Fallback URL allows build to succeed when DATABASE_URL is unset; runtime requires DATABASE_URL.
const connectionString =
  process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
