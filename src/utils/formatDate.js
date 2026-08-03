export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.withTime === false ? undefined : "short",
    timeZone: options.timeZone ?? "Asia/Riyadh",
  }).format(date);
}
