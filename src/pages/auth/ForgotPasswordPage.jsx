import { useId, useState } from "react";
import { resetPassword } from "../../services/authService";
import { isSupabaseConfigured } from "../../lib/supabase";
import { navigate } from "../../routes/AppRouter";

export default function ForgotPasswordPage() {
  const emailId = useId();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    setError("");
    setMessage("");

    if (!normalizedEmail) {
      setError("البريد الإلكتروني مطلوب.");
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setError("أدخلي بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    if (!isSupabaseConfigured) {
      setMessage(
        "في وضع العرض لا يتم إرسال بريد. اربطي Supabase لتفعيل الاستعادة."
      );
      return;
    }

    setBusy(true);

    try {
      await resetPassword(normalizedEmail);

      setMessage(
        "أرسلنا رابط الاستعادة إذا كان البريد مسجلًا."
      );
    } catch (resetError) {
      const errorMessage = String(
        resetError?.message || ""
      ).toLowerCase();

      if (
        errorMessage.includes("rate") ||
        errorMessage.includes("limit")
      ) {
        setError(
          "تم إرسال عدة طلبات خلال وقت قصير. انتظري قليلًا ثم حاولي مرة أخرى."
        );
      } else {
        setError(
          "تعذر إرسال الرابط الآن. حاولي مرة أخرى."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handleBackToLogin() {
    if (!busy) {
      navigate("/login");
    }
  }

  return (
    <section className="auth-card">
      <span className="auth-icon" aria-hidden="true">
        ✉
      </span>

      <small className="eyebrow">
        استعادة الحساب
      </small>

      <h1>نسيت كلمة المرور؟</h1>

      <p>
        أدخلي بريدك وسنرسل رابطًا آمنًا لتعيين كلمة مرور
        جديدة.
      </p>

      {message ? (
        <div
          className="demo-callout"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          className="form-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor={emailId}>
          البريد الإلكتروني

          <input
            id={emailId}
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
              setMessage("");
            }}
            placeholder="name@company.com"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            disabled={busy}
            required
            autoFocus
            aria-invalid={Boolean(error)}
          />
        </label>

        <button
          type="submit"
          className="primary wide"
          disabled={busy}
        >
          {busy
            ? "جاري إرسال الرابط…"
            : "إرسال رابط الاستعادة"}
        </button>
      </form>

      <button
        type="button"
        className="text-button center"
        onClick={handleBackToLogin}
        disabled={busy}
      >
        العودة إلى تسجيل الدخول
      </button>
    </section>
  );
}