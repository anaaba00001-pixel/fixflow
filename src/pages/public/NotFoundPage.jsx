import { navigate } from "../../routes/AppRouter";

export default function NotFoundPage() {
  function handleGoBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate("/");
  }

  return (
    <section className="auth-card">
      <span
        className="auth-icon"
        aria-hidden="true"
        style={{
          color: "#a84132",
          background: "#fae8e4",
        }}
      >
        404
      </span>

      <small className="eyebrow">
        الصفحة غير موجودة
      </small>

      <h1>تعذر العثور على الصفحة</h1>

      <p>
        قد يكون الرابط غير صحيح، أو تم نقل الصفحة، أو لم
        تعد متاحة.
      </p>

      <div
        style={{
          display: "grid",
          gap: "9px",
          marginTop: "10px",
        }}
      >
        <button
          type="button"
          className="primary wide"
          onClick={() => navigate("/")}
        >
          الذهاب إلى الصفحة الرئيسية
        </button>

        <button
          type="button"
          className="secondary wide"
          onClick={handleGoBack}
        >
          العودة إلى الصفحة السابقة
        </button>

        <button
          type="button"
          className="text-button center"
          onClick={() => navigate("/login")}
        >
          الانتقال إلى تسجيل الدخول
        </button>
      </div>
    </section>
  );
}
