import { useMemo } from "react";
import { formatDate } from "../../utils/formatDate";
import { getStatusLabel } from "../../utils/ticketStatus";
import EmptyState from "../common/EmptyState";

const ACTION_CONFIG = {
  CREATED: {
    label: "تم إنشاء الطلب",
    icon: "+",
    className: "mint",
  },
  ASSIGNED: {
    label: "تم تعيين فني",
    icon: "⚒",
    className: "purple",
  },
  ACCEPTED: {
    label: "وافق الفني على الطلب",
    icon: "✓",
    className: "mint",
  },
  STARTED: {
    label: "بدأ العمل على الطلب",
    icon: "▶",
    className: "orange",
  },
  STATUS_CHANGED: {
    label: "تم تغيير حالة الطلب",
    icon: "↻",
    className: "purple",
  },
  COMMENT_ADDED: {
    label: "تمت إضافة تعليق",
    icon: "✎",
    className: "blue",
  },
  ATTACHMENT_ADDED: {
    label: "تمت إضافة مرفق",
    icon: "▧",
    className: "blue",
  },
  COMPLETED: {
    label: "اكتمل تنفيذ الصيانة",
    icon: "✓",
    className: "mint",
  },
  APPROVED: {
    label: "تم اعتماد الإصلاح",
    icon: "✓",
    className: "green",
  },
  CLOSED: {
    label: "تم إغلاق الطلب",
    icon: "✓",
    className: "green",
  },
  REOPENED: {
    label: "أعيد فتح الطلب",
    icon: "↻",
    className: "orange",
  },
  CANCELLED: {
    label: "تم إلغاء الطلب",
    icon: "×",
    className: "slate",
  },
};

function getHistoryEntries(history, ticket) {
  if (Array.isArray(history) && history.length > 0) {
    return history;
  }

  const ticketHistory =
    ticket?.ticket_history ||
    ticket?.history ||
    ticket?.timeline ||
    ticket?.activities ||
    [];

  return Array.isArray(ticketHistory) ? ticketHistory : [];
}

function getAction(entry) {
  const directAction =
    entry.action ||
    entry.event_type ||
    entry.eventType ||
    entry.type;

  if (directAction) {
    return String(directAction).toUpperCase();
  }

  const nextStatus =
    entry.new_status ||
    entry.newStatus ||
    entry.to_status ||
    entry.toStatus;

  const statusActions = {
    NEW: "CREATED",
    ASSIGNED: "ASSIGNED",
    ACCEPTED: "ACCEPTED",
    IN_PROGRESS: "STARTED",
    WAITING_PARTS: "STATUS_CHANGED",
    PENDING_APPROVAL: "COMPLETED",
    CLOSED: "CLOSED",
    REOPENED: "REOPENED",
    CANCELLED: "CANCELLED",
  };

  return statusActions[nextStatus] || "STATUS_CHANGED";
}

function getOldStatus(entry) {
  return (
    entry.old_status ||
    entry.oldStatus ||
    entry.from_status ||
    entry.fromStatus ||
    null
  );
}

function getNewStatus(entry) {
  return (
    entry.new_status ||
    entry.newStatus ||
    entry.to_status ||
    entry.toStatus ||
    null
  );
}

function getActorName(entry) {
  return (
    entry.actor_name ||
    entry.actorName ||
    entry.changed_by_profile?.full_name ||
    entry.changedByProfile?.fullName ||
    entry.actor?.full_name ||
    entry.actor?.fullName ||
    entry.actor?.name ||
    entry.profile?.full_name ||
    entry.profiles?.full_name ||
    ""
  );
}

function getActorType(entry) {
  return String(
    entry.actor_type ||
      entry.actorType ||
      (entry.actor_id || entry.changed_by ? "USER" : "SYSTEM")
  ).toUpperCase();
}

function getActorLabel(entry) {
  const actorName = getActorName(entry);

  if (actorName) {
    return actorName;
  }

  const actorType = getActorType(entry);

  if (actorType === "REPORTER") {
    return "المبلّغ";
  }

  if (actorType === "SYSTEM") {
    return "النظام";
  }

  return "مستخدم غير معروف";
}

function getEntryDate(entry) {
  return (
    entry.created_at ||
    entry.createdAt ||
    entry.changed_at ||
    entry.changedAt ||
    entry.timestamp ||
    null
  );
}

function getEntryNote(entry) {
  return (
    entry.note ||
    entry.reason ||
    entry.comment ||
    entry.description ||
    ""
  );
}

