/**
 * أنواع البيانات المشتركة في مشروع FixFlow.
 *
 * المشروع يستخدم JavaScript، لذلك نستخدم JSDoc
 * لتوفير اقتراحات الأنواع داخل VS Code واكتشاف الأخطاء.
 */

/**
 * @typedef {string} EntityId
 */

/**
 * @typedef {string} ISODateString
 */

/**
 * @typedef {
 *   | "PLATFORM_ADMIN"
 *   | "ORGANIZATION_ADMIN"
 *   | "SUPERVISOR"
 *   | "TECHNICIAN"
 * } UserRole
 */

/**
 * @typedef {
 *   | "NEW"
 *   | "ASSIGNED"
 *   | "ACCEPTED"
 *   | "IN_PROGRESS"
 *   | "WAITING_PARTS"
 *   | "PENDING_APPROVAL"
 *   | "REOPENED"
 *   | "CLOSED"
 *   | "CANCELLED"
 * } TicketStatus
 */

/**
 * @typedef {
 *   | "LOW"
 *   | "MEDIUM"
 *   | "HIGH"
 *   | "EMERGENCY"
 * } TicketPriority
 */

/**
 * @typedef {
 *   | "AVAILABLE"
 *   | "BUSY"
 *   | "UNAVAILABLE"
 * } TechnicianAvailability
 */

/**
 * @typedef {
 *   | "TICKET_CREATED"
 *   | "EMERGENCY_TICKET"
 *   | "TECHNICIAN_ASSIGNED"
 *   | "TICKET_ACCEPTED"
 *   | "TICKET_REJECTED"
 *   | "WORK_STARTED"
 *   | "WAITING_PARTS"
 *   | "WORK_RESUMED"
 *   | "TICKET_OVERDUE"
 *   | "REPAIR_COMPLETED"
 *   | "APPROVAL_REQUIRED"
 *   | "REPAIR_REJECTED"
 *   | "TICKET_CLOSED"
 *   | "TICKET_REOPENED"
 *   | "TICKET_CANCELLED"
 *   | "SUBSCRIPTION_EXPIRING"
 *   | "SUBSCRIPTION_EXPIRED"
 * } NotificationType
 */

/**
 * @typedef {"IN_APP" | "EMAIL"} NotificationChannel
 */

/**
 * @typedef {"PENDING" | "SENT" | "FAILED" | "CANCELLED"} NotificationStatus
 */

/**
 * @typedef {Object} Organization
 * @property {EntityId} id
 * @property {string} name
 * @property {"ACTIVE" | "INACTIVE" | "SUSPENDED"} status
 * @property {string} [timezone]
 * @property {ISODateString} [created_at]
 * @property {ISODateString} [updated_at]
 */

/**
 * @typedef {Object} UserProfile
 * @property {EntityId} id
 * @property {EntityId|null} organization_id
 * @property {string} full_name
 * @property {string} email
 * @property {string|null} [phone]
 * @property {UserRole} role
 * @property {boolean} is_active
 * @property {string|null} [specialization]
 * @property {TechnicianAvailability} [availability_status]
 * @property {number} [open_tickets_count]
 * @property {number} [closed_tickets_count]
 * @property {number} [overdue_tickets_count]
 * @property {ISODateString} [created_at]
 * @property {ISODateString} [updated_at]
 */

/**
 * @typedef {Object} Location
 * @property {EntityId} id
 * @property {EntityId} organization_id
 * @property {string} name
 * @property {string|null} [address]
 * @property {string|null} [description]
 * @property {boolean} is_active
 * @property {number} [assets_count]
 * @property {number} [users_count]
 * @property {number} [tickets_count]
 * @property {number} [open_tickets_count]
 * @property {ISODateString} [created_at]
 * @property {ISODateString} [updated_at]
 */

