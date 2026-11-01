/** Applies SQL files in db/migrations in lexical order, once each. */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./load-env";
import { connect } from "./db-client";

async function main() {
  loadEnv();
  const db = await connect();
  await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await db.query<{ name: string }>(`SELECT name FROM _migrations`)).map((r) => r.name));
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`→ applying ${file} … `);
    await db.exec(`BEGIN;\n${sql}\nINSERT INTO _migrations(name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`);
    console.log("done");
  }
  console.log("Migrations up to date.");
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
