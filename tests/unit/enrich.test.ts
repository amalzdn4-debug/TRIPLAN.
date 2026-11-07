import { describe, it, expect } from "vitest";
import { cleanExtract, shortSummary, fetchArticle } from "@/lib/enrich/wikipedia";
import { isAcceptedLicense, looksLikePhoto, stripHtml, fetchLicensedImages, fileFromCommonsUrl, wikimediaThumb } from "@/lib/enrich/commons";
import { cleanWebsite, parsePoint, rowsToPlaces, TICKETED_TYPES } from "@/lib/enrich/wikidata";
import { setFetcher } from "@/lib/enrich/http";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Wikipedia text", () => {
  it("removes pronunciation guides and citation brackets", () => {
    const t = cleanExtract("Porto (Portuguese pronunciation: [ˈpoɾtu]) is the second-largest city in Portugal.[1] It is famous ( ) for wine.");
    expect(t).toBe("Porto is the second-largest city in Portugal. It is famous for wine.");
  });
  it("cuts long text at a sentence boundary", () => {
    const t = cleanExtract("A".repeat(50) + ". " + "B".repeat(80) + ". " + "C".repeat(200) + ".", 150);
    expect(t.endsWith(".")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(150);
  });
  it("builds a short summary from whole sentences", () => {
    expect(shortSummary("One two. Three four five. Six.", 20)).toBe("One two.");
  });
});

describe("Wikimedia licences", () => {
  it("accepts free licences only", () => {
    for (const ok of ["CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain", "CC-BY-SA-3.0", "Attribution"]) expect(isAcceptedLicense(ok), ok).toBe(true);
    for (const bad of ["Fair use", "", "All rights reserved", "GFDL", undefined]) expect(isAcceptedLicense(bad as string), String(bad)).toBe(false);
  });
  it("skips maps, flags, logos, collages and vector files", () => {
    expect(looksLikePhoto("File:Ribeira do Porto.jpg", "image/jpeg")).toBe(true);
    expect(looksLikePhoto("File:Porto montage.jpg", "image/jpeg")).toBe(false);
    expect(looksLikePhoto("File:Flag of Porto.svg", "image/svg+xml")).toBe(false);
    expect(looksLikePhoto("File:Porto locator map.png", "image/png")).toBe(false);
    expect(looksLikePhoto("File:Coat of arms of Porto.png", "image/png")).toBe(false);
  });
  it("turns HTML author credits into plain text", () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane&nbsp;Doe</a> &amp; co')).toBe("Jane Doe & co");
  });
  it("reads file names from Wikidata image URLs and resizes thumbnails", () => {
    expect(fileFromCommonsUrl("http://commons.wikimedia.org/wiki/Special:FilePath/Torre%20de%20Bel%C3%A9m.jpg")).toBe("File:Torre de Belém.jpg");
    expect(wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1920px-X.jpg", 960)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/960px-X.jpg");
  });
});

describe("Wikidata parsing", () => {
  it("parses WKT points (longitude first)", () => {
    expect(parsePoint("Point(-8.611 41.1496)")).toEqual({ lat: 41.1496, lng: -8.611 });
  });
  it("de-duplicates items with several types and keeps the most specific listed type", () => {
    const b = (item: string, type: string, sitelinks: string, label = "Livraria Lello") => ({
      item: { value: `http://www.wikidata.org/entity/${item}` },
      label: { value: label },
      coord: { value: "Point(-8.6148 41.1469)" },
      sitelinks: { value: sitelinks },
      type: { value: `http://www.wikidata.org/entity/${type}` },
    });
    const places = rowsToPlaces({ results: { bindings: [b("Q1", "Q570116", "40"), b("Q1", "Q33506", "40"), b("Q2", "Q16970", "60", "Clérigos Church"), b("Q3", "Q16970", "5", "Q3")] } }, ["Q33506", "Q16970", "Q570116"]);
    expect(places.map((p) => p.qid)).toEqual(["Q2", "Q1"]); // sorted by sitelinks; label-less Q3 dropped
    expect(places[1].typeQid).toBe("Q33506");
  });
  it("keeps the official website (P856) only when it's a real web address", () => {
    const row = (website?: string) => ({
      item: { value: "http://www.wikidata.org/entity/Q9" }, label: { value: "Museo" }, coord: { value: "Point(9.19 45.46)" }, sitelinks: { value: "30" },
      type: { value: "http://www.wikidata.org/entity/Q33506" }, ...(website ? { website: { value: website } } : {}),
    });
    expect(rowsToPlaces({ results: { bindings: [row(), row("https://museo.example/")] } }, ["Q33506"])[0].website).toBe("https://museo.example/");
    expect(rowsToPlaces({ results: { bindings: [row()] } }, ["Q33506"])[0].website).toBeNull();
    expect(cleanWebsite("http://museo.example/biglietti")).toBe("https://museo.example/biglietti");
    expect(cleanWebsite("javascript:alert(1)")).toBeNull();
    expect(cleanWebsite("ftp://x.example/")).toBeNull();
    expect(cleanWebsite("not a url")).toBeNull();
    expect(cleanWebsite("https://x.example/" + "a".repeat(400))).toBeNull();
  });
  it("marks museums, theatres and similar as needing tickets", () => {
    expect(TICKETED_TYPES.has("Q33506")).toBe(true); // museum
    expect(TICKETED_TYPES.has("Q24354")).toBe(true); // theatre building
    expect(TICKETED_TYPES.has("Q16970")).toBe(false); // church
  });
});

