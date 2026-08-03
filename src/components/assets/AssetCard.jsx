import { formatDate } from "../../utils/formatDate";

const STATUS_CONFIG = {
  ACTIVE: {
    label: "نشط",
    color: "green",
  },
  INACTIVE: {
    label: "غير نشط",
    color: "slate",
  },
  UNDER_MAINTENANCE: {
    label: "تحت الصيانة",
    color: "amber",
  },
  RETIRED: {
    label: "متقاعد",
    color: "violet",
  },
};

function getAssetStatus(asset) {
  if (asset.status && STATUS_CONFIG[asset.status]) {
    return asset.status;
  }

  return asset.is_active === false ? "INACTIVE" : "ACTIVE";
}

function getLocationName(asset) {
  return (
    asset.location_name ||
    asset.location?.name ||
    asset.locations?.name ||
    "موقع غير محدد"
  );
}

function getCategoryName(asset) {
  return (
    asset.category_name ||
    asset.category?.name ||
    asset.categories?.name ||
    "دون تصنيف"
  );
}

function getAssetNumber(asset) {
  return asset.asset_number || asset.assetNumber || "—";
}

function getSerialNumber(asset) {
  return asset.serial_number || asset.serialNumber || "—";
}

export default function AssetCard({
  asset,
  disabled = false,
  onOpen,
  onEdit,
  onShowQR,
}) {
  if (!asset) {
    return null;
  }

  const status = getAssetStatus(asset);
  const statusConfig = STATUS_CONFIG[status];
  const openTickets =
    asset.open_tickets_count ??
    asset.openTicketsCount ??
    asset.open_tickets ??
    0;

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
            width: "42px",
            height: "42px",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            background: "#e3f1ed",
            color: "#176c62",
            fontSize: "19px",
          }}
        >
          ◫
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
              onClick={() => onOpen(asset)}
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
              {asset.name || "جهاز دون اسم"}
            </button>
          ) : (
            <strong>{asset.name || "جهاز دون اسم"}</strong>
          )}

          <small
            style={{
              color: "#82908e",
            }}
          >
            {getAssetNumber(asset)}
          </small>
        </div>

        <span
          className={`badge ${statusConfig.color}`}
          style={{ marginRight: "auto" }}
        >
          {statusConfig.label}
        </span>
      </header>

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
            {getLocationName(asset)}
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
            التصنيف
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {getCategoryName(asset)}
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
            الرقم التسلسلي
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              textAlign: "left",
              direction: "ltr",
            }}
          >
            {getSerialNumber(asset)}
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
            الطلبات المفتوحة
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {openTickets}
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
            تاريخ الإضافة
          </dt>

          <dd
            style={{
              margin: 0,
              fontSize: "9px",
              color: "#60716e",
            }}
          >
            {formatDate(asset.created_at || asset.createdAt, {
              withTime: false,
            })}
          </dd>
        </div>
      </dl>

      <footer
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          paddingTop: "12px",
          borderTop: "1px solid #edf0ef",
        }}
      >
        {typeof onShowQR === "function" ? (
          <button
            type="button"
            className="secondary"
            onClick={() => onShowQR(asset)}
            disabled={disabled || status === "RETIRED"}
          >
            عرض QR
          </button>
        ) : null}

        {typeof onEdit === "function" ? (
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit(asset)}
            disabled={disabled}
            style={{
              marginRight: "auto",
              padding: "8px",
            }}
          >
            تعديل الجهاز
          </button>
        ) : null}
      </footer>
    </article>
  );
}
