import { describe, it, expect } from "vitest";
import { accommodationLinks, flightLinks, restaurantSearchUrl, luggageLinks } from "@/lib/links";

describe("outbound links", () => {
  it("prefills accommodation searches with the city and dates over https", () => {
    const links = accommodationLinks("Lisbon", "2027-05-10", "2027-05-12", 2);
    expect(links.length).toBeGreaterThan(2);
    for (const l of links) expect(l.url.startsWith("https://")).toBe(true);
    const booking = links.find((l) => l.provider.toLowerCase().includes("booking"))!;
    expect(booking.url).toContain("Lisbon");
    expect(booking.url).toContain("2027-05-10");
  });

  it("builds flight searches", () => {
    for (const l of flightLinks("Tokyo", "Paris", "2027-05-10", "2027-05-20")) expect(l.url.startsWith("https://")).toBe(true);
  });

  it("builds luggage storage links", () => {
    expect(luggageLinks("Rome").length).toBeGreaterThan(0);
  });

  it("searches for food matching preferences near a point", () => {
    const url = restaurantSearchUrl({ mealType: "dinner", foodPrefs: ["halal"], near: { lat: 41.9, lng: 12.5 }, area: "Trastevere", city: "Rome" });
    expect(url).toContain("google.com/maps/search");
    expect(decodeURIComponent(url).toLowerCase()).toContain("halal");
    expect(url).toContain("@41.90000,12.50000");
  });
});
