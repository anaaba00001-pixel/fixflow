import { formatDate } from "../../utils/formatDate";
import TicketPriorityBadge from "./TicketPriorityBadge";
import TicketStatusBadge from "./TicketStatusBadge";

function getTicketNumber(ticket) {
  return (
    ticket.ticket_number ||
    ticket.ticketNumber ||
    ticket.code ||
    ticket.id ||
    "—"
  );
}

function getTicketTitle(ticket) {
  return ticket.title || ticket.subject || "طلب صيانة";
}

function getAssetName(ticket) {
  return (
    ticket.asset_name ||
    ticket.asset?.name ||
    ticket.assets?.name ||
    ticket.asset ||
    "دون جهاز محدد"
  );
}

function getLocationName(ticket) {
  return (
    ticket.location_name ||
    ticket.location?.name ||
    ticket.locations?.name ||
    ticket.location ||
    "موقع غير محدد"
  );
}

function getTechnician(ticket) {
  const technician =
    ticket.assigned_technician ||
    ticket.technician ||
    ticket.profiles ||
    null;

  const name =
    ticket.technician_name ||
    ticket.technicianName ||
    technician?.full_name ||
    technician?.fullName ||
    technician?.name ||
    "";

  return {
    name: name || "غير معيّن",
    assigned: Boolean(name),
  };
}

function getInitials(name) {
  if (!name || name === "غير معيّن") {
    return "؟";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
}

function getDueDate(ticket) {
  const value =
    ticket.due_at ||
    ticket.dueAt ||
    ticket.expected_completion_at ||
    null;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(ticket) {
  if (["CLOSED", "CANCELLED"].includes(ticket.status)) {
    return false;
  }

  if (
    ticket.is_overdue === true ||
    ticket.isOverdue === true
  ) {
    return true;
  }

  const dueDate = getDueDate(ticket);

  return dueDate
    ? dueDate.getTime() < Date.now()
    : false;
}

export default function TicketCard({
  ticket,
  disabled = false,
  compact = false,
  onOpen,
  onAssign,
}) {
  if (!ticket) {
    return null;
  }

  const technician = getTechnician(ticket);
  const overdue = isOverdue(ticket);
  const dueDate = getDueDate(ticket);

  function handleOpen() {
    if (!disabled) {
      onOpen?.(ticket);
    }
  }

  function handleAssign(event) {
    event.stopPropagation();

    if (!disabled) {
      onAssign?.(ticket);
    }
  }

  return (
    <article
      className="panel"
      style={{
        display: "grid",
        gap: compact ? "12px" : "16px",
        padding: compact ? "15px" : "18px",
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          margin: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "42px",
            height: "42px",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            background: overdue ? "#fae6e3" : "#e3f1ed",
            color: overdue ? "#bd4c47" : "#176c62",
            fontSize: "18px",
          }}
        >
          {overdue ? "!" : "⚒"}
        </span>

        <div
          style={{
            display: "grid",
            gap: "5px",
            minWidth: 0,
          }}
        >
          {typeof onOpen === "function" ? (
            <button
              type="button"
              onClick={handleOpen}
              disabled={disabled}
              style={{
                padding: 0,
                border: 0,
                background: "transparent",
                color: "#173231",
                font: "inherit",
                fontWeight: 700,
                textAlign: "right",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {getTicketTitle(ticket)}
            </button>
          ) : (
            <strong>{getTicketTitle(ticket)}</strong>
          )}

          <small
            style={{
              color: "#82908e",
              direction: "ltr",
              textAlign: "right",
            }}
          >
            {getTicketNumber(ticket)}
          </small>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: "6px",
            marginRight: "auto",
          }}
        >
          <TicketPriorityBadge
            priority={ticket.priority}
          />

          <TicketStatusBadge status={ticket.status} />
        </div>
      </header>

      {!compact && ticket.description ? (
        <p
          style={{
            margin: 0,
            overflow: "hidden",
            color: "#60716e",
            fontSize: "10px",
            lineHeight: 1.8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {ticket.description}
        </p>
      ) : null}

      <dl
        style={{
          display: "grid",
          gap: "10px",
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <dt
            style={{
              color: "#82908e",
              fontSize: "9px",
            }}
          >
            الجهاز
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {getAssetName(ticket)}
          </dd>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <dt
            style={{
              color: "#82908e",
              fontSize: "9px",
            }}
          >
            الموقع
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {getLocationName(ticket)}
          </dd>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <dt
            style={{
              color: "#82908e",
              fontSize: "9px",
            }}
          >
            تاريخ الإنشاء
          </dt>

          <dd
            style={{
              margin: 0,
              color: "#60716e",
              fontSize: "9px",
            }}
          >
            {formatDate(
              ticket.created_at || ticket.createdAt,
              { withTime: true }
            )}
          </dd>
        </div>

        {dueDate ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <dt
              style={{
                color: "#82908e",
                fontSize: "9px",
              }}
            >
              موعد الاستحقاق
            </dt>

            <dd
              className={overdue ? "danger-text" : ""}
              style={{
                margin: 0,
                fontSize: "9px",
                fontWeight: overdue ? 700 : 500,
              }}
            >
              {formatDate(dueDate, { withTime: true })}
            </dd>
          </div>
        ) : null}
      </dl>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          paddingTop: "13px",
          borderTop: "1px solid #edf0ef",
        }}
      >
        <span
          className="mini-avatar"
          aria-hidden="true"
        >
          {getInitials(technician.name)}
        </span>

        <div
          style={{
            display: "grid",
            gap: "3px",
          }}
        >
          <small
            style={{
              color: "#82908e",
              fontSize: "8px",
            }}
          >
            الفني المسؤول
          </small>

          <strong
            style={{
              color: technician.assigned
                ? "#314b47"
                : "#9a6d27",
              fontSize: "9px",
            }}
          >
            {technician.name}
          </strong>
        </div>

        {!technician.assigned &&
        typeof onAssign === "function" ? (
          <button
            type="button"
            className="secondary"
            onClick={handleAssign}
            disabled={disabled}
            style={{
              marginRight: "auto",
              padding: "8px 11px",
              fontSize: "9px",
            }}
          >
            تعيين فني
          </button>
        ) : null}

        {technician.assigned &&
        typeof onOpen === "function" ? (
          <button
            type="button"
            className="link-button"
            onClick={handleOpen}
            disabled={disabled}
          >
            عرض التفاصيل ←
          </button>
        ) : null}
      </footer>
    </article>
  );
}
