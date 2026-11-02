/**
 * HTTP helper for Wikimedia APIs. Wikimedia's API etiquette requires an identifying User-Agent with a
 * way to contact the operator, sequential requests and backing off on 429/503.
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

let fetcher: Fetcher = (url, init) => fetch(url, init);
/** Tests replace the network with fixtures. */
export function setFetcher(f: Fetcher) {
  fetcher = f;
}

export function userAgent(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://triplan.example";
  const contact = process.env.WIKIMEDIA_CONTACT || process.env.CONTACT_INBOX || site;
  return `TRIPLAN-content-import/1.0 (${site}; ${contact})`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T>(url: string, opts: { timeoutMs?: number; retries?: number; accept?: string } = {}): Promise<T> {
  const { timeoutMs = 20_000, retries = 2, accept = "application/json" } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(url, { headers: { "User-Agent": userAgent(), "Api-User-Agent": userAgent(), Accept: accept }, signal: ctrl.signal });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${new URL(url).host}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const qs = (params: Record<string, string | number | boolean>) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
