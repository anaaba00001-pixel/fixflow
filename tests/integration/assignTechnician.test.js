import { describe, expect, it } from "vitest";
import { canAccessTicket, hasPermission } from "../../src/utils/permissions";
import { canTransition } from "../../src/utils/ticketStatus";

describe("technician assignment contract", () => {
  const ticket = { organization_id: "org-a", assigned_technician_id: "tech-a" };
  it("allows a supervisor to assign a new ticket", () => {
    expect(hasPermission("SUPERVISOR", "tickets:assign")).toBe(true);
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
  });
  it("gives only the assigned technician access", () => {
    const assigned = { id: "tech-a", organization_id: "org-a", role: "TECHNICIAN", is_active: true };
    const other = { ...assigned, id: "tech-b" };
    expect(canAccessTicket(assigned, ticket)).toBe(true);
    expect(canAccessTicket(other, ticket)).toBe(false);
  });
});
