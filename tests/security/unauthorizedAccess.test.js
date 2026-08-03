import { describe, expect, it } from "vitest";
import { canAccessOrganization } from "../../src/utils/permissions";
describe("unauthorized access", () => {
  it("denies missing and disabled profiles", () => {
    expect(canAccessOrganization(null, "org-a")).toBe(false);
    expect(canAccessOrganization({ organization_id: "org-a", is_active: false }, "org-a")).toBe(false);
  });
});
