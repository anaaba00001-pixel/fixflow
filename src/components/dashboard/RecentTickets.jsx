import EmptyState from "../common/EmptyState";
import { navigate } from "../../routes/AppRouter";
import { getPriorityLabel } from "../../utils/ticketPriority";
import { getStatusLabel } from "../../utils/ticketStatus";

const STATUS_COLORS = {
  NEW: "blue",
  ASSIGNED: "violet",
  ACCEPTED: "teal",
  IN_PROGRESS: "amber",
  WAITING_PARTS: "slate",
  PENDING_APPROVAL: "violet",
  CLOSED: "green",
  REOPENED: "amber",
  CANCELLED: "slate",
};

function getTicketNumber(ticket) {
  return ticket.ticket_number || ticket.ticketNumber || ticket.id || "—";
}

function getTicketTitle(ticket) {
  return ticket.title || ticket.description || "طلب صيانة";
}

function getLocationName(ticket) {
  return (
    ticket.location_name ||
    ticket.location?.name ||
    ticket.location ||
    "موقع غير محدد"
  );
}

function getUpdatedText(ticket) {
  if (ticket.updatedText) {
    return ticket.updatedText;
  }

  if (!ticket.updated_at && !ticket.updatedAt) {
    return "منذ وقت قصير";
  }

  const date = new Date(ticket.updated_at || ticket.updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "منذ وقت قصير";
  }

  return date.toLocaleString("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function RecentTickets({
  tickets = [],
  title = "أحدث طلبات الصيانة",
  description = "آخر التحديثات عبر جميع المواقع",
  limit = 5,
  loading = false,
  onSelect,
  onViewAll,
}) {
  const displayedTickets = tickets.slice(0, limit);

  function handleSelect(ticket) {
    if (typeof onSelect === "function") {
      onSelect(ticket);
      return;
    }

    navigate("/tickets");
  }

  function handleViewAll() {
    if (typeof onViewAll === "function") {
      onViewAll();
      return;
    }

    navigate("/tickets");
  }

  return (
    <article className="panel tickets-panel">
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
          جاري تحميل الطلبات…
        </div>
      ) : null}

      {!loading && displayedTickets.length === 0 ? (
        <EmptyState
          icon="▤"
          title="لا توجد طلبات حديثة"
          description="ستظهر أحدث طلبات الصيانة هنا عند إنشائها."
          actionLabel="عرض جميع الطلبات"
          onAction={handleViewAll}
        />
      ) : null}

      {!loading && displayedTickets.length > 0 ? (
        <div className="ticket-list">
          {displayedTickets.map((ticket) => {
            const priority =
              ticket.priority && ticket.priority in STATUS_COLORS
                ? getPriorityLabel(ticket.priority)
                : getPriorityLabel(ticket.priority);

            const statusLabel = getStatusLabel(ticket.status);
            const statusColor = STATUS_COLORS[ticket.status] || "blue";

            return (
              <button
                type="button"
                className="ticket-row compact-row"
                key={getTicketNumber(ticket)}
                onClick={() => handleSelect(ticket)}
              >
                <span
                  className={`priority-dot priority-${priority}`}
                  aria-label={`الأولوية: ${priority}`}
                />

                <div className="ticket-main">
                  <strong>{getTicketTitle(ticket)}</strong>
                  <small>{getTicketNumber(ticket)}</small>
                </div>

                <div className="ticket-location">
                  <strong>{getLocationName(ticket)}</strong>
                  <small>{getUpdatedText(ticket)}</small>
                </div>

                <span className={`badge ${statusColor}`}>
                  {statusLabel}
                </span>

                <span className="chevron" aria-hidden="true">
                  ‹
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
