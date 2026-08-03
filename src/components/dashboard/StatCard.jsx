export default function StatCard({
  label,
  value = 0,
  icon = "▤",
  colorClass = "blue-bg",
  description = "محدّث الآن",
  valueSuffix = "",
  trend = "",
  trendType = "up",
  onClick,
}) {
  const content = (
    <>
      <div>
        <small>{label}</small>

        <strong>
          {value}
          {valueSuffix ? <em> {valueSuffix}</em> : null}
        </strong>

        <p className={trendType === "danger" ? "danger-text" : ""}>
          {trend ? (
            <>
              <span className={trendType}>{trend}</span>{" "}
            </>
          ) : null}

          {description}
        </p>
      </div>

      <span
        className={`stat-icon ${colorClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        className="stat-card"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "right",
          cursor: "pointer",
        }}
        aria-label={`${label}: ${value} ${valueSuffix}`.trim()}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      className="stat-card"
      aria-label={`${label}: ${value} ${valueSuffix}`.trim()}
    >
      {content}
    </article>
  );
}
