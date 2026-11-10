import { beforeEach, describe, expect, it } from "vitest";
import {
  cleanupLegacyDemoData,
  createLocalDashboard,
  readLocalLocations,
  readLocalTickets,
  saveLocalLocations,
} from "../../src/lib/localData";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

beforeEach(() => {
  globalThis.window = { localStorage: createStorage() };
});

describe("empty local workspace", () => {
  it("starts with empty operational lists and zero dashboard values", () => {
    expect(readLocalLocations()).toEqual([]);
    expect(readLocalTickets()).toEqual([]);
    expect(createLocalDashboard().stats.totalTickets).toBe(0);
    expect(createLocalDashboard().stats.completionRate).toBe(0);
  });

  it("keeps manually added records while removing known legacy demo ids", () => {
    saveLocalLocations([
      { id: "demo-location-riyadh", name: "قديم" },
      { id: "manual-location", name: "فرعي" },
    ]);
    cleanupLegacyDemoData();
    expect(readLocalLocations()).toEqual([{ id: "manual-location", name: "فرعي" }]);
  });

  it("deduplicates the same ticket across local page stores", () => {
    const ticket = { id: "ticket-1", status: "NEW", created_at: "2026-01-01" };
    window.localStorage.setItem("fixflow_tickets", JSON.stringify([ticket]));
    window.localStorage.setItem("fixflow_public_tickets", JSON.stringify([ticket]));
    expect(readLocalTickets()).toHaveLength(1);
    expect(createLocalDashboard().stats.totalTickets).toBe(1);
  });
});
