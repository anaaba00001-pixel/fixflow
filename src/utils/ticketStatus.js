import { STATUS_LABELS, TICKET_STATUS } from "../constants/ticketStatuses";

export const STATUS_TRANSITIONS = Object.freeze({
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "ASSIGNED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "ASSIGNED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "PENDING_APPROVAL", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  PENDING_APPROVAL: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["REOPENED"],
  REOPENED: ["ASSIGNED", "CANCELLED"],
  CANCELLED: [],
});

export function canTransition(from, to) {
  return Boolean(TICKET_STATUS[from] && TICKET_STATUS[to] && STATUS_TRANSITIONS[from].includes(to));
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new Error(`INVALID_STATUS_TRANSITION:${from}:${to}`);
  return true;
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}
