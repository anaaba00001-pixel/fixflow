import { useId, useState } from "react";
import { navigate } from "../../routes/AppRouter";
import { updatePassword } from "../../services/authService";

export default function ResetPasswordPage() {
  const passwordId = useId();
  const confirmationId = useId();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (password.length < 8) {
      setError("يجب ألا تقل كلمة المرور عن 8 أحرف.");
      return;
    }
    if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
      setError("استخدم أحرفًا وأرقامًا على الأقل في كلمة المرور.");
      return;
    }
    if (password !== confirmation) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      setComplete(true);
    } catch (updateError) {
      const message = String(updateError?.message || "");
      setError(
        /session|expired|token|auth/i.test(message)
          ? "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا."
          : message || "تعذر تحديث كلمة المرور. حاول مرة أخرى."
      );
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <section className="auth-card" role="status">
        <small className="eyebrow">استعادة الحساب</small>
        <h1>تم تحديث كلمة المرور</h1>
        <p>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
        <button className="primary wide" type="button" onClick={() => navigate("/login", true)}>
          الانتقال إلى تسجيل الدخول
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <small className="eyebrow">استعادة الحساب</small>
      <h1>تعيين كلمة مرور جديدة</h1>
      <p>اختر كلمة مرور قوية ومختلفة عن كلمات المرور السابقة.</p>

      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor={passwordId}>
          كلمة المرور الجديدة
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={busy}
            required
            autoFocus
          />
        </label>
        <label htmlFor={confirmationId}>
          تأكيد كلمة المرور
          <input
            id={confirmationId}
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            disabled={busy}
            required
          />
        </label>
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? "جارٍ التحديث…" : "حفظ كلمة المرور الجديدة"}
        </button>
      </form>
    </section>
  );
}
