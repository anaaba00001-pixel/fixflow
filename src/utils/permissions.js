import { ROLE } from "../constants/roles";

/**
 * جميع الصلاحيات المستخدمة داخل FixFlow.
 */
export const PERMISSION = Object.freeze({
  // إدارة المنصة
  PLATFORM_MANAGE: "platform:manage",
  ORGANIZATIONS_MANAGE: "organizations:manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions:manage",
  SYSTEM_LOG_READ: "system_log:read",
  SUPPORT_MANAGE: "support:manage",

  // طلبات الصيانة
  TICKETS_CREATE: "tickets:create",
  TICKETS_READ: "tickets:read",
  TICKETS_READ_ASSIGNED: "tickets:read_assigned",
  TICKETS_READ_OWN: "tickets:read_own",
  TICKETS_ASSIGN: "tickets:assign",
  TICKETS_APPROVE: "tickets:approve",
  TICKETS_WORK: "tickets:work",
  TICKETS_COMMENT: "tickets:comment",
  TICKETS_REOPEN: "tickets:reopen",
  TICKETS_RATE: "tickets:rate",

  // الأجهزة والأصول
  ASSETS_READ: "assets:read",
  ASSETS_MANAGE: "assets:manage",

  // الفروع والمواقع
  LOCATIONS_READ: "locations:read",
  LOCATIONS_MANAGE: "locations:manage",

  // المستخدمون والفنيون
  USERS_READ: "users:read",
  USERS_MANAGE: "users:manage",
  TECHNICIANS_READ: "technicians:read",

  // المخزون
  INVENTORY_READ: "inventory:read",
  INVENTORY_MANAGE: "inventory:manage",
  INVENTORY_ISSUE_PARTS: "inventory:issue_parts",
  INVENTORY_RECEIVE_PARTS: "inventory:receive_parts",
  PURCHASE_REQUESTS_MANAGE: "purchase_requests:manage",

  // التقارير
  REPORTS_READ: "reports:read",
});

/**
 * صلاحيات كل دور داخل النظام.
 */
const ROLE_PERMISSIONS = Object.freeze({
  /**
   * مدير المنصة:
   * يصل إلى جميع المنشآت وإعدادات المنصة.
   */
  [ROLE.PLATFORM_ADMIN]: Object.freeze([
    PERMISSION.PLATFORM_MANAGE,
    PERMISSION.ORGANIZATIONS_MANAGE,
    PERMISSION.SUBSCRIPTIONS_MANAGE,
    PERMISSION.SYSTEM_LOG_READ,
    PERMISSION.SUPPORT_MANAGE,
  ]),

  /**
   * مدير المنشأة:
   * يدير جميع بيانات منشأته.
   */
  [ROLE.ORGANIZATION_ADMIN]: Object.freeze([
    PERMISSION.TICKETS_CREATE,
    PERMISSION.TICKETS_READ,
    PERMISSION.TICKETS_ASSIGN,
    PERMISSION.TICKETS_APPROVE,
    PERMISSION.TICKETS_COMMENT,

    PERMISSION.ASSETS_READ,
    PERMISSION.ASSETS_MANAGE,

    PERMISSION.LOCATIONS_READ,
    PERMISSION.LOCATIONS_MANAGE,

    PERMISSION.USERS_READ,
    PERMISSION.USERS_MANAGE,
    PERMISSION.TECHNICIANS_READ,

    PERMISSION.INVENTORY_READ,
    PERMISSION.INVENTORY_MANAGE,
    PERMISSION.INVENTORY_ISSUE_PARTS,
    PERMISSION.INVENTORY_RECEIVE_PARTS,
    PERMISSION.PURCHASE_REQUESTS_MANAGE,

    PERMISSION.REPORTS_READ,
  ]),

  /**
   * مدير الفرع:
   * يرى ويدير البيانات الخاصة بالفروع المسموح له بها فقط.
   */
  [ROLE.BRANCH_MANAGER]: Object.freeze([
    PERMISSION.TICKETS_CREATE,
    PERMISSION.TICKETS_READ,
    PERMISSION.TICKETS_APPROVE,
    PERMISSION.TICKETS_COMMENT,

    PERMISSION.ASSETS_READ,
    PERMISSION.LOCATIONS_READ,

    PERMISSION.USERS_READ,
    PERMISSION.TECHNICIANS_READ,

    PERMISSION.INVENTORY_READ,
    PERMISSION.REPORTS_READ,
  ]),

  /**
   * مشرف الصيانة:
   * يفرز الطلبات ويعيّن الفنيين ويراجع الإنجاز.
   */
  [ROLE.SUPERVISOR]: Object.freeze([
    PERMISSION.TICKETS_CREATE,
    PERMISSION.TICKETS_READ,
    PERMISSION.TICKETS_ASSIGN,
    PERMISSION.TICKETS_APPROVE,
    PERMISSION.TICKETS_COMMENT,

    PERMISSION.ASSETS_READ,
    PERMISSION.LOCATIONS_READ,
    PERMISSION.TECHNICIANS_READ,
    PERMISSION.INVENTORY_READ,
    PERMISSION.REPORTS_READ,
  ]),

  /**
   * فني الصيانة:
   * يتعامل فقط مع الطلبات المسندة إليه.
   */
  [ROLE.TECHNICIAN]: Object.freeze([
    PERMISSION.TICKETS_READ_ASSIGNED,
    PERMISSION.TICKETS_WORK,
    PERMISSION.TICKETS_COMMENT,
    PERMISSION.ASSETS_READ,
    PERMISSION.INVENTORY_READ,
  ]),

  /**
   * مسؤول المخزون:
   * يدير قطع الغيار وطلبات الصرف والشراء.
   */
  [ROLE.INVENTORY_MANAGER]: Object.freeze([
    PERMISSION.TICKETS_READ,
    PERMISSION.ASSETS_READ,

    PERMISSION.INVENTORY_READ,
    PERMISSION.INVENTORY_MANAGE,
    PERMISSION.INVENTORY_ISSUE_PARTS,
    PERMISSION.INVENTORY_RECEIVE_PARTS,
    PERMISSION.PURCHASE_REQUESTS_MANAGE,

    PERMISSION.REPORTS_READ,
  ]),

  /**
   * المبلّغ المسجّل:
   * ينشئ البلاغات ويتابع بلاغاته الشخصية فقط.
   */
  [ROLE.REGISTERED_REPORTER]: Object.freeze([
    PERMISSION.TICKETS_CREATE,
    PERMISSION.TICKETS_READ_OWN,
    PERMISSION.TICKETS_COMMENT,
    PERMISSION.TICKETS_REOPEN,
    PERMISSION.TICKETS_RATE,
  ]),
});

