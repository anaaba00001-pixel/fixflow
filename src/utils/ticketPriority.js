import { PRIORITY, PRIORITY_LABELS } from "../constants/priorities";

export const PRIORITY_WEIGHT = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 });
export function getPriorityLabel(priority) { return PRIORITY_LABELS[priority] ?? priority; }
export function isPriority(value) { return Object.values(PRIORITY).includes(value); }
export function sortByPriority(a, b) { return (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0); }