/**
 * @typedef {Object} Category
 * @property {EntityId} id
 * @property {EntityId} organization_id
 * @property {string} name
 * @property {string|null} [description]
 * @property {boolean} is_active
 * @property {ISODateString} [created_at]
 * @property {ISODateString} [updated_at]
 */

/**
 * @typedef {Object} Asset
 * @property {EntityId} id
 * @property {EntityId} organization_id
 * @property {EntityId} location_id
 * @property {EntityId|null} [category_id]
 * @property {string} name
 * @property {string|null} [asset_number]
 * @property {string|null} [serial_number]
 * @property {string|null} [manufacturer]
 * @property {string|null} [model]
 * @property {string|null} [image_url]
 * @property {boolean} is_active
 * @property {Location} [locations]
 * @property {Category} [categories]
 * @property {ISODateString|null} [purchase_date]
 * @property {ISODateString|null} [warranty_end_date]
 * @property {ISODateString|null} [last_maintenance_date]
 * @property {ISODateString} [created_at]
 * @property {ISODateString} [updated_at]
 */

/**
 * @typedef {Object} TicketHistory
 * @property {EntityId} id
 * @property {EntityId} ticket_id
 * @property {string} action
 * @property {EntityId|null} [actor_id]
 * @property {string|null} [actor_name]
 * @property {TicketStatus|null} [old_status]
 * @property {TicketStatus|null} [new_status]
 * @property {string|null} [note]
 * @property {ISODateString} created_at
 */

/**
 * @typedef {Object} TicketAttachment
 * @property {EntityId} id
 * @property {EntityId} ticket_id
 * @property {string} attachment_type
 * @property {string} file_name
 * @property {string} file_path
 * @property {string|null} [public_url]
 * @property {string|null} [mime_type]
 * @property {number|null} [file_size]
 * @property {EntityId|null} [uploaded_by]
 * @property {ISODateString} created_at
 */

/**
 * @typedef {Object} Ticket
 * @property {EntityId} id
 * @property {string} ticket_number
 * @property {EntityId} organization_id
 * @property {EntityId} location_id
 * @property {EntityId|null} [category_id]
 * @property {EntityId|null} [asset_id]
 * @property {EntityId|null} [assigned_technician_id]
 * @property {string} title
 * @property {string} description
 * @property {TicketStatus} status
 * @property {TicketPriority} priority
 * @property {string|null} [reporter_name]
 * @property {string|null} [reporter_phone]
 * @property {string|null} [reporter_email]
 * @property {string|null} [resolution_summary]
 * @property {boolean} [is_overdue]
 * @property {Location} [locations]
 * @property {Asset} [assets]
 * @property {Category} [categories]
 * @property {UserProfile} [profiles]
 * @property {TicketHistory[]} [ticket_history]
 * @property {TicketAttachment[]} [ticket_attachments]
 * @property {ISODateString} created_at
 * @property {ISODateString} updated_at
 * @property {ISODateString|null} [due_at]
 * @property {ISODateString|null} [assigned_at]
 * @property {ISODateString|null} [accepted_at]
 * @property {ISODateString|null} [started_at]
 * @property {ISODateString|null} [completed_at]
 * @property {ISODateString|null} [closed_at]
 */

/**
 * @typedef {Object} Notification
 * @property {EntityId} id
 * @property {EntityId} organization_id
 * @property {EntityId|null} user_id
 * @property {EntityId|null} [ticket_id]
 * @property {string|null} [recipient_email]
 * @property {NotificationType} type
 * @property {string} title
 * @property {string} message
 * @property {NotificationChannel} channel
 * @property {NotificationStatus} status
 * @property {number} retry_count
 * @property {ISODateString|null} [read_at]
 * @property {ISODateString|null} [sent_at]
 * @property {ISODateString|null} [failed_at]
 * @property {ISODateString} created_at
 */