/**
 * توحيد شكل قيمة الدور.
 */
function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

/**
 * تحويل قيمة واحدة أو مصفوفة إلى مصفوفة معرفات نظيفة.
 */
function normalizeIds(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        return (
          item.location_id ||
          item.locationId ||
          item.branch_id ||
          item.branchId ||
          item.id ||
          null
        );
      }

      return item;
    })
    .filter(Boolean)
    .map(String);
}

/**
 * إرجاع جميع المواقع أو الفروع المسموح للمستخدم بها.
 *
 * يدعم أكثر من اسم مؤقتًا حتى يتم توحيد شكل البيانات
 * القادمة من قاعدة البيانات.
 */
export function getProfileLocationIds(profile) {
  if (!profile) {
    return [];
  }

  const values = [
    profile.location_ids,
    profile.locationIds,
    profile.branch_ids,
    profile.branchIds,
    profile.location_id,
    profile.locationId,
    profile.branch_id,
    profile.branchId,
    profile.user_locations,
    profile.userLocations,
  ];

  return [...new Set(values.flatMap(normalizeIds))];
}

/**
 * إرجاع صلاحيات الدور.
 */
export function getRolePermissions(role) {
  const normalizedRole = normalizeRole(role);

  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * التحقق من امتلاك المستخدم لصلاحية معينة.
 */
export function hasPermission(role, permission) {
  if (!role || !permission) {
    return false;
  }

  return getRolePermissions(role).includes(permission);
}

/**
 * التحقق من امتلاك المستخدم واحدة على الأقل
 * من الصلاحيات المحددة.
 */
export function hasAnyPermission(role, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }

  return permissions.some((permission) =>
    hasPermission(role, permission)
  );
}

/**
 * التحقق من امتلاك المستخدم جميع الصلاحيات المحددة.
 */
export function hasAllPermissions(role, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }

  return permissions.every((permission) =>
    hasPermission(role, permission)
  );
}

/**
 * التحقق من أن حساب المستخدم فعال.
 */
export function isActiveProfile(profile) {
  return Boolean(profile && profile.is_active !== false);
}

/**
 * التحقق من إمكانية الوصول إلى منشأة.
 */
export function canAccessOrganization(
  profile,
  organizationId
) {
  if (!isActiveProfile(profile) || !organizationId) {
    return false;
  }

  const role = normalizeRole(profile.role);

  if (role === ROLE.PLATFORM_ADMIN) {
    return true;
  }

  const profileOrganizationId =
    profile.organization_id ||
    profile.organizationId ||
    null;

  return (
    Boolean(profileOrganizationId) &&
    String(profileOrganizationId) ===
      String(organizationId)
  );
}

