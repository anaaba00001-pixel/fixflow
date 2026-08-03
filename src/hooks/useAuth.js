import { useCallback, useMemo } from "react";
import { useAuth as useAuthContext } from "../context/AuthContext";
import {
  ROLE,
  getRoleLabel,
} from "../constants/roles";
import {
  canAccessAsset as checkAssetAccess,
  canAccessLocation as checkLocationAccess,
  canAccessOrganization as checkOrganizationAccess,
  canAccessTicket as checkTicketAccess,
  getProfileLocationIds,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isActiveProfile,
} from "../utils/permissions";

/**
 * توحيد قيمة الدور القادمة من قاعدة البيانات.
 */
function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

/**
 * Hook موحد للوصول إلى بيانات المستخدم
 * والصلاحيات والأدوار داخل FixFlow.
 */
export function useAuth() {
  const {
    user,
    loading,
    signIn,
    signOut,
    isDemo,
  } = useAuthContext();

  const role = normalizeRole(user?.role);

  const isAuthenticated = Boolean(user);
  const isActive = isActiveProfile(user);

  const organizationId =
    user?.organization_id ||
    user?.organizationId ||
    null;

  const fullName =
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    "";

  const email = user?.email || "";

  const avatarUrl =
    user?.avatar_url ||
    user?.avatarUrl ||
    null;

  const roleLabel = getRoleLabel(role);

  /**
   * الفروع أو المواقع المسموح للمستخدم بالوصول إليها.
   */
  const locationIds = useMemo(
    () => getProfileLocationIds(user),
    [user]
  );

  /**
   * تحديد نوع المستخدم.
   */
  const isPlatformAdmin =
    role === ROLE.PLATFORM_ADMIN;

  const isOrganizationAdmin =
    role === ROLE.ORGANIZATION_ADMIN;

  const isBranchManager =
    role === ROLE.BRANCH_MANAGER;

  const isSupervisor =
    role === ROLE.SUPERVISOR;

  const isTechnician =
    role === ROLE.TECHNICIAN;

  const isInventoryManager =
    role === ROLE.INVENTORY_MANAGER;

  const isRegisteredReporter =
    role === ROLE.REGISTERED_REPORTER;

  /**
   * الأدوار التي تستخدم لوحة الإدارة.
   */
  const isAdministrativeUser =
    isPlatformAdmin ||
    isOrganizationAdmin ||
    isBranchManager ||
    isSupervisor ||
    isInventoryManager;

  /**
   * التحقق من صلاحية واحدة.
   */
  const can = useCallback(
    (permission) => {
      if (!permission || !role || !isActive) {
        return false;
      }

      return hasPermission(role, permission);
    },
    [role, isActive]
  );

  /**
   * التحقق من امتلاك واحدة على الأقل
   * من مجموعة صلاحيات.
   */
  const canAny = useCallback(
    (permissions = []) => {
      if (!role || !isActive) {
        return false;
      }

      return hasAnyPermission(role, permissions);
    },
    [role, isActive]
  );

  /**
   * التحقق من امتلاك جميع الصلاحيات.
   */
  const canAll = useCallback(
    (permissions = []) => {
      if (!role || !isActive) {
        return false;
      }

      return hasAllPermissions(role, permissions);
    },
    [role, isActive]
  );

  /**
   * التحقق من أن المستخدم يملك دورًا معينًا.
   *
   * أمثلة:
   * hasRole(ROLE.SUPERVISOR)
   *
   * hasRole(
   *   ROLE.ORGANIZATION_ADMIN,
   *   ROLE.BRANCH_MANAGER
   * )
   */
  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!role || allowedRoles.length === 0) {
        return false;
      }

      const normalizedRoles = allowedRoles
        .flat()
        .filter(Boolean)
        .map(normalizeRole);

      return normalizedRoles.includes(role);
    },
    [role]
  );

  /**
   * التحقق من الوصول إلى منشأة.
   */
  const canAccessOrganization = useCallback(
    (targetOrganizationId) => {
      return checkOrganizationAccess(
        user,
        targetOrganizationId
      );
    },
    [user]
  );

  /**
   * التحقق من الوصول إلى فرع أو موقع.
   */
  const canAccessLocation = useCallback(
    (targetLocationId) => {
      return checkLocationAccess(
        user,
        targetLocationId
      );
    },
    [user]
  );

  /**
   * التحقق من الوصول إلى طلب صيانة.
   */
  const canAccessTicket = useCallback(
    (ticket) => {
      return checkTicketAccess(user, ticket);
    },
    [user]
  );

  /**
   * التحقق من الوصول إلى جهاز أو أصل.
   */
  const canAccessAsset = useCallback(
    (asset) => {
      return checkAssetAccess(user, asset);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      // بيانات المصادقة
      user,
      loading,
      isDemo,
      signIn,
      signOut,

      // بيانات المستخدم
      role,
      roleLabel,
      fullName,
      email,
      avatarUrl,
      organizationId,
      locationIds,

      // حالة المستخدم
      isAuthenticated,
      isActive,

      // أنواع المستخدمين
      isPlatformAdmin,
      isOrganizationAdmin,
      isBranchManager,
      isSupervisor,
      isTechnician,
      isInventoryManager,
      isRegisteredReporter,
      isAdministrativeUser,

      // الصلاحيات
      can,
      canAny,
      canAll,
      hasRole,

      // الوصول إلى البيانات
      canAccessOrganization,
      canAccessLocation,
      canAccessTicket,
      canAccessAsset,
    }),
    [
      user,
      loading,
      isDemo,
      signIn,
      signOut,

      role,
      roleLabel,
      fullName,
      email,
      avatarUrl,
      organizationId,
      locationIds,

      isAuthenticated,
      isActive,

      isPlatformAdmin,
      isOrganizationAdmin,
      isBranchManager,
      isSupervisor,
      isTechnician,
      isInventoryManager,
      isRegisteredReporter,
      isAdministrativeUser,

      can,
      canAny,
      canAll,
      hasRole,

      canAccessOrganization,
      canAccessLocation,
      canAccessTicket,
      canAccessAsset,
    ]
  );

  return value;
}

export default useAuth;