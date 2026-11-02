/**
 * Imports Wikipedia/Wikimedia/Wikidata content for destinations that don't have it yet.
 *   npm run enrich                      # up to 4 minutes
 *   npm run enrich -- --budget=60       # seconds
 *   npm run enrich -- --slug=porto,rome # specific destinations (re-import)
 * Never fails the build: network problems are logged and retried on the next run.
 */
import { loadEnv } from "./load-env";
import { connect } from "./db-client";
import { enrichBatch } from "../src/lib/enrich/run";

async function main() {
  loadEnv();
  if (process.env.TRIPLAN_SKIP_ENRICH === "1") {
    console.log("Content import skipped (TRIPLAN_SKIP_ENRICH=1).");
    return;
  }
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const budgetSec = Number(arg("budget") ?? 240);
  const slugs = arg("slug")?.split(",").filter(Boolean);
  const db = await connect();
  try {
    console.log(`Importing destination content (time budget ${budgetSec}s)…`);
    const s = await enrichBatch(db, { budgetMs: budgetSec * 1000, slugs, log: (m) => console.log(m) });
    console.log(`Content import: ${s.done} done, ${s.partial} partial, ${s.failed} failed; ${s.remaining} destinations still pending.`);
  } catch (e) {
    console.warn(`Content import stopped: ${(e as Error).message}. It will resume on the next run.`);
  } finally {
    await db.close();
  }
}

main().catch((e) => console.warn(`Content import could not start: ${(e as Error).message}`));
