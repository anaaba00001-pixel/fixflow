import { formatDate } from "../../utils/formatDate";

function getCount(location, ...keys) {
  for (const key of keys) {
    const value = location?.[key];

    if (value !== undefined && value !== null) {
      return Number(value) || 0;
    }
  }

  return 0;
}

export default function LocationCard({
  location,
  disabled = false,
  onOpen,
  onEdit,
  onToggleStatus,
}) {
  if (!location) {
    return null;
  }

  const isActive =
    location.is_active ??
    location.isActive ??
    location.status !== "INACTIVE";

  const assetsCount = getCount(
    location,
    "assets_count",
    "assetsCount",
    "asset_count"
  );

  const openTicketsCount = getCount(
    location,
    "open_tickets_count",
    "openTicketsCount",
    "tickets_count"
  );

  const usersCount = getCount(
    location,
    "users_count",
    "usersCount",
    "team_count"
  );

  const locationName = location.name || "موقع دون اسم";
  const address = location.address || "لم يتم تحديد العنوان";
  const description =
    location.description || "لا توجد ملاحظات إضافية لهذا الموقع.";

  function handleOpen() {
    if (!disabled) {
      onOpen?.(location);
    }
  }

  function handleEdit() {
    if (!disabled) {
      onEdit?.(location);
    }
  }

  function handleToggleStatus() {
    if (!disabled) {
      onToggleStatus?.(location);
    }
  }

  return (
    <article
      className="panel"
      style={{
        display: "grid",
        gap: "16px",
        padding: "18px",
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "44px",
            height: "44px",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "12px",
            background: "#e3f1ed",
            color: "#176c62",
            fontSize: "20px",
          }}
        >
          ⌖
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
                color: "#233b37",
                font: "inherit",
                fontWeight: 700,
                textAlign: "right",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {locationName}
            </button>
          ) : (
            <strong>{locationName}</strong>
          )}

          <small
            style={{
              color: "#82908e",
              lineHeight: 1.6,
            }}
          >
            {address}
          </small>
        </div>

        <span
          className={`badge ${isActive ? "green" : "slate"}`}
          style={{ marginRight: "auto" }}
        >
          {isActive ? "نشط" : "غير نشط"}
        </span>
      </header>

      <p
        style={{
          margin: 0,
          minHeight: "38px",
          color: "#687875",
          fontSize: "10px",
          lineHeight: 1.8,
        }}
      >
        {description}
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "8px",
        }}
      >
        <div
          style={{
            padding: "11px",
            borderRadius: "10px",
            background: "#f5f8f7",
            textAlign: "center",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#23443f",
              fontSize: "17px",
            }}
          >
            {assetsCount}
          </strong>

          <small style={{ color: "#82908e" }}>الأجهزة</small>
        </div>

        <div
          style={{
            padding: "11px",
            borderRadius: "10px",
            background: "#f5f8f7",
            textAlign: "center",
          }}
        >
          <strong
            className={openTicketsCount > 0 ? "danger-text" : ""}
            style={{
              display: "block",
              fontSize: "17px",
            }}
          >
            {openTicketsCount}
          </strong>

          <small style={{ color: "#82908e" }}>طلبات مفتوحة</small>
        </div>

        <div
          style={{
            padding: "11px",
            borderRadius: "10px",
            background: "#f5f8f7",
            textAlign: "center",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#23443f",
              fontSize: "17px",
            }}
          >
            {usersCount}
          </strong>

          <small style={{ color: "#82908e" }}>أعضاء الفريق</small>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          color: "#82908e",
          fontSize: "9px",
        }}
      >
        <span>تاريخ الإضافة</span>

        <span>
          {formatDate(location.created_at || location.createdAt, {
            withTime: false,
          })}
        </span>
      </div>

      <footer
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          paddingTop: "13px",
          borderTop: "1px solid #edf0ef",
        }}
      >
        {typeof onOpen === "function" ? (
          <button
            type="button"
            className="secondary"
            onClick={handleOpen}
            disabled={disabled}
          >
            عرض التفاصيل
          </button>
        ) : null}

        {typeof onEdit === "function" ? (
          <button
            type="button"
            className="text-button"
            onClick={handleEdit}
            disabled={disabled}
            style={{
              padding: "8px",
            }}
          >
            تعديل
          </button>
        ) : null}

        {typeof onToggleStatus === "function" ? (
          <button
            type="button"
            className="text-button"
            onClick={handleToggleStatus}
            disabled={disabled}
            style={{
              marginRight: "auto",
              padding: "8px",
              color: isActive ? "#a84132" : "#176c62",
            }}
          >
            {isActive ? "تعطيل الموقع" : "تفعيل الموقع"}
          </button>
        ) : null}
      </footer>
    </article>
  );
}
