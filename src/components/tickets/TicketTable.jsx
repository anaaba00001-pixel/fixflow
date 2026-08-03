import { formatDate } from "../../utils/formatDate";
import EmptyState from "../common/EmptyState";
import TicketPriorityBadge from "./TicketPriorityBadge";
import TicketStatusBadge from "./TicketStatusBadge";

function getTicketId(ticket) {
  return ticket.id || ticket.ticket_number || ticket.ticketNumber;
}

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

function getLocationName(ticket) {
  return (
    ticket.location_name ||
    ticket.location?.name ||
    ticket.locations?.name ||
    ticket.location ||
    "موقع غير محدد"
  );
}

function getAssetName(ticket) {
  return (
    ticket.asset_name ||
    ticket.asset?.name ||
    ticket.assets?.name ||
    "دون جهاز محدد"
  );
}

function getTechnicianName(ticket) {
  return (
    ticket.technician_name ||
    ticket.technicianName ||
    ticket.assigned_technician?.full_name ||
    ticket.assigned_technician?.fullName ||
    ticket.technician?.full_name ||
    ticket.technician?.name ||
    ticket.profiles?.full_name ||
    ""
  );
}

function getInitials(name) {
  if (!name) {
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

function SortButton({
  label,
  field,
  sortBy,
  sortDirection,
  onSort,
}) {
  const active = sortBy === field;

  return (
    <button
      type="button"
      onClick={() => onSort?.(field)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: 0,
        border: 0,
        background: "transparent",
        color: active ? "#176c62" : "#647572",
        font: "inherit",
        fontWeight: 700,
        cursor: onSort ? "pointer" : "default",
      }}
    >
      {label}

      {active ? (
        <span aria-hidden="true">
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
}

export default function TicketTable({
  tickets = [],
  loading = false,
  selectable = false,
  selectedIds = [],
  sortBy = "",
  sortDirection = "desc",
  disabled = false,
  onSort,
  onSelectionChange,
  onOpen,
  onAssign,
}) {
  const selectedSet = new Set(
    selectedIds.map((id) => String(id))
  );

  const availableIds = tickets
    .map(getTicketId)
    .filter(Boolean)
    .map(String);

  const allSelected =
    availableIds.length > 0 &&
    availableIds.every((id) => selectedSet.has(id));

  const partiallySelected =
    !allSelected &&
    availableIds.some((id) => selectedSet.has(id));

  function handleSelectAll(event) {
    event.stopPropagation();

    if (event.target.checked) {
      onSelectionChange?.(availableIds);
      return;
    }

    onSelectionChange?.([]);
  }

  function handleSelectTicket(event, ticket) {
    event.stopPropagation();

    const ticketId = String(getTicketId(ticket));
    const nextSelection = new Set(selectedSet);

    if (event.target.checked) {
      nextSelection.add(ticketId);
    } else {
      nextSelection.delete(ticketId);
    }

    onSelectionChange?.([...nextSelection]);
  }

  function handleOpen(ticket) {
    if (!disabled) {
      onOpen?.(ticket);
    }
  }

  function handleKeyDown(event, ticket) {
    if (
      typeof onOpen !== "function" ||
      disabled ||
      !["Enter", " "].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    handleOpen(ticket);
  }

  if (loading) {
    return (
      <section
        className="panel"
        role="status"
        aria-live="polite"
        style={{
          display: "grid",
          gap: "10px",
          padding: "20px",
        }}
      >
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            style={{
              height: "55px",
              borderRadius: "8px",
              background: "#edf1f0",
            }}
          />
        ))}

        <span className="empty">
          جاري تحميل طلبات الصيانة…
        </span>
      </section>
    );
  }

  if (tickets.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          icon="▤"
          title="لا توجد طلبات صيانة"
          description="لم يتم العثور على طلبات مطابقة للفلاتر المحددة."
        />
      </section>
    );
  }

  return (
    <section
      className="panel"
      style={{
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: selectable ? "1050px" : "1000px",
            borderCollapse: "collapse",
            textAlign: "right",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f7f9f8",
                color: "#647572",
                fontSize: "9px",
              }}
            >
              {selectable ? (
                <th
                  style={{
                    width: "45px",
                    padding: "13px",
                    borderBottom: "1px solid #e4e9e7",
                    textAlign: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          partiallySelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    disabled={disabled}
                    aria-label="تحديد جميع الطلبات"
                    style={{
                      width: "15px",
                      height: "15px",
                    }}
                  />
                </th>
              ) : null}

              <th
                style={{
                  minWidth: "220px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="الطلب"
                  field="created_at"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  minWidth: "130px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                الموقع والجهاز
              </th>

              <th
                style={{
                  minWidth: "100px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="الأولوية"
                  field="priority"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  minWidth: "120px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="الحالة"
                  field="status"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  minWidth: "150px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                الفني المسؤول
              </th>

              <th
                style={{
                  minWidth: "125px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="موعد الاستحقاق"
                  field="due_at"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  width: "55px",
                  padding: "13px",
                  borderBottom: "1px solid #e4e9e7",
                }}
              >
                الإجراء
              </th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((ticket) => {
              const ticketId = getTicketId(ticket);
              const technicianName =
                getTechnicianName(ticket);
              const dueDate = getDueDate(ticket);
              const overdue = isOverdue(ticket);
              const selected = selectedSet.has(
                String(ticketId)
              );

              return (
                <tr
                  key={ticketId}
                  tabIndex={
                    typeof onOpen === "function" ? 0 : undefined
                  }
                  onClick={() => handleOpen(ticket)}
                  onKeyDown={(event) =>
                    handleKeyDown(event, ticket)
                  }
                  style={{
                    background: selected
                      ? "#f0f8f5"
                      : "#ffffff",
                    cursor:
                      typeof onOpen === "function" && !disabled
                        ? "pointer"
                        : "default",
                  }}
                >
                  {selectable ? (
                    <td
                      style={{
                        padding: "13px",
                        borderBottom:
                          "1px solid #edf0ef",
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          handleSelectTicket(event, ticket)
                        }
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        disabled={disabled}
                        aria-label={`تحديد الطلب ${getTicketNumber(
                          ticket
                        )}`}
                        style={{
                          width: "15px",
                          height: "15px",
                        }}
                      />
                    </td>
                  ) : null}

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "9px",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "7px",
                          height: "7px",
                          flexShrink: 0,
                          marginTop: "5px",
                          borderRadius: "50%",
                          background: overdue
                            ? "#d84f4f"
                            : "#4d8e85",
                        }}
                      />

                      <div
                        style={{
                          display: "grid",
                          gap: "4px",
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            overflow: "hidden",
                            color: "#263f3b",
                            fontSize: "10px",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getTicketTitle(ticket)}
                        </strong>

                        <small
                          style={{
                            color: "#899694",
                            fontSize: "8px",
                          }}
                        >
                          {getTicketNumber(ticket)} ·{" "}
                          {formatDate(
                            ticket.created_at ||
                              ticket.createdAt,
                            { withTime: true }
                          )}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: "4px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#405653",
                          fontSize: "9px",
                        }}
                      >
                        {getLocationName(ticket)}
                      </strong>

                      <small
                        style={{
                          color: "#899694",
                          fontSize: "8px",
                        }}
                      >
                        {getAssetName(ticket)}
                      </small>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    <TicketPriorityBadge
                      priority={ticket.priority}
                    />
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    <TicketStatusBadge
                      status={ticket.status}
                    />
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    {technicianName ? (
                      <div className="technician">
                        <span
                          className="mini-avatar"
                          aria-hidden="true"
                        >
                          {getInitials(technicianName)}
                        </span>

                        <div>
                          <strong>{technicianName}</strong>
                          <small>الفني المسؤول</small>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={(event) => {
                          event.stopPropagation();

                          if (!disabled) {
                            onAssign?.(ticket);
                          }
                        }}
                        disabled={
                          disabled ||
                          typeof onAssign !== "function"
                        }
                        style={{
                          padding: "7px 10px",
                          fontSize: "8px",
                        }}
                      >
                        تعيين فني
                      </button>
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: "4px",
                      }}
                    >
                      <span
                        className={
                          overdue ? "danger-text" : ""
                        }
                        style={{
                          fontSize: "9px",
                          fontWeight: overdue ? 700 : 500,
                        }}
                      >
                        {dueDate
                          ? formatDate(dueDate, {
                              withTime: true,
                            })
                          : "غير محدد"}
                      </span>

                      {overdue ? (
                        <small
                          style={{
                            color: "#bd4c47",
                            fontSize: "8px",
                          }}
                        >
                          متأخر
                        </small>
                      ) : null}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom: "1px solid #edf0ef",
                      textAlign: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="link-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpen(ticket);
                      }}
                      disabled={
                        disabled ||
                        typeof onOpen !== "function"
                      }
                      aria-label={`عرض الطلب ${getTicketNumber(
                        ticket
                      )}`}
                      style={{
                        margin: 0,
                        fontSize: "17px",
                      }}
                    >
                      ‹
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}



