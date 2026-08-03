

import { ROLE } from "../../constants/roles";
import { formatDate } from "../../utils/formatDate";
import EmptyState from "../common/EmptyState";

const ROLE_CONFIG = {
  [ROLE.PLATFORM_ADMIN]: {
    label: "مدير المنصة",
    className: "violet",
  },
  [ROLE.ORGANIZATION_ADMIN]: {
    label: "مدير الشركة",
    className: "blue",
  },
  [ROLE.SUPERVISOR]: {
    label: "مشرف صيانة",
    className: "teal",
  },
  [ROLE.TECHNICIAN]: {
    label: "فني صيانة",
    className: "amber",
  },
};

const AVAILABILITY_CONFIG = {
  AVAILABLE: {
    label: "متاح",
    className: "green",
  },
  BUSY: {
    label: "مشغول",
    className: "amber",
  },
  OFF_DUTY: {
    label: "خارج الدوام",
    className: "slate",
  },
};

function getUserId(user) {
  return user.id || user.user_id || user.email;
}

function getFullName(user) {
  return (
    user.full_name ||
    user.fullName ||
    user.name ||
    "مستخدم دون اسم"
  );
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
}

function getRoleConfig(role) {
  return (
    ROLE_CONFIG[role] || {
      label: role || "دور غير محدد",
      className: "slate",
    }
  );
}

function getAvailabilityConfig(status) {
  return (
    AVAILABILITY_CONFIG[status] || {
      label: "غير محدد",
      className: "slate",
    }
  );
}

function getLocations(user) {
  const locations =
    user.locations ||
    user.user_locations ||
    user.location_names ||
    [];

  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .map((location) => {
      if (typeof location === "string") {
        return location;
      }

      return (
        location.name ||
        location.location?.name ||
        location.locations?.name ||
        ""
      );
    })
    .filter(Boolean);
}

function getOpenTicketsCount(user) {
  return Number(
    user.open_tickets_count ??
      user.openTicketsCount ??
      user.active_tickets_count ??
      user.activeTicketsCount ??
      0
  );
}

