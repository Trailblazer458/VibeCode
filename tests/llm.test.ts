import { describe, expect, it } from "vitest";
import { extractRules, missingRequired } from "../lib/llm";

describe("Plan with me budget slot (rules fallback)", () => {
  it("never asks for a budget", () => {
    expect(missingRequired({ days: 3, party: "solo" })).toEqual([]);
    expect(missingRequired({})).not.toContain("budget");
  });

  it("sets a budget only when an amount is named", () => {
    expect(extractRules("Burnt out, need 3 quiet days alone", {}).budgetPP ?? null).toBeNull();
    expect(extractRules("anniversary trip, 30k each", {}).budgetPP).toBe(30000);
  });

  it("clears an earlier budget when the user says it's flexible", () => {
    for (const msg of ["my budget is flexible", "budget's open", "no budget, just the best", "money is not an issue", "flexible budget"]) {
      expect(extractRules(msg, { budgetPP: 15000 }).budgetPP, msg).toBeNull();
    }
  });
});

describe("day counts in chat rules", () => {
  it("does not read '31 days' as 1 day", () => {
    expect(extractRules("Anniversary with Meera in 31 days", {}).days ?? null).toBeNull();
    expect(extractRules("3 days in the hills", {}).days).toBe(3);
  });
});
