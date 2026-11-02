/** Raw SQL client for CLI scripts (migrate/seed/enrich). See src/db/raw.ts. */
import { connectRaw, type SqlClient } from "../src/db/raw";

export type { SqlClient };

export async function connect(): Promise<SqlClient> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  // Test hook: the build sandbox has no npm access, so tests swap in a psql-based client.
  if (url?.startsWith("psql-test:")) return (await import(process.env.TRIPLAN_TEST_CLIENT as string)).connectTest(url);
  return connectRaw(url);
}
