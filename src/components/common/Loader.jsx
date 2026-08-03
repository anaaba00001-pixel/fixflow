export default function Loader({
  message = "جاري التحميل…",
  fullScreen = true,
  className = "",
}) {
  const classes = [
    fullScreen ? "full-loader" : "loader",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