/**
 * التحقق من إمكانية الوصول إلى فرع أو موقع.
 */
export function canAccessLocation(profile, locationId) {
  if (!isActiveProfile(profile) || !locationId) {
    return false;
  }

  const role = normalizeRole(profile.role);

  if (
    role === ROLE.PLATFORM_ADMIN ||
    role === ROLE.ORGANIZATION_ADMIN
  ) {
    return true;
  }

  const allowedLocationIds =
    getProfileLocationIds(profile);

  /*
   * مدير الفرع يجب أن تكون له فروع محددة صراحة.
   */
  if (
    role === ROLE.BRANCH_MANAGER &&
    allowedLocationIds.length === 0
  ) {
    return false;
  }

  /*
   * عدم وجود قيود مواقع للمشرف أو مسؤول المخزون
   * يعني أن وصوله على مستوى المنشأة.
   */
  if (allowedLocationIds.length === 0) {
    return true;
  }

  return allowedLocationIds.includes(
    String(locationId)
  );
}

/**
 * التحقق من أن البلاغ مملوك للمبلّغ المسجّل.
 */
export function isOwnTicket(profile, ticket) {
  if (!profile?.id || !ticket) {
    return false;
  }

  const reporterId =
    ticket.reporter_user_id ||
    ticket.reporterUserId ||
    ticket.requester_id ||
    ticket.requesterId ||
    ticket.created_by ||
    ticket.createdBy ||
    ticket.user_id ||
    ticket.userId ||
    null;

  return (
    Boolean(reporterId) &&
    String(reporterId) === String(profile.id)
  );
}

/**
 * التحقق من إمكانية الوصول إلى طلب صيانة.
 */
export function canAccessTicket(profile, ticket) {
  if (!isActiveProfile(profile) || !ticket) {
    return false;
  }

  const role = normalizeRole(profile.role);

  const ticketOrganizationId =
    ticket.organization_id ||
    ticket.organizationId ||
    null;

  /*
   * يجب التأكد من المنشأة قبل أي تحقق آخر.
   */
  if (
    ticketOrganizationId &&
    !canAccessOrganization(
      profile,
      ticketOrganizationId
    )
  ) {
    return false;
  }

  /*
   * مدير المنصة يمكنه الوصول إلى جميع الطلبات.
   */
  if (role === ROLE.PLATFORM_ADMIN) {
    return true;
  }

  /*
   * الفني يرى فقط الطلبات المسندة إليه.
   */
  if (role === ROLE.TECHNICIAN) {
    const assignedTechnicianId =
      ticket.assigned_technician_id ||
      ticket.assignedTechnicianId ||
      null;

    return (
      Boolean(profile.id) &&
      Boolean(assignedTechnicianId) &&
      String(assignedTechnicianId) ===
        String(profile.id)
    );
  }

  /*
   * المبلّغ المسجّل يرى بلاغاته فقط.
   */
  if (role === ROLE.REGISTERED_REPORTER) {
    return isOwnTicket(profile, ticket);
  }

  /*
   * مدير الفرع يقتصر على طلبات فروعه.
   */
  if (role === ROLE.BRANCH_MANAGER) {
    const ticketLocationId =
      ticket.location_id ||
      ticket.locationId ||
      ticket.branch_id ||
      ticket.branchId ||
      null;

    return (
      hasPermission(role, PERMISSION.TICKETS_READ) &&
      Boolean(ticketLocationId) &&
      canAccessLocation(profile, ticketLocationId)
    );
  }

  /*
   * بقية الأدوار تحتاج صلاحية قراءة الطلبات.
   */
  return hasPermission(
    role,
    PERMISSION.TICKETS_READ
  );
}

/**
 * التحقق من إمكانية الوصول إلى جهاز أو أصل.
 */
export function canAccessAsset(profile, asset) {
  if (!isActiveProfile(profile) || !asset) {
    return false;
  }

  const role = normalizeRole(profile.role);

  const assetOrganizationId =
    asset.organization_id ||
    asset.organizationId ||
    null;

  if (
    assetOrganizationId &&
    !canAccessOrganization(
      profile,
      assetOrganizationId
    )
  ) {
    return false;
  }

  if (role === ROLE.PLATFORM_ADMIN) {
    return true;
  }

  if (!hasPermission(role, PERMISSION.ASSETS_READ)) {
    return false;
  }

  const assetLocationId =
    asset.location_id ||
    asset.locationId ||
    asset.branch_id ||
    asset.branchId ||
    null;

  if (
    role === ROLE.BRANCH_MANAGER &&
    assetLocationId
  ) {
    return canAccessLocation(
      profile,
      assetLocationId
    );
  }

  return true;
}