function isUserActive(user) {
  return (
    user.is_active ??
    user.isActive ??
    user.status !== "INACTIVE"
  );
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
      disabled={typeof onSort !== "function"}
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
        cursor:
          typeof onSort === "function"
            ? "pointer"
            : "default",
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

export default function UserTable({
  users = [],
  loading = false,
  selectable = false,
  selectedIds = [],
  sortBy = "",
  sortDirection = "asc",
  disabled = false,
  onSort,
  onSelectionChange,
  onOpen,
  onEdit,
  onToggleStatus,
}) {
  const selectedSet = new Set(
    selectedIds.map((id) => String(id))
  );

  const availableIds = users
    .map(getUserId)
    .filter(Boolean)
    .map(String);

  const allSelected =
    availableIds.length > 0 &&
    availableIds.every((id) => selectedSet.has(id));

  const partiallySelected =
    !allSelected &&
    availableIds.some((id) => selectedSet.has(id));

  function handleSelectAll(event) {
    if (event.target.checked) {
      onSelectionChange?.(availableIds);
      return;
    }

    onSelectionChange?.([]);
  }

  function handleSelectUser(event, user) {
    event.stopPropagation();

    const userId = String(getUserId(user));
    const nextSelection = new Set(selectedSet);

    if (event.target.checked) {
      nextSelection.add(userId);
    } else {
      nextSelection.delete(userId);
    }

    onSelectionChange?.([...nextSelection]);
  }

  function handleOpen(user) {
    if (!disabled) {
      onOpen?.(user);
    }
  }

  function handleKeyDown(event, user) {
    if (
      disabled ||
      typeof onOpen !== "function" ||
      !["Enter", " "].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    handleOpen(user);
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
              height: "58px",
              borderRadius: "8px",
              background: "#edf1f0",
            }}
          />
        ))}

        <span className="empty">
          جاري تحميل المستخدمين…
        </span>
      </section>
    );
  }

  if (users.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          icon="♙"
          title="لا يوجد مستخدمون"
          description="لم يتم العثور على مستخدمين مطابقين للبحث أو الفلاتر."
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
            minWidth: selectable ? "1040px" : "990px",
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
                    borderBottom:
                      "1px solid #e4e9e7",
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
                    aria-label="تحديد جميع المستخدمين"
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
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="المستخدم"
                  field="full_name"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  minWidth: "130px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="الدور"
                  field="role"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  minWidth: "170px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                المواقع
              </th>

              <th
                style={{
                  minWidth: "125px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                التوفر
              </th>

              <th
                style={{
                  minWidth: "105px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                الطلبات المفتوحة
              </th>

              <th
                style={{
                  minWidth: "105px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                الحالة
              </th>

              <th
                style={{
                  minWidth: "130px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                }}
              >
                <SortButton
                  label="تاريخ الإضافة"
                  field="created_at"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>

              <th
                style={{
                  width: "130px",
                  padding: "13px",
                  borderBottom:
                    "1px solid #e4e9e7",
                  textAlign: "center",
                }}
              >
                الإجراءات
              </th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => {
              const userId = getUserId(user);
              const fullName = getFullName(user);
              const roleConfig = getRoleConfig(user.role);
              const availabilityConfig =
                getAvailabilityConfig(
                  user.availability_status ||
                    user.availabilityStatus
                );
              const locations = getLocations(user);
              const openTicketsCount =
                getOpenTicketsCount(user);
              const active = isUserActive(user);
              const selected = selectedSet.has(
                String(userId)
              );

              return (
                <tr
                  key={userId}
                  tabIndex={
                    typeof onOpen === "function"
                      ? 0
                      : undefined
                  }
                  onClick={() => handleOpen(user)}
                  onKeyDown={(event) =>
                    handleKeyDown(event, user)
                  }
                  style={{
                    background: selected
                      ? "#f0f8f5"
                      : "#ffffff",
                    cursor:
                      typeof onOpen === "function" &&
                      !disabled
                        ? "pointer"
                        : "default",
                    opacity: active ? 1 : 0.72,
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
                          handleSelectUser(event, user)
                        }
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        disabled={disabled}
                        aria-label={`تحديد المستخدم ${fullName}`}
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
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        className="mini-avatar"
                        aria-hidden="true"
                        style={{
                          width: "34px",
                          height: "34px",
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(fullName)}
                      </span>

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
                          {fullName}
                        </strong>

                        <small
                          style={{
                            color: "#899694",
                            fontSize: "8px",
                            direction: "ltr",
                            textAlign: "right",
                          }}
                        >
                          {user.email || "دون بريد إلكتروني"}
                        </small>

                        {user.phone ||
                        user.phone_number ? (
                          <small
                            style={{
                              color: "#899694",
                              fontSize: "8px",
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {user.phone ||
                              user.phone_number}
                          </small>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: "5px",
                        justifyItems: "start",
                      }}
                    >
                      <span
                        className={`badge ${roleConfig.className}`}
                      >
                        {roleConfig.label}
                      </span>

                      {user.specialization ? (
                        <small
                          style={{
                            color: "#82908e",
                            fontSize: "8px",
                          }}
                        >
                          {user.specialization}
                        </small>
                      ) : null}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    {locations.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "5px",
                        }}
                      >
                        {locations
                          .slice(0, 2)
                          .map((location) => (
                            <span
                              key={location}
                              style={{
                                padding: "4px 7px",
                                borderRadius: "10px",
                                background: "#f0f4f3",
                                color: "#50625f",
                                fontSize: "8px",
                              }}
                            >
                              {location}
                            </span>
                          ))}

                        {locations.length > 2 ? (
                          <span
                            style={{
                              padding: "4px 7px",
                              borderRadius: "10px",
                              background: "#e5f2ef",
                              color: "#176c62",
                              fontSize: "8px",
                              fontWeight: 700,
                            }}
                          >
                            +{locations.length - 2}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <small
                        style={{
                          color: "#9ba6a4",
                          fontSize: "8px",
                        }}
                      >
                        جميع المواقع أو غير محدد
                      </small>
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    {user.role === ROLE.TECHNICIAN ? (
                      <span
                        className={`badge ${availabilityConfig.className}`}
                      >
                        {availabilityConfig.label}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "#9ba6a4",
                          fontSize: "9px",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                      textAlign: "center",
                    }}
                  >
                    <strong
                      className={
                        openTicketsCount > 5
                          ? "danger-text"
                          : ""
                      }
                      style={{
                        fontSize: "12px",
                      }}
                    >
                      {openTicketsCount}
                    </strong>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    <span
                      className={`badge ${
                        active ? "green" : "slate"
                      }`}
                    >
                      {active ? "نشط" : "غير نشط"}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                      color: "#60716e",
                      fontSize: "9px",
                    }}
                  >
                    {formatDate(
                      user.created_at ||
                        user.createdAt,
                      {
                        withTime: false,
                      }
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px",
                      borderBottom:
                        "1px solid #edf0ef",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      {typeof onEdit === "function" ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();

                            if (!disabled) {
                              onEdit(user);
                            }
                          }}
                          disabled={disabled}
                          style={{
                            padding: "7px 10px",
                            fontSize: "8px",
                          }}
                        >
                          تعديل
                        </button>
                      ) : null}

                      {typeof onToggleStatus ===
                      "function" ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={(event) => {
                            event.stopPropagation();

                            if (!disabled) {
                              onToggleStatus(user);
                            }
                          }}
                          disabled={disabled}
                          style={{
                            padding: "7px",
                            color: active
                              ? "#a84132"
                              : "#176c62",
                            fontSize: "8px",
                          }}
                        >
                          {active ? "تعطيل" : "تفعيل"}
                        </button>
                      ) : null}
                    </div>
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
