import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "../../src/utils/ticketStatus";

describe("ticket status workflow", () => {
  it("allows the normal repair journey", () => {
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "PENDING_APPROVAL")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "CLOSED")).toBe(true);
  });
  it("supports waiting for parts and reopening", () => {
    expect(canTransition("IN_PROGRESS", "WAITING_PARTS")).toBe(true);
    expect(canTransition("WAITING_PARTS", "IN_PROGRESS")).toBe(true);
    expect(canTransition("CLOSED", "REOPENED")).toBe(true);
  });
  it("rejects skipped and unknown transitions", () => {
    expect(canTransition("NEW", "CLOSED")).toBe(false);
    expect(() => assertTransition("NEW", "CLOSED")).toThrow("INVALID_STATUS_TRANSITION");
    expect(canTransition("UNKNOWN", "NEW")).toBe(false);
  });
});
