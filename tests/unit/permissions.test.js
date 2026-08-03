import { describe, expect, it } from "vitest";
import { canAccessOrganization, canAccessTicket, hasPermission } from "../../src/utils/permissions";

const admin = { id: "u1", organization_id: "org-a", role: "ORGANIZATION_ADMIN", is_active: true };
const technician = { id: "u2", organization_id: "org-a", role: "TECHNICIAN", is_active: true };
const ticket = { organization_id: "org-a", assigned_technician_id: "u2" };

describe("permissions", () => {
  it("grants management only to organization admins", () => {
    expect(hasPermission(admin.role, "users:manage")).toBe(true);
    expect(hasPermission(technician.role, "users:manage")).toBe(false);
  });
  it("isolates organizations", () => {
    expect(canAccessOrganization(admin, "org-a")).toBe(true);
    expect(canAccessOrganization(admin, "org-b")).toBe(false);
  });
  it("limits technicians to assigned tickets", () => {
    expect(canAccessTicket(technician, ticket)).toBe(true);
    expect(canAccessTicket({ ...technician, id: "u3" }, ticket)).toBe(false);
    expect(canAccessTicket({ ...admin, is_active: false }, ticket)).toBe(false);
  });
});