describe("network clients (fixtures)", () => {
  it("fetches an article with its translations", async () => {
    setFetcher(async (url) => {
      const u = new URL(url);
      if (u.host === "en.wikipedia.org")
        return json({ query: { pages: [{ title: "Porto", extract: "Porto is a city in Portugal.", fullurl: "https://en.wikipedia.org/wiki/Porto", pageimage: "Ribeira_Porto.jpg", coordinates: [{ lat: 41.15, lon: -8.61 }], pageprops: { wikibase_item: "Q36433" }, langlinks: [{ lang: "it", title: "Porto (Portogallo)" }, { lang: "de", title: "Porto" }] }] } });
      if (u.host === "it.wikipedia.org") return json({ query: { pages: [{ title: "Porto (Portogallo)", extract: "Porto è una città del Portogallo.", fullurl: "https://it.wikipedia.org/wiki/Porto_(Portogallo)" }] } });
      return json({ query: { pages: [{ title: "x", missing: true }] } });
    });
    const a = await fetchArticle("Porto");
    expect(a?.wikidataId).toBe("Q36433");
    expect(a?.imageFile).toBe("File:Ribeira_Porto.jpg");
    expect(a?.extracts.it?.extract).toBe("Porto è una città del Portogallo.");
    expect(a?.extracts.fr).toBeUndefined(); // no French link → English is used for French
  });

  it("returns null for a missing article and refuses disambiguation pages", async () => {
    setFetcher(async () => json({ query: { pages: [{ title: "Nowhere", missing: true }] } }));
    expect(await fetchArticle("Nowhere")).toBeNull();
    setFetcher(async () => json({ query: { pages: [{ title: "Santiago", extract: "Santiago may refer to:", pageprops: { disambiguation: "" } }] } }));
    let message = "";
    try {
      await fetchArticle("Santiago");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/disambiguation/);
  });

  it("keeps only freely licensed photos and maps normalised titles back", async () => {
    setFetcher(async () =>
      json({
        query: {
          normalized: [{ from: "File:Ribeira_Porto.jpg", to: "File:Ribeira Porto.jpg" }],
          pages: [
            { title: "File:Ribeira Porto.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/o.jpg", width: 4000, height: 2600, thumburl: "https://upload.wikimedia.org/thumb/1920px-o.jpg", thumbwidth: 1920, thumbheight: 1248, descriptionurl: "https://commons.wikimedia.org/wiki/File:Ribeira_Porto.jpg", mime: "image/jpeg", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" }, Artist: { value: "<a href='x'>Jane Doe</a>" } } }] },
            { title: "File:Logo.jpg", imageinfo: [{ url: "u", width: 100, height: 100, descriptionurl: "d", mime: "image/jpeg", extmetadata: { LicenseShortName: { value: "Fair use" } } }] },
          ],
        },
      }),
    );
    const m = await fetchLicensedImages(["File:Ribeira_Porto.jpg", "File:Logo.jpg"]);
    const img = m.get("File:Ribeira_Porto.jpg");
    expect(img?.author).toBe("Jane Doe");
    expect(img?.license).toBe("CC BY-SA 4.0");
    expect(img?.heroEligible).toBe(true);
    expect(m.has("File:Logo.jpg")).toBe(false);
  });

  it("retries after a 429 rate limit", async () => {
    let calls = 0;
    setFetcher(async () => (++calls === 1 ? new Response("", { status: 429, headers: { "retry-after": "0" } }) : json({ query: { pages: [{ title: "Rome", extract: "Rome is the capital of Italy." }] } })));
    const a = await fetchArticle("Rome", ["en"]);
    expect(a?.title).toBe("Rome");
    expect(calls).toBe(2);
  });
});

import { cityNameFromTitle } from "@/lib/enrich/wikipedia";
describe("localized city names from Wikipedia titles", () => {
  it("keeps the local name and drops disambiguation", () => {
    expect(cityNameFromTitle("Lisbonne", "Lisbon")).toBe("Lisbonne");
    expect(cityNameFromTitle("Lagos (Portugal)", "Lagos")).toBe("Lagos");
    expect(cityNameFromTitle("里斯本", "Lisbon")).toBe("里斯本");
    expect(cityNameFromTitle("لشبونة", "Lisbon")).toBe("لشبونة");
    expect(cityNameFromTitle("Bath (Somerset)", "Bath")).toBe("Bath");
    expect(cityNameFromTitle("Valence, Drôme", "Valence")).toBe("Valence");
  });
});
