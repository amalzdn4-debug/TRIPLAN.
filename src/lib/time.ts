/** "930" / "9.30" / "9:3" / "16" → "09:30" / "09:30" / "09:30" / "16:00"; "" stays ""; anything invalid → null. */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim().replace(/[.,h]/gi, ":");
  if (!s) return "";
  let h: number;
  let min: number;
  if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, -2));
    min = Number(s.slice(-2));
  } else {
    const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    h = Number(m[1]);
    min = m[2] == null ? 0 : Number(m[2].length === 1 ? m[2] + "0" : m[2]);
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Typing helper: digits become HH:MM as you type ("930" → "09:30", "1630" → "16:30"); a typed ":" is kept. */
export function maskTime(raw: string): string {
  const cleaned = raw.replace(/[.,h]/gi, ":").replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [h, m = ""] = cleaned.split(":");
    return `${h.slice(0, 2)}:${m.replace(/:/g, "").slice(0, 2)}`;
  }
  let d = cleaned.slice(0, 4);
  if (d.length >= 2 && Number(d.slice(0, 2)) > 23) d = `0${d}`.slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