function getActionConfig(action) {
  return (
    ACTION_CONFIG[action] || {
      label: "تم تحديث الطلب",
      icon: "•",
      className: "slate",
    }
  );
}

function createStatusDescription(entry) {
  const oldStatus = getOldStatus(entry);
  const newStatus = getNewStatus(entry);

  if (oldStatus && newStatus && oldStatus !== newStatus) {
    return `تغيّرت الحالة من ${getStatusLabel(
      oldStatus
    )} إلى ${getStatusLabel(newStatus)}.`;
  }

  if (newStatus) {
    return `أصبحت حالة الطلب: ${getStatusLabel(
      newStatus
    )}.`;
  }

  return "";
}

function getEntryDescription(entry, action) {
  const note = getEntryNote(entry);
  const statusDescription = createStatusDescription(entry);

  if (note && statusDescription) {
    return `${statusDescription} ${note}`;
  }

  if (note) {
    return note;
  }

  if (statusDescription) {
    return statusDescription;
  }

  return getActionConfig(action).label;
}

function getTimestamp(entry) {
  const value = getEntryDate(entry);

  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function TicketTimeline({
  history = [],
  ticket = null,
  loading = false,
  order = "desc",
  limit,
  emptyTitle = "لا يوجد سجل للطلب",
  emptyDescription = "ستظهر هنا تغييرات الحالة والعمليات التي تتم على الطلب.",
  onItemClick,
}) {
  const entries = useMemo(() => {
    const sortedEntries = [...getHistoryEntries(history, ticket)].sort(
      (firstEntry, secondEntry) => {
        const difference =
          getTimestamp(secondEntry) - getTimestamp(firstEntry);

        return order === "asc" ? -difference : difference;
      }
    );

    if (Number.isInteger(limit) && limit > 0) {
      return sortedEntries.slice(0, limit);
    }

    return sortedEntries;
  }, [history, ticket, order, limit]);

  if (loading) {
    return (
      <section
        role="status"
        aria-live="polite"
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="timeline"
            style={{
              minHeight: "55px",
            }}
          >
            <span aria-hidden="true" />

            <div
              style={{
                width: "100%",
                gap: "7px",
              }}
            >
              <span
                style={{
                  width: "45%",
                  height: "10px",
                  borderRadius: "5px",
                  background: "#e8edeb",
                }}
              />

              <span
                style={{
                  width: "70%",
                  height: "8px",
                  borderRadius: "5px",
                  background: "#eff2f1",
                }}
              />
            </div>
          </div>
        ))}

        <span className="empty">جاري تحميل سجل الطلب…</span>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="◷"
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <section
      aria-label="سجل طلب الصيانة"
      style={{
        display: "grid",
      }}
    >
      {entries.map((entry, index) => {
        const action = getAction(entry);
        const config = getActionConfig(action);
        const actorName = getActorLabel(entry);
        const date = getEntryDate(entry);
        const description = getEntryDescription(entry, action);
        const entryKey =
          entry.id ||
          `${action}-${date || "unknown"}-${index}`;

        const content = (
          <>
            <span
              className={`mini-avatar ${config.className}`}
              aria-hidden="true"
              style={{
                width: "27px",
                height: "27px",
                flexShrink: 0,
                marginRight: "-31px",
                border: "3px solid #ffffff",
                boxShadow: "0 0 0 1px #d9e4e1",
                fontWeight: 700,
              }}
            >
              {config.icon}
            </span>

            <div
              style={{
                width: "100%",
                gap: "4px",
              }}
            >
              <strong>{config.label}</strong>

              <small
                style={{
                  color: "#5f706d",
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                }}
              >
                {description}
              </small>

              <small>
                بواسطة {actorName}
                {date
                  ? ` · ${formatDate(date, {
                      withTime: true,
                    })}`
                  : ""}
              </small>
            </div>
          </>
        );

        if (typeof onItemClick === "function") {
          return (
            <button
              key={entryKey}
              type="button"
              className="timeline"
              onClick={() => onItemClick(entry)}
              style={{
                width: "100%",
                borderTop: 0,
                borderBottom: 0,
                borderLeft: 0,
                background: "transparent",
                color: "inherit",
                textAlign: "right",
                cursor: "pointer",
              }}
            >
              {content}
            </button>
          );
        }

        return (
          <article key={entryKey} className="timeline">
            {content}
          </article>
        );
      })}
    </section>
  );
}


