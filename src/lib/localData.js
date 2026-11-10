const KEYS = Object.freeze({
  locations: "fixflow_locations",
  assets: "fixflow_assets",
  users: "fixflow_users",
  tickets: [
    "fixflow_tickets",
    "fixflow_my_tickets",
    "fixflow_reporter_tickets",
    "fixflow_public_tickets",
  ],
  workspace: "fixflow_workspace",
  cleanup: "fixflow_empty_workspace_v1",
});

const LEGACY_IDS = new Set([
  "demo-location-riyadh", "demo-location-north", "demo-location-hail", "demo-location-company-2",
  "demo-asset", "demo-asset-ac", "demo-asset-light", "demo-asset-sink", "demo-asset-elevator",
  "demo-platform-admin", "demo-organization-admin", "demo-branch-manager", "demo-supervisor",
  "demo-technician", "demo-inventory-manager", "reporter-demo",
  "demo-ticket", "demo-ticket-1", "demo-ticket-2", "demo-ticket-3", "demo-ticket-4", "demo-ticket-5",
  "ticket-demo-details",
]);

function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readLocalList(key) {
  try {
    const value = JSON.parse(storage()?.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeLocalList(key, value) {
  storage()?.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
}

export const readLocalLocations = () => readLocalList(KEYS.locations);
export const readLocalAssets = () => readLocalList(KEYS.assets);
export const readLocalUsers = () => readLocalList(KEYS.users);
export const saveLocalLocations = (value) => writeLocalList(KEYS.locations, value);
export const saveLocalAssets = (value) => writeLocalList(KEYS.assets, value);
export const saveLocalUsers = (value) => writeLocalList(KEYS.users, value);

export function readLocalTickets(filters = {}) {
  const unique = new Map();
  for (const key of KEYS.tickets) {
    for (const ticket of readLocalList(key)) {
      const id = ticket?.id || ticket?.ticket_id || ticket?.tracking_token;
      if (id && !unique.has(String(id))) unique.set(String(id), ticket);
    }
  }
  let tickets = [...unique.values()];
  const matches = (actual, expected) => !expected || String(actual || "") === String(expected);
  tickets = tickets.filter((ticket) =>
    matches(ticket.organization_id ?? ticket.organizationId, filters.organizationId) &&
    matches(ticket.location_id ?? ticket.locationId, filters.locationId) &&
    matches(ticket.assigned_technician_id ?? ticket.technicianId, filters.technicianId) &&
    matches(ticket.status, filters.status) &&
    matches(ticket.priority, filters.priority)
  );
  if (filters.dateFrom) tickets = tickets.filter((ticket) => new Date(ticket.created_at) >= new Date(filters.dateFrom));
  if (filters.dateTo) tickets = tickets.filter((ticket) => new Date(ticket.created_at) <= new Date(filters.dateTo));
  return tickets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

export function readWorkspace() {
  try {
    const value = JSON.parse(storage()?.getItem(KEYS.workspace) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function saveWorkspace(value) {
  const workspace = { ...readWorkspace(), ...value, updated_at: new Date().toISOString() };
  storage()?.setItem(KEYS.workspace, JSON.stringify(workspace));
  return workspace;
}

export function cleanupLegacyDemoData() {
  const target = storage();
  if (!target || target.getItem(KEYS.cleanup) === "1") return false;
  const keys = [KEYS.locations, KEYS.assets, KEYS.users, ...KEYS.tickets];
  for (const key of keys) {
    const cleaned = readLocalList(key).filter((record) => !LEGACY_IDS.has(String(record?.id || "")));
    writeLocalList(key, cleaned);
  }
  target.setItem(KEYS.cleanup, "1");
  return true;
}

function averageMinutes(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

export function createLocalDashboard(filters = {}) {
  const tickets = readLocalTickets(filters);
  const statusCount = (status) => tickets.filter((ticket) => ticket.status === status).length;
  const open = tickets.filter((ticket) => !["CLOSED", "CANCELLED"].includes(ticket.status));
  const overdue = open.filter((ticket) => ticket.is_overdue || (ticket.due_at && new Date(ticket.due_at) < new Date()));
  const closed = statusCount("CLOSED");
  const stats = {
    totalTickets: tickets.length,
    openTickets: open.length,
    newTickets: statusCount("NEW"),
    assignedTickets: statusCount("ASSIGNED"),
    inProgressTickets: statusCount("IN_PROGRESS") + statusCount("ACCEPTED") + statusCount("WAITING_PARTS") + statusCount("REOPENED"),
    pendingApprovalTickets: statusCount("PENDING_APPROVAL"),
    closedTickets: closed,
    cancelledTickets: statusCount("CANCELLED"),
    overdueTickets: overdue.length,
    emergencyTickets: tickets.filter((ticket) => ticket.priority === "EMERGENCY").length,
    unassignedTickets: open.filter((ticket) => !ticket.assigned_technician_id).length,
    completionRate: tickets.length ? Math.round((closed / tickets.length) * 100) : 0,
    overdueRate: open.length ? Math.round((overdue.length / open.length) * 100) : 0,
    averageResponseMinutes: averageMinutes(tickets.map((ticket) => ticket.accepted_at && ticket.created_at ? (new Date(ticket.accepted_at) - new Date(ticket.created_at)) / 60000 : NaN)),
    averageRepairMinutes: averageMinutes(tickets.map((ticket) => (ticket.closed_at || ticket.completed_at) && (ticket.started_at || ticket.created_at) ? (new Date(ticket.closed_at || ticket.completed_at) - new Date(ticket.started_at || ticket.created_at)) / 60000 : NaN)),
  };
  const statuses = ["NEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "WAITING_PARTS", "PENDING_APPROVAL", "CLOSED", "REOPENED", "CANCELLED"];
  const priorities = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
  return {
    stats,
    recentTickets: tickets.slice(0, 6),
    overdueTickets: overdue.slice(0, 6),
    emergencyTickets: tickets.filter((ticket) => ticket.priority === "EMERGENCY").slice(0, 6),
    ticketsByStatus: statuses.map((key) => ({ key, label: key, value: statusCount(key) })),
    ticketsByPriority: priorities.map((key) => ({ key, label: key, value: tickets.filter((ticket) => ticket.priority === key).length })),
    technicianWorkload: [],
    locationWorkload: [],
  };
}

export function createLocalReport(filters = {}) {
  const dashboard = createLocalDashboard(filters);
  const tickets = readLocalTickets(filters);
  const ratings = tickets.map((ticket) => Number(ticket.reporter_rating ?? ticket.rating)).filter((value) => value >= 1 && value <= 5);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTickets: dashboard.stats.totalTickets,
      closedTickets: dashboard.stats.closedTickets,
      openTickets: dashboard.stats.openTickets,
      overdueTickets: dashboard.stats.overdueTickets,
      reopenedTickets: tickets.filter((ticket) => ticket.status === "REOPENED" || Number(ticket.reopen_count) > 0).length,
      averageResponseMinutes: dashboard.stats.averageResponseMinutes,
      averageRepairMinutes: dashboard.stats.averageRepairMinutes,
      averageRating: ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)) : 0,
    },
    ticketsByStatus: dashboard.ticketsByStatus,
    ticketsByPriority: dashboard.ticketsByPriority,
    locations: [],
    technicians: [],
    assets: [],
    satisfaction: {
      averageRating: ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)) : 0,
      ratingsCount: ratings.length,
      lowRatingsCount: ratings.filter((value) => value <= 2).length,
      ratingDistribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: ratings.filter((value) => value === rating).length })),
    },
    tickets,
  };
}

export const LOCAL_DATA_KEYS = KEYS;
