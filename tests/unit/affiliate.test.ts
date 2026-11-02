import { describe, it, expect } from "vitest";
import { checkTemplate, fillTemplate, paramsFromQuery } from "@/lib/affiliate-template";

describe("affiliate link templates", () => {
  it("accepts https tracking links with known placeholders", () => {
    expect(checkTemplate("https://partner.example/search?aid=123&city={city}&in={checkin}")).toBeNull();
  });
  it("rejects unsafe or invalid templates", () => {
    expect(checkTemplate("http://partner.example/?aid=1")).toBe("notHttps");
    expect(checkTemplate("javascript:alert(1)")).toBe("notHttps");
    expect(checkTemplate("https://{city}.partner.example/")).toBe("placeholderInHost");
    expect(checkTemplate("https://user:pw@partner.example/")).toBe("credentials");
    expect(checkTemplate("https://partner.example/?x={secret}")).toBe("unknownPlaceholder");
  });
  it("fills values URL-encoded and never changes the host", () => {
    const url = fillTemplate("https://p.example/s?aid=1&q={city}&n={adults}", { city: "São Paulo & co/../x", adults: 2 });
    expect(url).toBe("https://p.example/s?aid=1&q=S%C3%A3o%20Paulo%20%26%20co%2F..%2Fx&n=2");
    expect(new URL(url!).host).toBe("p.example");
    expect(new URL(url!).searchParams.get("aid")).toBe("1");
  });
  it("only accepts well-formed query values", () => {
    const p = paramsFromQuery(new URLSearchParams("city=Lisbon&checkin=2027-05-10&adults=99&country=pt&lat=38.7&locale=xx&evil=1"));
    expect(p).toEqual({ city: "Lisbon", country: undefined, checkin: "2027-05-10", checkout: undefined, adults: undefined, lat: "38.7", lng: undefined, locale: undefined });
  });
});
