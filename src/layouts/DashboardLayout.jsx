import { useMemo } from "react";

import { ROLE } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";
import { PERMISSION } from "../utils/permissions";
import {
  navigate,
  useRouter,
} from "../routes/AppRouter";

/**
 * عناصر القائمة الجانبية.
 *
 * لا نضع هنا صفحات غير موجودة في المشروع حاليًا،
 * مثل صفحة المخزون المستقلة أو إدارة المنشآت.
 * سنضيفها عندما ننشئ ملفاتها الفعلية.
 */
const NAV_ITEMS = Object.freeze([
  {
    href: "/",
    icon: "▦",
    label: "نظرة عامة",
    roles: [
      ROLE.PLATFORM_ADMIN,
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
      ROLE.SUPERVISOR,
      ROLE.INVENTORY_MANAGER,
      ROLE.REGISTERED_REPORTER,
    ],
  },
  {
    href: "/my-tickets",
    icon: "▤",
    label: "مهامي",
    roles: [ROLE.TECHNICIAN],
    permission:
      PERMISSION.TICKETS_READ_ASSIGNED,
  },
  {
    href: "/tickets",
    icon: "▤",
    label: "طلبات الصيانة",
    roles: [
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
      ROLE.SUPERVISOR,
      ROLE.INVENTORY_MANAGER,
    ],
    permission: PERMISSION.TICKETS_READ,
  },
  {
    href: "/assets",
    icon: "⌁",
    label: "الأصول والأجهزة",
    roles: [
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
      ROLE.SUPERVISOR,
      ROLE.INVENTORY_MANAGER,
    ],
    permission: PERMISSION.ASSETS_READ,
  },
  {
    href: "/locations",
    icon: "⌖",
    label: "الفروع والمواقع",
    roles: [
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
      ROLE.SUPERVISOR,
    ],
    permission: PERMISSION.LOCATIONS_READ,
  },
  {
    href: "/users",
    icon: "♙",
    label: "المستخدمون والفنيون",
    roles: [
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
    ],
    permission: PERMISSION.USERS_READ,
  },
  {
    href: "/reports",
    icon: "◫",
    label: "التقارير",
    roles: [
      ROLE.ORGANIZATION_ADMIN,
      ROLE.BRANCH_MANAGER,
      ROLE.SUPERVISOR,
      ROLE.INVENTORY_MANAGER,
    ],
    permission: PERMISSION.REPORTS_READ,
  },
]);

/**
 * استخراج أول حرف من أول كلمتين في الاسم.
 *
 * مثال:
 * نورة الناصر ← نن
 */
function getUserInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "FF";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
}

/**
 * التحقق من أن المسار الحالي هو المسار النشط.
 *
 * صفحة تفاصيل طلب مثل:
 * /tickets/123
 *
 * تجعل عنصر طلبات الصيانة نشطًا أيضًا.
 */
function isActivePath(currentPath, href) {
  if (href === "/") {
    return currentPath === "/";
  }

  return (
    currentPath === href ||
    currentPath.startsWith(`${href}/`)
  );
}

export default function DashboardLayout({
  children,
}) {
  const {
    user,
    signOut,
    isDemo,

    roleLabel,
    fullName,
    email,

    hasRole,
    can,
  } = useAuth();

  const router = useRouter();
  const path = router?.path || "/";

  /**
   * فلترة القائمة حسب دور المستخدم وصلاحياته.
   */
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      const hasAllowedRole =
        !item.roles ||
        item.roles.length === 0 ||
        hasRole(item.roles);

      const hasRequiredPermission =
        !item.permission ||
        can(item.permission);

      return (
        hasAllowedRole &&
        hasRequiredPermission
      );
    });
  }, [hasRole, can]);

  const displayName =
    fullName ||
    user?.full_name ||
    user?.name ||
    email ||
    "مستخدم FixFlow";

  const initials = getUserInitials(displayName);

  async function logout() {
    try {
      await signOut();
    } finally {
      navigate("/login", true);
    }
  }

  function openPage(href) {
    if (path !== href) {
      navigate(href);
    }
  }

  return (
    <div className="app-shell">
      {/* القائمة الجانبية لسطح المكتب */}
      <aside className="sidebar">
        <button
          type="button"
          className="brand brand-button"
          onClick={() => openPage("/")}
          aria-label="الانتقال إلى الصفحة الرئيسية"
        >
          <span className="brand-mark">
            F
          </span>

          <div>
            <strong>FixFlow</strong>

            <small>
              إدارة الصيانة بوضوح
            </small>
          </div>
        </button>

        {isDemo && (
          <div className="demo-badge">
            وضع العرض التجريبي
          </div>
        )}

        <nav aria-label="القائمة الرئيسية">
          {visibleNavItems.map((item) => {
            const active = isActivePath(
              path,
              item.href
            );

            return (
              <button
                key={item.href}
                type="button"
                className={
                  `nav-item ${
                    active ? "active" : ""
                  }`
                }
                aria-current={
                  active ? "page" : undefined
                }
                onClick={() =>
                  openPage(item.href)
                }
              >
                <span aria-hidden="true">
                  {item.icon}
                </span>

                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="nav-item"
            onClick={logout}
          >
            <span aria-hidden="true">
              ↪
            </span>

            تسجيل الخروج
          </button>

          <div className="user-card">
            <span className="avatar">
              {initials}
            </span>

            <div>
              <strong>{displayName}</strong>

              <small>
                {roleLabel}
              </small>
            </div>
          </div>
        </div>
      </aside>

      {/* رأس مبسط يظهر في الجوال */}
      <header className="mobile-dashboard-header">
        <button
          type="button"
          className="mobile-brand"
          onClick={() => openPage("/")}
          aria-label="الصفحة الرئيسية"
        >
          <span className="mobile-logo">
            F
          </span>

          <span>
            <strong>FixFlow</strong>
            <small>{roleLabel}</small>
          </span>
        </button>

        <button
          type="button"
          className="mobile-logout-button"
          onClick={logout}
          aria-label="تسجيل الخروج"
        >
          ↪
        </button>
      </header>

      <main className="dashboard-main">
        {children}
      </main>

      {/* تنقل سفلي للجوال */}
      {visibleNavItems.length > 0 && (
        <nav
          className="mobile-bottom-nav"
          aria-label="التنقل في الجوال"
        >
          {visibleNavItems
            .slice(0, 5)
            .map((item) => {
              const active = isActivePath(
                path,
                item.href
              );

              return (
                <button
                  key={item.href}
                  type="button"
                  className={
                    active ? "active" : ""
                  }
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    openPage(item.href)
                  }
                >
                  <span aria-hidden="true">
                    {item.icon}
                  </span>

                  <small>
                    {item.label}
                  </small>
                </button>
              );
            })}
        </nav>
      )}
    </div>
  );
}