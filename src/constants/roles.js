/**
 * أدوار المستخدمين الذين يملكون حسابًا داخل FixFlow.
 *
 * ملاحظة:
 * المبلّغ الزائر لا يملك حسابًا، لذلك لا يوضع ضمن ROLE.
 * يستخدم الصفحات العامة فقط بواسطة رابط QR أو رمز متابعة.
 */
export const ROLE = Object.freeze({
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  SUPERVISOR: "SUPERVISOR",
  TECHNICIAN: "TECHNICIAN",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",
  REGISTERED_REPORTER: "REGISTERED_REPORTER",
});

/**
 * المستخدمون الذين يدخلون النظام دون حساب.
 */
export const PUBLIC_USER_TYPE = Object.freeze({
  GUEST_REPORTER: "GUEST_REPORTER",
});

/**
 * الأسماء العربية التي تظهر في واجهات النظام.
 */
export const ROLE_LABELS = Object.freeze({
  [ROLE.PLATFORM_ADMIN]: "مدير المنصة",
  [ROLE.ORGANIZATION_ADMIN]: "مدير المنشأة",
  [ROLE.BRANCH_MANAGER]: "مدير الفرع",
  [ROLE.SUPERVISOR]: "مشرف الصيانة",
  [ROLE.TECHNICIAN]: "فني الصيانة",
  [ROLE.INVENTORY_MANAGER]: "مسؤول المخزون",
  [ROLE.REGISTERED_REPORTER]: "المبلّغ المسجّل",
  [PUBLIC_USER_TYPE.GUEST_REPORTER]: "المبلّغ الزائر",
});

/**
 * الأدوار الإدارية التي تستخدم لوحة تحكم سطح المكتب.
 */
export const ADMIN_ROLES = Object.freeze([
  ROLE.PLATFORM_ADMIN,
  ROLE.ORGANIZATION_ADMIN,
  ROLE.BRANCH_MANAGER,
  ROLE.SUPERVISOR,
  ROLE.INVENTORY_MANAGER,
]);

/**
 * الأدوار التي تُفضّل لها واجهة مناسبة للجوال.
 */
export const MOBILE_FIRST_ROLES = Object.freeze([
  ROLE.TECHNICIAN,
  ROLE.REGISTERED_REPORTER,
]);

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || "مستخدم";
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isMobileFirstRole(role) {
  return MOBILE_FIRST_ROLES.includes(role);
}

export function isValidAccountRole(role) {
  return Object.values(ROLE).includes(role);
}