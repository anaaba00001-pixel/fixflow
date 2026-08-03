import { Component, useEffect } from "react";

import { AuthProvider } from "./context/AuthContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import AppRouter from "./routes/AppRouter";

/* ==================================================
   إعداد اتجاه ولغة التطبيق
================================================== */

function AppSetup({ children }) {
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";

    document.body.setAttribute(
      "dir",
      "rtl"
    );

    document.body.setAttribute(
      "lang",
      "ar"
    );
  }, []);

  return children;
}

/* ==================================================
   معالجة أخطاء التطبيق
================================================== */

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,

      errorMessage:
        error?.message ||
        "حدث خطأ غير متوقع داخل التطبيق.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "FixFlow application error:",
      error,
      errorInfo
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.history.replaceState(
      {},
      "",
      "/"
    );

    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        className="public-shell"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "20px",
        }}
      >
        <section
          className="auth-card"
          role="alert"
          style={{
            textAlign: "center",
          }}
        >
          <span
            className="auth-icon"
            aria-hidden="true"
            style={{
              marginInline:
                "auto",

              color:
                "#a84132",

              background:
                "#fff0ed",
            }}
          >
            !
          </span>

          <small className="eyebrow">
            تعذر تشغيل الصفحة
          </small>

          <h1>
            حدث خطأ داخل FixFlow
          </h1>

          <p>
            لم يتمكن التطبيق من عرض الصفحة الحالية. يمكنك
            إعادة المحاولة أو العودة إلى لوحة التحكم.
          </p>

          {import.meta.env.DEV &&
          this.state.errorMessage ? (
            <pre
              style={{
                margin:
                  "16px 0",

                padding:
                  "12px",

                overflowX:
                  "auto",

                border:
                  "1px solid #eadedb",

                borderRadius:
                  "9px",

                background:
                  "#fff8f6",

                color:
                  "#8e3e32",

                direction:
                  "ltr",

                textAlign:
                  "left",

                whiteSpace:
                  "pre-wrap",

                fontSize:
                  "11px",
              }}
            >
              {this.state.errorMessage}
            </pre>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: "9px",
              marginTop: "18px",
            }}
          >
            <button
              type="button"
              className="primary wide"
              onClick={
                this.handleReload
              }
            >
              إعادة تحميل الصفحة
            </button>

            <button
              type="button"
              className="secondary wide"
              onClick={
                this.handleGoHome
              }
            >
              العودة إلى لوحة التحكم
            </button>
          </div>
        </section>
      </main>
    );
  }
}

/* ==================================================
   التطبيق الرئيسي
================================================== */

export default function App() {
  return (
    <AppErrorBoundary>
      <AppSetup>
        <AuthProvider>
          <OrganizationProvider>
            <AppRouter />
          </OrganizationProvider>
        </AuthProvider>
      </AppSetup>
    </AppErrorBoundary>
  );
}