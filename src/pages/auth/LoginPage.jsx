import {
  useEffect,
  useState,
} from "react";

import LoginForm from "../../components/forms/LoginForm";
import { useAuth } from "../../hooks/useAuth";
import { navigate } from "../../routes/AppRouter";

export default function LoginPage() {
  const {
    user,
    loading,
    signIn,
    isDemo,
  } = useAuth();

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * إذا كان المستخدم مسجلًا بالفعل،
   * ينتقل إلى الصفحة المناسبة لدوره
   * عن طريق المسار الرئيسي.
   */
  useEffect(() => {
    if (!loading && user) {
      navigate("/", true);
    }
  }, [loading, user]);

  async function handleLogin({
    email,
    password,
  }) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await signIn(
        email,
        password
      );

      /*
       * المسار الرئيسي في AppRouter
       * يحدد الصفحة المناسبة حسب الدور.
       */
      navigate("/", true);
    } catch (loginError) {
      const rawMessage = String(
        loginError?.message || ""
      );

      const message =
        rawMessage.toLowerCase();

      if (
        message.includes(
          "invalid login"
        ) ||
        message.includes(
          "invalid credentials"
        )
      ) {
        setError(
          "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        );
      } else if (
        message.includes(
          "email not confirmed"
        )
      ) {
        setError(
          "يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول."
        );
      } else if (
        message.includes(
          "الحساب غير متاح"
        ) ||
        message.includes(
          "account unavailable"
        )
      ) {
        setError(
          "هذا الحساب غير نشط أو غير متاح."
        );
      } else if (
        message.includes(
          "user not found"
        )
      ) {
        setError(
          "لم يتم العثور على الحساب."
        );
      } else if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes(
          "failed to fetch"
        )
      ) {
        setError(
          "تعذر الاتصال بالخادم. تحققي من اتصال الإنترنت ثم حاولي مرة أخرى."
        );
      } else if (
        message.includes(
          "too many requests"
        ) ||
        message.includes("rate limit")
      ) {
        setError(
          "تمت محاولات تسجيل دخول كثيرة. انتظري قليلًا ثم حاولي مرة أخرى."
        );
      } else {
        setError(
          rawMessage ||
            "تعذر تسجيل الدخول. حاولي مرة أخرى."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handleForgotPassword() {
    if (busy) {
      return;
    }

    setError("");
    navigate(
      "/forgot-password"
    );
  }

  /*
   * شاشة التحقق من الجلسة.
   */
  if (loading) {
    return (
      <section
        className="auth-card"
        role="status"
        aria-live="polite"
      >
        <span
          className="auth-icon"
          aria-hidden="true"
        >
          ↗
        </span>

        <small className="eyebrow">
          نظام FixFlow
        </small>

        <h1>
          جاري التحقق من الجلسة…
        </h1>

        <p>
          يرجى الانتظار قليلًا.
        </p>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <span
        className="auth-icon"
        aria-hidden="true"
      >
        ↗
      </span>

      <small className="eyebrow">
        نظام إدارة الصيانة
      </small>

      <h1>
        مرحبًا بعودتك
      </h1>

      <p>
        سجّل الدخول للوصول إلى
        الواجهة والصلاحيات المناسبة
        لحسابك.
      </p>

      <LoginForm
        onSubmit={handleLogin}
        onForgotPassword={
          handleForgotPassword
        }
        busy={busy}
        error={error}
        isDemo={isDemo}
      />

      {isDemo ? (
        <small
          style={{
            display: "block",
            marginTop: "14px",
            color: "#71817f",
            lineHeight: 1.8,
            textAlign: "center",
          }}
        >
          اختاري نوع المستخدم من
          القائمة لتجربة صلاحيات كل
          حساب.
        </small>
      ) : null}
    </section>
  );
}