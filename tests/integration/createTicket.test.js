import { describe, expect, it } from "vitest";
import { validateTicketInput } from "../../src/utils/validation";

describe("create ticket contract", () => {
  it("accepts a complete public request", () => {
    const result = validateTicketInput({
      assetId: "30000000-0000-0000-0000-000000000001",
      description: "المكيف لا يبرد منذ بداية صباح اليوم.",
      priority: "HIGH",
    });
    expect(result).toEqual({ valid: true, errors: {} });
  });
  it("rejects incomplete and tampered requests", () => {
    const result = validateTicketInput({ assetId: "", description: "قصير", priority: "ROOT" });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(["assetId", "description", "priority"]);
  });
});
