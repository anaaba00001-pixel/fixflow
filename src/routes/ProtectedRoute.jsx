import { useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { navigate } from "./AppRouter";

/**
 * توحيد الأدوار المرسلة إلى المكوّن.
 */
function normalizeRoles(roles) {
  if (!roles) {
    return [];
  }

  const values = Array.isArray(roles)
    ? roles
    : [roles];

  return values
    .filter(Boolean)
    .map((role) =>
      String(role).trim().toUpperCase()
    );
}

/**
 * توحيد الصلاحيات المرسلة إلى المكوّن.
 */
function normalizePermissions(permissions) {
  if (!permissions) {
    return [];
  }

  const values = Array.isArray(permissions)
    ? permissions
    : [permissions];

  return values
    .filter(Boolean)
    .map((permission) =>
      String(permission).trim()
    );
}

/**
 * حماية الصفحات الداخلية في FixFlow.
 *
 * الاستخدام الأساسي:
 *
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 *
 * السماح لأدوار محددة:
 *
 * <ProtectedRoute
 *   allowedRoles={[
 *     ROLE.ORGANIZATION_ADMIN,
 *     ROLE.SUPERVISOR,
 *   ]}
 * >
 *   <TicketsPage />
 * </ProtectedRoute>
 *
 * اشتراط صلاحية:
 *
 * <ProtectedRoute
 *   requiredPermissions={[
 *     PERMISSION.TICKETS_READ,
 *   ]}
 * >
 *   <TicketsPage />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  requireAllPermissions = false,
  redirectTo = "/",
}) {
  const {
    user,
    loading,
    role,
    isAuthenticated,
    isActive,
    hasRole,
    canAny,
    canAll,
  } = useAuth();

  const normalizedRoles = useMemo(
    () => normalizeRoles(allowedRoles),
    [allowedRoles]
  );

  const normalizedPermissions = useMemo(
    () =>
      normalizePermissions(
        requiredPermissions
      ),
    [requiredPermissions]
  );

  /**
   * في حال عدم تحديد أدوار،
   * يسمح لجميع المستخدمين المسجلين.
   */
  const hasRoleAccess =
    normalizedRoles.length === 0 ||
    hasRole(normalizedRoles);

  /**
   * في حال عدم تحديد صلاحيات،
   * لا يتم تطبيق قيد صلاحيات.
   */
  const hasPermissionAccess =
    normalizedPermissions.length === 0 ||
    (requireAllPermissions
      ? canAll(normalizedPermissions)
      : canAny(normalizedPermissions));

  const isAllowed =
    isAuthenticated &&
    isActive &&
    hasRoleAccess &&
    hasPermissionAccess;

  useEffect(() => {
    if (loading) {
      return;
    }

    /**
     * المستخدم غير مسجل الدخول.
     */
    if (!isAuthenticated) {
      navigate("/login", true);
      return;
    }

    /**
     * الحساب موجود لكنه غير مفعل.
     */
    if (!isActive) {
      navigate(
        "/login?reason=inactive",
        true
      );
      return;
    }

    /**
     * المستخدم لا يملك الدور
     * أو الصلاحية المطلوبة.
     */
    if (
      !hasRoleAccess ||
      !hasPermissionAccess
    ) {
      navigate(redirectTo, true);
    }
  }, [
    loading,
    isAuthenticated,
    isActive,
    hasRoleAccess,
    hasPermissionAccess,
    redirectTo,
    role,
    user,
  ]);

  if (loading) {
    return (
      <div className="full-loader">
        <span />
        <p>جاري تحميل FixFlow…</p>
      </div>
    );
  }

  /*
   * يمنع ظهور محتوى الصفحة للحظة
   * قبل تنفيذ إعادة التوجيه.
   */
  if (!isAllowed) {
    return null;
  }

  return children;
}