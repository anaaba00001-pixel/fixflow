import {
  STATUS_LABELS,
  TICKET_STATUS,
} from "../../constants/ticketStatuses";

const STATUS_CONFIG = {
  [TICKET_STATUS.NEW]: {
    className: "blue",
    icon: "●",
  },
  [TICKET_STATUS.ASSIGNED]: {
    className: "violet",
    icon: "●",
  },
  [TICKET_STATUS.ACCEPTED]: {
    className: "teal",
    icon: "●",
  },
  [TICKET_STATUS.IN_PROGRESS]: {
    className: "amber",
    icon: "●",
  },
  [TICKET_STATUS.WAITING_PARTS]: {
    className: "slate",
    icon: "◷",
  },
  [TICKET_STATUS.PENDING_APPROVAL]: {
    className: "violet",
    icon: "◷",
  },
  [TICKET_STATUS.CLOSED]: {
    className: "green",
    icon: "✓",
  },
  [TICKET_STATUS.REOPENED]: {
    className: "amber",
    icon: "↻",
  },
  [TICKET_STATUS.CANCELLED]: {
    className: "slate",
    icon: "×",
  },
};

export default function TicketStatusBadge({
  status,
  showIcon = true,
  className = "",
}) {
  const config =
    STATUS_CONFIG[status] ||
    STATUS_CONFIG[TICKET_STATUS.NEW];

  const label =
    STATUS_LABELS[status] ||
    status ||
    "حالة غير محددة";

  return (
    <span
      className={`badge ${config.className} ${className}`.trim()}
      title={`حالة الطلب: ${label}`}
    >
      {showIcon ? (
        <span
          aria-hidden="true"
          style={{
            marginLeft: "4px",
            fontSize: "8px",
          }}
        >
          {config.icon}
        </span>
      ) : null}

      {label}
    </span>
  );
}
