import { useMemo, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";

/* ==================================================
   حسابات العرض التجريبية
================================================== */

const DEMO_ACCOUNTS = Object.freeze([
  {
    email: "platform@fixflow.demo",
    label: "مدير المنصة",
  },
  {
    email: "admin@fixflow.demo",
    label: "مدير المنشأة",
  },
  {
    email: "branch@fixflow.demo",
    label: "مدير الفرع",
  },
  {
    email: "supervisor@fixflow.demo",
    label: "مشرف الصيانة",
  },
  {
    email: "technician@fixflow.demo",
    label: "فني الصيانة",
  },
  {
    email: "inventory@fixflow.demo",
    label: "مسؤول المخزون",
  },
  {
    email: "reporter@fixflow.demo",
    label: "المبلّغ المسجّل",
  },
]);

const DEMO_PASSWORD = "Demo1234!";

/* ==================================================
   نموذج تسجيل الدخول
================================================== */

export default function LoginForm({
  initialEmail = "",
  initialPassword = "",
  busy = false,
  error = "",
  isDemo = false,
  submitText = "تسجيل الدخول",
  onSubmit,
  onForgotPassword,
}) {
  const defaultEmail =
    initialEmail ||
    (isDemo
      ? "admin@fixflow.demo"
      : "");

  const defaultPassword =
    initialPassword ||
    (isDemo
      ? DEMO_PASSWORD
      : "");

  const [email, setEmail] =
    useState(defaultEmail);

  const [password, setPassword] =
    useState(defaultPassword);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  /**
   * معرفة الدور المختار حاليًا.
   */
  const selectedDemoAccount =
    useMemo(() => {
      return (
        DEMO_ACCOUNTS.find(
          (account) =>
            account.email ===
            email.trim().toLowerCase()
        ) || null
      );
    }, [email]);

  function clearFieldError(
    fieldName
  ) {
    setFieldErrors(
      (current) => ({
        ...current,
        [fieldName]: "",
      })
    );
  }

  /**
   * تعبئة بيانات حساب العرض المختار.
   */
  function selectDemoAccount(
    event
  ) {
    const selectedEmail =
      event.target.value;

    if (!selectedEmail) {
      return;
    }

    setEmail(selectedEmail);
    setPassword(DEMO_PASSWORD);

    setFieldErrors({});
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      typeof onSubmit !==
        "function"
    ) {
      return;
    }

    const credentials = {
      email: String(email || "")
        .trim()
        .toLowerCase(),

      password: String(
        password || ""
      ),
    };

    const nextErrors = {};

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!credentials.email) {
      nextErrors.email =
        "البريد الإلكتروني مطلوب.";
    } else if (
      !emailPattern.test(
        credentials.email
      )
    ) {
      nextErrors.email =
        "أدخلي بريدًا إلكترونيًا صحيحًا.";
    }

    if (!credentials.password) {
      nextErrors.password =
        "كلمة المرور مطلوبة.";
    } else if (
      !isDemo &&
      credentials.password.length <
        6
    ) {
      nextErrors.password =
        "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    }

    setFieldErrors(nextErrors);

    if (
      Object.keys(nextErrors)
        .length > 0
    ) {
      return;
    }

    await onSubmit(
      credentials,
      event.currentTarget
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
    >
      {/* اختيار حساب العرض */}
      {isDemo ? (
        <div
          className="demo-callout"
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "4px",
            }}
          >
            <strong>
              وضع العرض التجريبي
            </strong>

            <span>
              اختاري المستخدم الذي
              تريدين تجربة النظام
              بصفته.
            </span>
          </div>

          <label
            style={{
              display: "grid",
              gap: "7px",
              margin: 0,
            }}
          >
            <span>
              نوع المستخدم
            </span>

            <select
              value={
                selectedDemoAccount
                  ?.email || ""
              }
              onChange={
                selectDemoAccount
              }
              disabled={busy}
              style={{
                width: "100%",
                minHeight: "43px",
                padding:
                  "10px 12px",
                border:
                  "1px solid #dfe6e4",
                borderRadius:
                  "8px",
                background:
                  "#ffffff",
                color:
                  "#173231",
                outline: "none",
              }}
            >
              <option value="">
                اختيار حساب تجريبي
              </option>

              {DEMO_ACCOUNTS.map(
                (account) => (
                  <option
                    key={
                      account.email
                    }
                    value={
                      account.email
                    }
                  >
                    {account.label}
                    {" — "}
                    {account.email}
                  </option>
                )
              )}
            </select>
          </label>

          <small
            style={{
              color: "#71817f",
              lineHeight: 1.7,
            }}
          >
            كلمة مرور جميع الحسابات:
            {" "}
            <strong dir="ltr">
              {DEMO_PASSWORD}
            </strong>
          </small>
        </div>
      ) : null}

      {/* رسالة الخطأ العامة */}
      {error ? (
        <div
          className="form-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* البريد الإلكتروني */}
      <Input
        label="البريد الإلكتروني"
        name="email"
        type="email"
        value={email}
        placeholder="name@example.com"
        error={
          fieldErrors.email
        }
        onChange={(event) => {
          setEmail(
            event.target.value
          );

          clearFieldError(
            "email"
          );
        }}
        disabled={busy}
        required
        dir="ltr"
        inputMode="email"
        autoComplete="email"
        autoFocus
      />

      {/* كلمة المرور */}
      <label>
        <span>
          كلمة المرور
          <span aria-hidden="true">
            {" "}*
          </span>
        </span>

        <div
          style={{
            position: "relative",
          }}
        >
          <input
            name="password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={password}
            placeholder="أدخلي كلمة المرور"
            onChange={(event) => {
              setPassword(
                event.target.value
              );

              clearFieldError(
                "password"
              );
            }}
            disabled={busy}
            required
            dir="ltr"
            autoComplete="current-password"
            aria-invalid={Boolean(
              fieldErrors.password
            )}
            style={{
              width: "100%",
              paddingLeft: "72px",
            }}
          />

          <button
            type="button"
            className="text-button"
            onClick={() =>
              setShowPassword(
                (current) =>
                  !current
              )
            }
            disabled={busy}
            aria-label={
              showPassword
                ? "إخفاء كلمة المرور"
                : "إظهار كلمة المرور"
            }
            style={{
              position: "absolute",
              top: "50%",
              left: "10px",
              transform:
                "translateY(-50%)",
              padding: "5px",
              fontSize: "9px",
            }}
          >
            {showPassword
              ? "إخفاء"
              : "إظهار"}
          </button>
        </div>

        {fieldErrors.password ? (
          <small
            className="form-error"
            role="alert"
          >
            {
              fieldErrors.password
            }
          </small>
        ) : null}
      </label>

      {/* نسيت كلمة المرور */}
      {typeof onForgotPassword ===
      "function" ? (
        <button
          type="button"
          className="text-button"
          onClick={
            onForgotPassword
          }
          disabled={busy}
        >
          نسيت كلمة المرور؟
        </button>
      ) : null}

      {/* زر الدخول */}
      <Button
        type="submit"
        fullWidth
        loading={busy}
        loadingText="جاري تسجيل الدخول…"
      >
        {submitText}
      </Button>
    </form>
  );
}