/**
 * Picks extra slideshow photos from imported, freely licensed destination photos (hero-quality
 * landscape images only), rotating across continents and kinds of place for variety.
 */
export function pickDiverseHero<T extends { continent: string; kind: string; popularity: number; slug: string }>(candidates: T[], count: number): T[] {
  const groups = new Map<string, T[]>();
  for (const c of [...candidates].sort((a, b) => b.popularity - a.popularity)) {
    const g = groups.get(c.continent) ?? [];
    g.push(c);
    groups.set(c.continent, g);
  }
  const lastKind = new Map<string, string>();
  const out: T[] = [];
  const seen = new Set<string>();
  while (out.length < count && [...groups.values()].some((g) => g.length)) {
    for (const [continent, g] of groups) {
      if (!g.length || out.length >= count) continue;
      // Prefer a different kind of place from the last one taken on this continent.
      const i = Math.max(0, g.findIndex((c) => c.kind !== lastKind.get(continent)));
      const [pick] = g.splice(i, 1);
      if (seen.has(pick.slug)) continue;
      seen.add(pick.slug);
      lastKind.set(continent, pick.kind);
      out.push(pick);
    }
  }
  return out;
}
