import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { randomToken, sha256 } from "./crypto";

type TokenType = "verify_email" | "reset_password";
const TTL: Record<TokenType, number> = { verify_email: 48 * 3600_000, reset_password: 3600_000 };

export async function issueToken(userId: string, type: TokenType): Promise<string> {
  const db = await getDb();
  const token = randomToken(32);
  await db.insert(schema.authTokens).values({
    userId,
    type,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + TTL[type]),
  });
  return token;
}

/** Marks the token used and returns its user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const db = await getDb();
  const rows = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.tokenHash, sha256(token)),
        eq(schema.authTokens.type, type),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.authTokens.userId });
  return rows[0]?.userId ?? null;
}
