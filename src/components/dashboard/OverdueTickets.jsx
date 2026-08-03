

import EmptyState from "../common/EmptyState";
import { navigate } from "../../routes/AppRouter";
import { getPriorityLabel } from "../../utils/ticketPriority";
import { getStatusLabel } from "../../utils/ticketStatus";

const CLOSED_STATUSES = new Set(["CLOSED", "CANCELLED"]);

function getTicketNumber(ticket) {
  return ticket.ticket_number || ticket.ticketNumber || ticket.id || "—";
}

function getTicketTitle(ticket) {
  return ticket.title || ticket.description || "طلب صيانة";
}

function getLocationName(ticket) {
  return (
    ticket.location_name ||
    ticket.locations?.name ||
    ticket.location?.name ||
    ticket.location ||
    "موقع غير محدد"
  );
}

function getDueDate(ticket) {
  const value = ticket.due_at || ticket.dueAt;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isTicketOverdue(ticket, currentTime) {
  if (CLOSED_STATUSES.has(ticket.status)) {
    return false;
  }

  if (ticket.is_overdue === true || ticket.isOverdue === true) {
    return true;
  }

  const dueDate = getDueDate(ticket);

  return dueDate ? dueDate.getTime() < currentTime : false;
}

function getOverdueMilliseconds(ticket, currentTime) {
  const dueDate = getDueDate(ticket);

  if (!dueDate) {
    return 0;
  }

  return Math.max(0, currentTime - dueDate.getTime());
}

function formatOverdueDuration(milliseconds) {
  if (!milliseconds) {
    return "متأخر";
  }

  const totalMinutes = Math.floor(milliseconds / 60000);

  if (totalMinutes < 60) {
    return `متأخر ${Math.max(1, totalMinutes)} دقيقة`;
  }

  const totalHours = Math.floor(totalMinutes / 60);

  if (totalHours < 24) {
    return `متأخر ${totalHours} ساعة`;
  }

  const totalDays = Math.floor(totalHours / 24);

  return `متأخر ${totalDays} ${totalDays === 1 ? "يوم" : "أيام"}`;
}

export default function OverdueTickets({
  tickets = [],
  title = "الطلبات المتأخرة",
  description = "طلبات تجاوزت موعد الاستحقاق",
  limit = 5,
  loading = false,
  onSelect,
  onViewAll,
}) {
  const currentTime = Date.now();

  const overdueTickets = tickets
    .filter((ticket) => isTicketOverdue(ticket, currentTime))
    .sort(
      (firstTicket, secondTicket) =>
        getOverdueMilliseconds(secondTicket, currentTime) -
        getOverdueMilliseconds(firstTicket, currentTime)
    )
    .slice(0, limit);

  function handleSelect(ticket) {
    if (typeof onSelect === "function") {
      onSelect(ticket);
      return;
    }

    navigate(`/tickets/${ticket.id}`);
  }

  function handleViewAll() {
    if (typeof onViewAll === "function") {
      onViewAll();
      return;
    }

    navigate("/tickets?overdue=true");
  }

  return (
    <article className="panel activity-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <button
          type="button"
          className="link-button"
          onClick={handleViewAll}
        >
          عرض الكل ←
        </button>
      </div>

      {loading ? (
        <div className="empty" role="status" aria-live="polite">
          جاري تحميل الطلبات المتأخرة…
        </div>
      ) : null}

      {!loading && overdueTickets.length === 0 ? (
        <EmptyState
          icon="✓"
          title="لا توجد طلبات متأخرة"
          description="جميع طلبات الصيانة ما زالت ضمن الوقت المحدد."
        />
      ) : null}

      {!loading
        ? overdueTickets.map((ticket) => {
            const overdueDuration = formatOverdueDuration(
              getOverdueMilliseconds(ticket, currentTime)
            );

            return (
              <button
                key={getTicketNumber(ticket)}
                type="button"
                className="activity"
                onClick={() => handleSelect(ticket)}
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "right",
                  cursor: "pointer",
                  alignItems: "center",
                }}
              >
                <span
                  className="mini-avatar orange"
                  aria-hidden="true"
                >
                  !
                </span>

                <p style={{ flex: 1 }}>
                  <b>{getTicketTitle(ticket)}</b>

                  <small>
                    {getTicketNumber(ticket)} · {getLocationName(ticket)}
                  </small>

                  <small className="danger-text">
                    {overdueDuration} · {getStatusLabel(ticket.status)} ·{" "}
                    {getPriorityLabel(ticket.priority)}
                  </small>
                </p>

                <span className="chevron" aria-hidden="true">
                  ‹
                </span>
              </button>
            );
          })
        : null}
    </article>
  );
}
