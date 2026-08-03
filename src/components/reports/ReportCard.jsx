import { formatDate } from "../../utils/formatDate";

const TREND_CONFIG = {
  up: {
    symbol: "↑",
    color: "#25805e",
  },
  down: {
    symbol: "↓",
    color: "#bd4c47",
  },
  neutral: {
    symbol: "—",
    color: "#71817f",
  },
};

export default function ReportCard({
  title,
  value = 0,
  valueSuffix = "",
  description = "",
  icon = "▥",
  colorClass = "green-bg",
  trend = "",
  trendType = "neutral",
  progress,
  updatedAt,
  actionLabel = "",
  loading = false,
  onClick,
}) {
  const trendConfig =
    TREND_CONFIG[trendType] || TREND_CONFIG.neutral;

  const normalizedProgress =
    typeof progress === "number"
      ? Math.min(100, Math.max(0, progress))
      : null;

  function handleClick() {
    if (!loading) {
      onClick?.();
    }
  }

  const content = (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          margin: 0,
        }}
      >
        <span
          className={`stat-icon ${colorClass}`}
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          {icon}
        </span>

        <div
          style={{
            display: "grid",
            gap: "5px",
            minWidth: 0,
          }}
        >
          <small
            style={{
              color: "#71817f",
              fontSize: "10px",
            }}
          >
            {title}
          </small>

          {loading ? (
            <span
              role="status"
              aria-live="polite"
              style={{
                width: "90px",
                height: "28px",
                borderRadius: "7px",
                background: "#edf1f0",
              }}
            />
          ) : (
            <strong
              style={{
                color: "#173231",
                fontSize: "26px",
                lineHeight: 1.3,
              }}
            >
              {value}

              {valueSuffix ? (
                <span
                  style={{
                    marginRight: "5px",
                    color: "#71817f",
                    fontSize: "10px",
                    fontWeight: 500,
                  }}
                >
                  {valueSuffix}
                </span>
              ) : null}
            </strong>
          )}
        </div>
      </header>

      {description ? (
        <p
          style={{
            minHeight: "34px",
            margin: 0,
            color: "#71817f",
            fontSize: "9px",
            lineHeight: 1.8,
          }}
        >
          {description}
        </p>
      ) : null}

      {normalizedProgress !== null ? (
        <div
          style={{
            display: "grid",
            gap: "7px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#71817f",
              fontSize: "9px",
            }}
          >
            <span>نسبة الإنجاز</span>
            <strong>{normalizedProgress}%</strong>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={normalizedProgress}
            style={{
              height: "7px",
              overflow: "hidden",
              borderRadius: "10px",
              background: "#edf1f0",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${normalizedProgress}%`,
                height: "100%",
                borderRadius: "10px",
                background: "#2a8b79",
                transition: "width 200ms ease",
              }}
            />
          </div>
        </div>
      ) : null}

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minHeight: "28px",
          paddingTop: "12px",
          borderTop: "1px solid #edf0ef",
        }}
      >
        {trend ? (
          <span
            style={{
              color: trendConfig.color,
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            {trendConfig.symbol} {trend}
          </span>
        ) : null}

        {updatedAt ? (
          <small
            style={{
              marginRight: trend ? "8px" : 0,
              color: "#8a9896",
              fontSize: "8px",
            }}
          >
            آخر تحديث:{" "}
            {formatDate(updatedAt, {
              withTime: true,
            })}
          </small>
        ) : null}

        {actionLabel && typeof onClick === "function" ? (
          <span
            style={{
              marginRight: "auto",
              color: "#176c62",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            {actionLabel} ←
          </span>
        ) : null}
      </footer>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        className="panel"
        onClick={handleClick}
        disabled={loading}
        style={{
          width: "100%",
          display: "grid",
          gap: "15px",
          padding: "18px",
          border: "1px solid #e5eae8",
          background: "#ffffff",
          color: "inherit",
          textAlign: "right",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      className="panel"
      style={{
        display: "grid",
        gap: "15px",
        padding: "18px",
      }}
    >
      {content}
    </article>
  );
}
