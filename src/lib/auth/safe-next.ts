/** Only allow same-origin relative return paths (blocks open redirects like //evil.com or /\evil.com). */
export function safeNext(next: unknown, fallback = "/trips"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next.slice(0, 500);
}
