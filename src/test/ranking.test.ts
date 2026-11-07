import { describe, expect, it } from "vitest";
import { LISTINGS } from "@/lib/market-data";
import { getVet, useVet } from "@/lib/vetting";
import { parseQuery, rankListings } from "@/lib/ranking";

void useVet;
const vet = Object.fromEntries(["adidas", "newera", "mike", "fixit", "pixel", "cheapdeals"].map((k) => [k, getVet(k)!]));

describe("search ranking", () => {
  it("verified, well-documented merchants outrank unverified ones for the same item", () => {
    const ids = rankListings("black cap", LISTINGS, vet).map((r) => r.listing.agentId);
    expect(ids.indexOf("adidas")).toBeLessThan(ids.indexOf("cheapdeals"));
  });
  it("excludes non-matching items", () => {
    expect(rankListings("black cap", LISTINGS, vet).some((r) => r.listing.id === "l5")).toBe(false);
  });
  it("honours a price ceiling like 'under €20'", () => {
    expect(parseQuery("cap under €20").maxPrice).toBe(20);
    expect(rankListings("cap under €20", LISTINGS, vet).every((r) => Number(r.listing.price.replace(/\D/g, "")) <= 20)).toBe(true);
  });
  it("hides banned merchants", () => {
    const v = { ...vet, cheapdeals: { ...vet["cheapdeals"]!, level: "banned" as const } };
    expect(rankListings("cap", LISTINGS, v).some((r) => r.listing.agentId === "cheapdeals")).toBe(false);
  });
});
