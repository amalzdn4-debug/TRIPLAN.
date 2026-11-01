/**
 * Promote an existing user to admin (or demote with --revoke).
 *   npm run make-admin -- someone@example.com
 *   npm run make-admin -- someone@example.com --revoke
 */
import { loadEnv } from "./load-env";
import { connect } from "./db-client";

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  const role = args.includes("--revoke") ? "user" : "admin";
  if (!email) {
    console.error("Usage: npm run make-admin -- <email> [--revoke]");
    process.exitCode = 1;
    return;
  }
  const db = await connect();
  const rows = await db.query(`UPDATE users SET role = $1, updated_at = now() WHERE lower(email) = $2 RETURNING id`, [role, email]);
  if (!rows.length) {
    console.error(`No user found with email ${email}. They must sign up first.`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now ${role}.`);
  }
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