/**
 * @typedef {Object} DashboardStatistics
 * @property {number} totalTickets
 * @property {number} openTickets
 * @property {number} newTickets
 * @property {number} assignedTickets
 * @property {number} inProgressTickets
 * @property {number} pendingApprovalTickets
 * @property {number} closedTickets
 * @property {number} cancelledTickets
 * @property {number} overdueTickets
 * @property {number} emergencyTickets
 * @property {number} unassignedTickets
 * @property {number} completionRate
 * @property {number} overdueRate
 * @property {number} averageResponseMinutes
 * @property {number} averageRepairMinutes
 */

/**
 * @template T
 * @typedef {Object} ServiceResult
 * @property {boolean} success
 * @property {T|null} data
 * @property {string|null} error
 */

/**
 * @typedef {Object} TicketFilters
 * @property {string} [search]
 * @property {TicketStatus|string} [status]
 * @property {TicketStatus[]} [statuses]
 * @property {TicketPriority|string} [priority]
 * @property {EntityId} [organizationId]
 * @property {EntityId} [locationId]
 * @property {EntityId} [categoryId]
 * @property {EntityId} [assetId]
 * @property {EntityId} [technicianId]
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {boolean} [openOnly]
 * @property {boolean} [overdueOnly]
 * @property {boolean} [emergencyOnly]
 * @property {number} [limit]
 */

export const USER_ROLE_VALUES = Object.freeze([
  "PLATFORM_ADMIN",
  "ORGANIZATION_ADMIN",
  "SUPERVISOR",
  "TECHNICIAN",
]);

export const TICKET_STATUS_VALUES = Object.freeze([
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
  "CLOSED",
  "CANCELLED",
]);

export const TICKET_PRIORITY_VALUES = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
  "EMERGENCY",
]);

export const TECHNICIAN_AVAILABILITY_VALUES =
  Object.freeze([
    "AVAILABLE",
    "BUSY",
    "UNAVAILABLE",
  ]);

export const NOTIFICATION_CHANNEL_VALUES =
  Object.freeze([
    "IN_APP",
    "EMAIL",
  ]);

export const NOTIFICATION_STATUS_VALUES =
  Object.freeze([
    "PENDING",
    "SENT",
    "FAILED",
    "CANCELLED",
  ]);

function normalizeEnumValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * @param {unknown} value
 * @returns {value is UserRole}
 */
export function isUserRole(value) {
  return USER_ROLE_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is TicketStatus}
 */
export function isTicketStatus(value) {
  return TICKET_STATUS_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is TicketPriority}
 */
export function isTicketPriority(value) {
  return TICKET_PRIORITY_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is TechnicianAvailability}
 */
export function isTechnicianAvailability(value) {
  return TECHNICIAN_AVAILABILITY_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is NotificationChannel}
 */
export function isNotificationChannel(value) {
  return NOTIFICATION_CHANNEL_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is NotificationStatus}
 */
export function isNotificationStatus(value) {
  return NOTIFICATION_STATUS_VALUES.includes(
    normalizeEnumValue(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEntityId(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDate(value) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(
    new Date(String(value)).getTime()
  );
}

/**
 * @param {unknown} value
 * @returns {TicketStatus|string}
 */
export function normalizeTicketStatus(value) {
  return normalizeEnumValue(value);
}

/**
 * @param {unknown} value
 * @returns {TicketPriority|string}
 */
export function normalizeTicketPriority(value) {
  return normalizeEnumValue(value);
}

/**
 * @param {unknown} value
 * @returns {UserRole|string}
 */
export function normalizeUserRole(value) {
  return normalizeEnumValue(value);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
}

/**
 * @returns {TicketFilters}
 */
export function createDefaultTicketFilters() {
  return {
    search: "",
    status: "",
    priority: "",
    organizationId: "",
    locationId: "",
    categoryId: "",
    assetId: "",
    technicianId: "",
    dateFrom: "",
    dateTo: "",
    openOnly: false,
    overdueOnly: false,
    emergencyOnly: false,
    limit: 500,
  };
}