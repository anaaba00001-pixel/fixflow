import {
  PRIORITY,
  PRIORITY_LABELS,
} from "../../constants/priorities";

const PRIORITY_CONFIG = {
  [PRIORITY.LOW]: {
    className: "blue",
    icon: "●",
  },
  [PRIORITY.MEDIUM]: {
    className: "amber",
    icon: "●",
  },
  [PRIORITY.HIGH]: {
    className: "violet",
    icon: "●",
  },
  [PRIORITY.EMERGENCY]: {
    className: "danger",
    icon: "!",
  },
};

export default function TicketPriorityBadge({
  priority,
  showIcon = true,
  className = "",
}) {
  const config =
    PRIORITY_CONFIG[priority] ||
    PRIORITY_CONFIG[PRIORITY.MEDIUM];

  const label =
    PRIORITY_LABELS[priority] ||
    priority ||
    "غير محددة";

  return (
    <span
      className={`badge ${config.className} ${className}`.trim()}
      title={`الأولوية: ${label}`}
      style={
        config.className === "danger"
          ? {
              color: "#a84132",
              background: "#fae8e4",
            }
          : undefined
      }
    >
      {showIcon ? (
        <span
          aria-hidden="true"
          style={{
            marginLeft: "4px",
            fontSize: "7px",
          }}
        >
          {config.icon}
        </span>
      ) : null}

      {label}
    </span>
  );
}
