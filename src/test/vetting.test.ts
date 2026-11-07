import { describe, expect, it } from "vitest";
import { addStrike, detectBluff, getVet } from "@/lib/vetting";

describe("vetting engine", () => {
  it("bans an agent on its 3rd strike", () => {
    expect(getVet("cheapdeals")!.strikes).toBe(2);
    expect(addStrike("cheapdeals", "test")).toBe(true);
    expect(getVet("cheapdeals")!.banned).toBe(true);
  });
  it("does not ban below 3 strikes", () => {
    expect(addStrike("newera", "test")).toBe(false);
  });
  it("flags a price higher than the listing", () => {
    expect(detectBluff("Price is €45 now", "€12")).not.toBeNull();
    expect(detectBluff("Listed at €12, in stock", "€12")).toBeNull();
  });
});
