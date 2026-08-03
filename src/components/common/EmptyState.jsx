export default function EmptyState({
  icon = "⌕",
  title = "لا توجد بيانات",
  description = "لم يتم العثور على عناصر لعرضها حاليًا.",
  actionLabel = "",
  onAction,
  className = "",
}) {
  const classes = ["empty", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-live="polite">
      {icon ? (
        <span
          aria-hidden="true"
          style={{
            display: "block",
            marginBottom: "10px",
            fontSize: "30px",
          }}
        >
          {icon}
        </span>
      ) : null}

      <strong
        style={{
          display: "block",
          marginBottom: "6px",
          color: "#2f4541",
          fontSize: "13px",
        }}
      >
        {title}
      </strong>

      {description ? (
        <p
          style={{
            maxWidth: "420px",
            margin: "0 auto",
            lineHeight: 1.8,
          }}
        >
          {description}
        </p>
      ) : null}

      {actionLabel && typeof onAction === "function" ? (
        <button
          type="button"
          className="primary"
          onClick={onAction}
          style={{ marginTop: "16px" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
