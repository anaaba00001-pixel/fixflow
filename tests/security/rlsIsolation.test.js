import { describe, expect, it } from "vitest";
import { canAccessTicket } from "../../src/utils/permissions";
describe("tenant isolation model", () => {
  it("denies a user from another organization", () => {
    const user = { id: "u1", organization_id: "org-a", role: "SUPERVISOR", is_active: true };
    expect(canAccessTicket(user, { organization_id: "org-b" })).toBe(false);
  });
});
