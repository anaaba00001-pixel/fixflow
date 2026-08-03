import { ROLE } from "../constants/roles";
import { requireSupabase } from "../lib/supabase";

const BASIC_USER_SELECT = `
  id,
  organization_id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
`;

const EXTENDED_USER_SELECT = `
  id,
  organization_id,
  full_name,
  email,
  phone,
  role,
  specialization,
  availability_status,
  is_active,
  created_at,
  updated_at
`;

const VALID_ROLES = Object.values(ROLE).filter(Boolean);

const LOCATION_REQUIRED_ROLES = [
  ROLE.BRANCH_MANAGER,
  ROLE.SUPERVISOR,
  ROLE.TECHNICIAN,
].filter(Boolean);

const MANAGER_ROLES = [
  ROLE.ORGANIZATION_ADMIN,
  ROLE.BRANCH_MANAGER,
  ROLE.SUPERVISOR,
].filter(Boolean);

const OPEN_TICKET_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

const VALID_AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "BUSY",
  "OFF_DUTY",
];

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ==================================================
   تنظيف القيم
================================================== */

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  return normalizedValue || null;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeBoolean(
  value,
  fallback = true
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    const normalizedValue =
      value.trim().toLowerCase();

    if (
      ["false", "0", "no"].includes(
        normalizedValue
      )
    ) {
      return false;
    }

    if (
      ["true", "1", "yes"].includes(
        normalizedValue
      )
    ) {
      return true;
    }
  }

  return Boolean(value);
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeLocationIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => {
          if (
            typeof item === "string"
          ) {
            return item;
          }

          return (
            item?.location_id ||
            item?.locationId ||
            item?.locations?.id ||
            item?.location?.id ||
            item?.id ||
            null
          );
        })
        .filter(Boolean)
        .map(String)
    ),
  ];
}

function normalizeUserPayload(
  payload = {}
) {
  const role = normalizeRole(
    payload.role
  );

  return {
    id:
      payload.id ||
      payload.userId ||
      payload.user_id ||
      null,

    organizationId:
      payload.organizationId ||
      payload.organization_id ||
      null,

    fullName: cleanString(
      payload.fullName ||
        payload.full_name ||
        payload.name
    ),

    email: normalizeEmail(
      payload.email
    ),

    phone: cleanString(
      payload.phone
    ),

    role,

    specialization:
      role === ROLE.TECHNICIAN
        ? cleanString(
            payload.specialization
          )
        : null,

    availabilityStatus:
      role === ROLE.TECHNICIAN
        ? String(
            payload.availabilityStatus ||
              payload.availability_status ||
              "AVAILABLE"
          )
            .trim()
            .toUpperCase()
        : "AVAILABLE",

    locationIds:
      normalizeLocationIds(
        payload.locationIds ||
          payload.location_ids ||
          payload.user_locations ||
          payload.locations ||
          []
      ),

    isActive:
      normalizeBoolean(
        payload.isActive ??
          payload.is_active,
        true
      ),

    sendInviteNow:
      normalizeBoolean(
        payload.sendInviteNow ??
          payload.send_invite_now,
        false
      ),
  };
}

/* ==================================================
   التحقق من البيانات
================================================== */

function validateUserPayload(
  payload,
  {
    requireId = false,
    requireOrganization = true,
  } = {}
) {
  if (
    requireId &&
    !payload.id
  ) {
    throw new Error(
      "معرّف حساب المستخدم مطلوب."
    );
  }

  if (
    !payload.fullName ||
    payload.fullName.length < 2
  ) {
    throw new Error(
      "اسم المستخدم يجب ألا يقل عن حرفين."
    );
  }

  if (
    payload.fullName.length > 150
  ) {
    throw new Error(
      "اسم المستخدم يجب ألا يتجاوز 150 حرفًا."
    );
  }

  if (
    !payload.email ||
    !EMAIL_PATTERN.test(
      payload.email
    )
  ) {
    throw new Error(
      "صيغة البريد الإلكتروني غير صحيحة."
    );
  }

  if (
    payload.phone &&
    payload.phone.length > 30
  ) {
    throw new Error(
      "رقم الجوال يجب ألا يتجاوز 30 حرفًا."
    );
  }

  if (
    !VALID_ROLES.includes(
      payload.role
    )
  ) {
    throw new Error(
      "دور المستخدم غير صحيح."
    );
  }

  if (
    payload.role ===
      ROLE.PLATFORM_ADMIN &&
    payload.organizationId
  ) {
    throw new Error(
      "مدير المنصة لا يجب أن يرتبط بمنشأة."
    );
  }

  if (
    requireOrganization &&
    payload.role !==
      ROLE.PLATFORM_ADMIN &&
    !payload.organizationId
  ) {
    throw new Error(
      "يجب ربط المستخدم بمنشأة."
    );
  }

  if (
    LOCATION_REQUIRED_ROLES.includes(
      payload.role
    ) &&
    payload.locationIds.length === 0
  ) {
    throw new Error(
      "يجب ربط المستخدم بفرع واحد على الأقل."
    );
  }

  if (
    payload.role ===
      ROLE.BRANCH_MANAGER &&
    payload.locationIds.length !== 1
  ) {
    throw new Error(
      "يجب ربط مدير الفرع بفرع واحد فقط."
    );
  }

  if (
    payload.role ===
      ROLE.TECHNICIAN &&
    !payload.specialization
  ) {
    throw new Error(
      "تخصص الفني مطلوب."
    );
  }

  if (
    payload.role ===
      ROLE.TECHNICIAN &&
    !VALID_AVAILABILITY_STATUSES.includes(
      payload.availabilityStatus
    )
  ) {
    throw new Error(
      "حالة توفر الفني غير صحيحة."
    );
  }
}

/* ==================================================
   معالجة أخطاء قاعدة البيانات
================================================== */

function isMissingExtendedColumnError(
  error
) {
  const message = String(
    error?.message ||
      error?.details ||
      error?.hint ||
      ""
  ).toLowerCase();

  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes(
      "specialization"
    ) ||
    message.includes(
      "availability_status"
    )
  );
}

function isMissingUserLocationsError(
  error
) {
  const message = String(
    error?.message ||
      error?.details ||
      error?.hint ||
      ""
  ).toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST200" ||
    error?.code === "PGRST204" ||
    message.includes(
      "user_locations"
    ) ||
    message.includes("user_id") ||
    message.includes(
      "profile_id"
    )
  );
}

function enhanceUserError(error) {
  const message = String(
    error?.message ||
      error?.details ||
      error?.hint ||
      ""
  ).toLowerCase();

  if (
    error?.code === "PGRST116" ||
    message.includes("no rows")
  ) {
    return new Error(
      "لم يتم العثور على المستخدم."
    );
  }

  if (
    error?.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return new Error(
      "يوجد مستخدم مسجل بهذا البريد الإلكتروني."
    );
  }

  if (
    error?.code === "23503" ||
    message.includes(
      "foreign key"
    )
  ) {
    return new Error(
      "تعذر ربط الحساب. يجب أن يكون المستخدم موجودًا في نظام تسجيل الدخول."
    );
  }

  if (
    error?.code === "42501" ||
    message.includes(
      "permission"
    ) ||
    message.includes(
      "row-level security"
    ) ||
    message.includes("rls")
  ) {
    return new Error(
      "لا تملكين صلاحية إدارة المستخدمين."
    );
  }

  if (
    message.includes(
      "failed to fetch"
    ) ||
    message.includes("network")
  ) {
    return new Error(
      "تعذر الاتصال بالخادم. تحققي من اتصال الإنترنت."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "حدث خطأ أثناء معالجة بيانات المستخدم."
      );
}

/* ==================================================
   المستخدم الحالي
================================================== */

async function getCurrentUserId() {
  const { data, error } =
    await requireSupabase().auth.getUser();

  if (error) {
    throw enhanceUserError(error);
  }

  return data?.user?.id || null;
}

/* ==================================================
   تنفيذ استعلام profiles
================================================== */

async function runProfilesQuery(
  buildQuery
) {
  let result =
    await buildQuery(
      EXTENDED_USER_SELECT
    );

  if (
    result.error &&
    isMissingExtendedColumnError(
      result.error
    )
  ) {
    result =
      await buildQuery(
        BASIC_USER_SELECT
      );
  }

  return result;
}

/* ==================================================
   ربط المستخدمين بالفروع
================================================== */

async function loadUserLocations(
  users
) {
  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return users || [];
  }

  const userIds = users
    .map((user) => user.id)
    .filter(Boolean);

  if (userIds.length === 0) {
    return users;
  }

  let foreignKey = "user_id";

  let result =
    await requireSupabase()
      .from("user_locations")
      .select(
        `
          user_id,
          location_id,
          locations (
            id,
            name
          )
        `
      )
      .in(
        "user_id",
        userIds
      );

  if (
    result.error &&
    isMissingUserLocationsError(
      result.error
    )
  ) {
    foreignKey = "profile_id";

    result =
      await requireSupabase()
        .from(
          "user_locations"
        )
        .select(
          `
            profile_id,
            location_id,
            locations (
              id,
              name
            )
          `
        )
        .in(
          "profile_id",
          userIds
        );
  }

  if (result.error) {
    if (
      isMissingUserLocationsError(
        result.error
      )
    ) {
      return users.map(
        (user) => ({
          ...user,
          location_ids: [],
          user_locations: [],
        })
      );
    }

    throw enhanceUserError(
      result.error
    );
  }

  const rows = result.data || [];

  return users.map((user) => {
    const userRows =
      rows.filter(
        (row) =>
          String(
            row[foreignKey] ||
              ""
          ) ===
          String(user.id)
      );

    return {
      ...user,

      location_ids:
        userRows
          .map(
            (row) =>
              row.location_id
          )
          .filter(Boolean),

      user_locations:
        userRows,
    };
  });
}

async function syncUserLocations(
  userId,
  locationIds = []
) {
  const normalizedIds =
    normalizeLocationIds(
      locationIds
    );

  async function syncUsingKey(
    foreignKey
  ) {
    const deleteResult =
      await requireSupabase()
        .from(
          "user_locations"
        )
        .delete()
        .eq(
          foreignKey,
          userId
        );

    if (deleteResult.error) {
      return deleteResult;
    }

    if (
      normalizedIds.length === 0
    ) {
      return {
        data: [],
        error: null,
      };
    }

    return requireSupabase()
      .from("user_locations")
      .insert(
        normalizedIds.map(
          (locationId) => ({
            [foreignKey]:
              userId,

            location_id:
              locationId,
          })
        )
      );
  }

  let result =
    await syncUsingKey(
      "user_id"
    );

  if (
    result.error &&
    isMissingUserLocationsError(
      result.error
    )
  ) {
    result =
      await syncUsingKey(
        "profile_id"
      );
  }

  if (result.error) {
    if (
      isMissingUserLocationsError(
        result.error
      )
    ) {
      if (
        normalizedIds.length === 0
      ) {
        return;
      }

      throw new Error(
        "جدول ربط المستخدمين بالفروع غير موجود. طبّقي ترحيل الأدوار الموسعة أولًا."
      );
    }

    throw enhanceUserError(
      result.error
    );
  }
}

/* ==================================================
   حساب مهام الفنيين
================================================== */

async function attachTechnicianWorkload(
  users
) {
  const technicians =
    users.filter(
      (user) =>
        user.role ===
        ROLE.TECHNICIAN
    );

  if (
    technicians.length === 0
  ) {
    return users;
  }

  const technicianIds =
    technicians.map(
      (technician) =>
        technician.id
    );

  const { data, error } =
    await requireSupabase()
      .from("tickets")
      .select(
        `
          id,
          assigned_technician_id,
          status,
          priority,
          due_at,
          is_overdue
        `
      )
      .in(
        "assigned_technician_id",
        technicianIds
      );

  if (error) {
    return users;
  }

  const tickets = data || [];

  return users.map((user) => {
    if (
      user.role !==
      ROLE.TECHNICIAN
    ) {
      return user;
    }

    const assignedTickets =
      tickets.filter(
        (ticket) =>
          String(
            ticket
              .assigned_technician_id
          ) ===
          String(user.id)
      );

    const openTickets =
      assignedTickets.filter(
        (ticket) =>
          OPEN_TICKET_STATUSES.includes(
            ticket.status
          )
      );

    const overdueTickets =
      openTickets.filter(
        (ticket) => {
          if (
            ticket.is_overdue ===
            true
          ) {
            return true;
          }

          if (
            !ticket.due_at
          ) {
            return false;
          }

          const dueTimestamp =
            new Date(
              ticket.due_at
            ).getTime();

          return (
            Number.isFinite(
              dueTimestamp
            ) &&
            dueTimestamp <
              Date.now()
          );
        }
      );

    return {
      ...user,

      total_tickets_count:
        assignedTickets.length,

      open_tickets_count:
        openTickets.length,

      closed_tickets_count:
        assignedTickets.filter(
          (ticket) =>
            ticket.status ===
            "CLOSED"
        ).length,

      overdue_tickets_count:
        overdueTickets.length,

      emergency_tickets_count:
        openTickets.filter(
          (ticket) =>
            ticket.priority ===
            "EMERGENCY"
        ).length,
    };
  });
}

/* ==================================================
   جلب مستخدم دون أعباء العمل
================================================== */

async function getUserWithoutWorkload(
  userId
) {
  const result =
    await runProfilesQuery(
      (selectValue) =>
        requireSupabase()
          .from("profiles")
          .select(selectValue)
          .eq("id", userId)
          .single()
    );

  if (result.error) {
    throw enhanceUserError(
      result.error
    );
  }

  const [userWithLocations] =
    await loadUserLocations([
      result.data,
    ]);

  return (
    userWithLocations ||
    result.data
  );
}

/* ==================================================
   قائمة المستخدمين
================================================== */

export async function listUsers(
  filters = {}
) {
  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  const role = normalizeRole(
    filters.role
  );

  const activeFilter =
    filters.isActive ??
    filters.is_active ??
    filters.active;

  const search =
    normalizeSearchValue(
      filters.search
    );

  const limit = Math.min(
    Math.max(
      Number(filters.limit) ||
        500,
      1
    ),
    1000
  );

  const result =
    await runProfilesQuery(
      (selectValue) => {
        let query =
          requireSupabase()
            .from("profiles")
            .select(
              selectValue
            )
            .order(
              "full_name",
              {
                ascending: true,
              }
            );

        if (
          organizationId
        ) {
          query = query.eq(
            "organization_id",
            organizationId
          );
        }

        if (role) {
          if (
            !VALID_ROLES.includes(
              role
            )
          ) {
            throw new Error(
              "دور المستخدم المحدد غير صحيح."
            );
          }

          query = query.eq(
            "role",
            role
          );
        }

        if (
          Array.isArray(
            filters.roles
          ) &&
          filters.roles.length > 0
        ) {
          const roles =
            filters.roles
              .map(normalizeRole)
              .filter(
                (item) =>
                  VALID_ROLES.includes(
                    item
                  )
              );

          if (
            roles.length > 0
          ) {
            query = query.in(
              "role",
              roles
            );
          }
        }

        if (
          activeFilter !==
            undefined &&
          activeFilter !== ""
        ) {
          query = query.eq(
            "is_active",
            normalizeBoolean(
              activeFilter
            )
          );
        }

        if (search) {
          query = query.or(
            [
              `full_name.ilike.%${search}%`,
              `email.ilike.%${search}%`,
              `phone.ilike.%${search}%`,
            ].join(",")
          );
        }

        return query.limit(
          limit
        );
      }
    );

  if (result.error) {
    throw enhanceUserError(
      result.error
    );
  }

  let users =
    await loadUserLocations(
      result.data || []
    );

  if (
    filters.includeWorkload !==
    false
  ) {
    users =
      await attachTechnicianWorkload(
        users
      );
  }

  return users;
}

/* ==================================================
   مستخدم واحد
================================================== */

export async function getUser(
  userId,
  options = {}
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب."
    );
  }

  const user =
    await getUserWithoutWorkload(
      userId
    );

  if (
    options.includeWorkload ===
    false
  ) {
    return user;
  }

  const [userWithWorkload] =
    await attachTechnicianWorkload([
      user,
    ]);

  return (
    userWithWorkload ||
    user
  );
}

/* ==================================================
   إنشاء ملف مستخدم مباشرة
================================================== */

async function insertProfileDirectly(
  payload
) {
  if (!payload.id) {
    throw new Error(
      "تعذر إنشاء حساب تسجيل الدخول من الواجهة مباشرة. يلزم نشر دالة manage-user في Supabase."
    );
  }

  const extendedInsert = {
    id: payload.id,

    organization_id:
      payload.role ===
      ROLE.PLATFORM_ADMIN
        ? null
        : payload.organizationId,

    full_name:
      payload.fullName,

    email: payload.email,
    phone: payload.phone,
    role: payload.role,

    specialization:
      payload.specialization,

    availability_status:
      payload.availabilityStatus,

    is_active:
      payload.isActive,
  };

  let result =
    await requireSupabase()
      .from("profiles")
      .insert(
        extendedInsert
      )
      .select(
        EXTENDED_USER_SELECT
      )
      .single();

  if (
    result.error &&
    isMissingExtendedColumnError(
      result.error
    )
  ) {
    const {
      specialization,
      availability_status,
      ...basicInsert
    } = extendedInsert;

    void specialization;
    void availability_status;

    result =
      await requireSupabase()
        .from("profiles")
        .insert(
          basicInsert
        )
        .select(
          BASIC_USER_SELECT
        )
        .single();
  }

  if (result.error) {
    throw enhanceUserError(
      result.error
    );
  }

  return result.data;
}

/* ==================================================
   إنشاء مستخدم
================================================== */

export async function createUser(
  formPayload
) {
  const payload =
    normalizeUserPayload(
      formPayload
    );

  validateUserPayload(
    payload,
    {
      requireId: false,
      requireOrganization: true,
    }
  );

  let createdUser = null;

  const { data, error } =
    await requireSupabase()
      .functions.invoke(
        "manage-user",
        {
          body: {
            action: "create",

            user: {
              organizationId:
                payload.role ===
                ROLE.PLATFORM_ADMIN
                  ? null
                  : payload.organizationId,

              fullName:
                payload.fullName,

              email:
                payload.email,

              phone:
                payload.phone,

              role:
                payload.role,

              specialization:
                payload.specialization,

              availabilityStatus:
                payload.availabilityStatus,

              isActive:
                payload.isActive,

              sendInviteNow:
                payload.sendInviteNow,
            },
          },
        }
      );

  if (!error) {
    createdUser =
      data?.user ||
      data?.profile ||
      data?.data?.user ||
      data?.data?.profile ||
      data;
  } else if (payload.id) {
    createdUser =
      await insertProfileDirectly(
        payload
      );
  } else {
    const message = String(
      error.message || ""
    ).toLowerCase();

    if (
      message.includes(
        "not found"
      ) ||
      message.includes("404") ||
      message.includes(
        "failed to send"
      )
    ) {
      throw new Error(
        "دالة إنشاء المستخدم manage-user غير منشورة في Supabase بعد. سنضيفها في خطوة الخادم."
      );
    }

    throw enhanceUserError(
      error
    );
  }

  const createdUserId =
    createdUser?.id ||
    createdUser?.user_id ||
    createdUser?.user?.id ||
    null;

  if (!createdUserId) {
    throw new Error(
      "تم إنشاء الحساب دون إرجاع معرّف المستخدم."
    );
  }

  await syncUserLocations(
    createdUserId,
    payload.locationIds
  );

  return getUser(
    createdUserId
  );
}

/* ==================================================
   تحديث المستخدم
================================================== */

export async function updateUser(
  userId,
  formPayload = {}
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب."
    );
  }

  const currentUser =
    await getUserWithoutWorkload(
      userId
    );

  const payload =
    normalizeUserPayload({
      ...currentUser,
      ...formPayload,

      id: userId,

      locationIds:
        formPayload.locationIds ??
        formPayload.location_ids ??
        currentUser.location_ids ??
        [],
    });

  validateUserPayload(
    payload,
    {
      requireId: true,
      requireOrganization: true,
    }
  );

  const authenticatedUserId =
    await getCurrentUserId();

  if (
    String(
      authenticatedUserId
    ) === String(userId) &&
    payload.isActive === false
  ) {
    throw new Error(
      "لا يمكنك تعطيل حسابك الحالي."
    );
  }

  if (
    String(
      authenticatedUserId
    ) === String(userId) &&
    payload.role !==
      currentUser.role
  ) {
    throw new Error(
      "لا يمكنك تغيير دور حسابك الحالي."
    );
  }

  const extendedUpdate = {
    organization_id:
      payload.role ===
      ROLE.PLATFORM_ADMIN
        ? null
        : payload.organizationId,

    full_name:
      payload.fullName,

    email:
      payload.email,

    phone:
      payload.phone,

    role:
      payload.role,

    specialization:
      payload.specialization,

    availability_status:
      payload.availabilityStatus,

    is_active:
      payload.isActive,

    updated_at:
      new Date().toISOString(),
  };

  let result =
    await requireSupabase()
      .from("profiles")
      .update(
        extendedUpdate
      )
      .eq("id", userId)
      .select(
        EXTENDED_USER_SELECT
      )
      .single();

  if (
    result.error &&
    isMissingExtendedColumnError(
      result.error
    )
  ) {
    const {
      specialization,
      availability_status,
      ...basicUpdate
    } = extendedUpdate;

    void specialization;
    void availability_status;

    result =
      await requireSupabase()
        .from("profiles")
        .update(
          basicUpdate
        )
        .eq("id", userId)
        .select(
          BASIC_USER_SELECT
        )
        .single();
  }

  if (result.error) {
    throw enhanceUserError(
      result.error
    );
  }

  await syncUserLocations(
    userId,
    payload.locationIds
  );

  return getUser(userId);
}

/* ==================================================
   تحديث الدور
================================================== */

export async function updateUserRole(
  userId,
  role,
  options = {}
) {
  const currentUser =
    await getUserWithoutWorkload(
      userId
    );

  return updateUser(
    userId,
    {
      ...currentUser,
      ...options,
      role,

      organizationId:
        options.organizationId ||
        options.organization_id ||
        currentUser.organization_id,

      locationIds:
        options.locationIds ||
        options.location_ids ||
        currentUser.location_ids ||
        [],
    }
  );
}

/* ==================================================
   تفعيل وتعطيل المستخدم
================================================== */

export async function setUserStatus(
  userId,
  isActive
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب."
    );
  }

  const authenticatedUserId =
    await getCurrentUserId();

  const nextStatus =
    normalizeBoolean(
      isActive,
      false
    );

  if (
    String(
      authenticatedUserId
    ) === String(userId) &&
    !nextStatus
  ) {
    throw new Error(
      "لا يمكنك تعطيل حسابك الحالي."
    );
  }

  const result =
    await requireSupabase()
      .from("profiles")
      .update({
        is_active:
          nextStatus,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        BASIC_USER_SELECT
      )
      .single();

  if (result.error) {
    throw enhanceUserError(
      result.error
    );
  }

  return result.data;
}

export async function toggleUserStatus(
  user
) {
  if (!user?.id) {
    throw new Error(
      "بيانات المستخدم غير مكتملة."
    );
  }

  const currentStatus =
    user.is_active ??
    user.isActive ??
    true;

  return setUserStatus(
    user.id,
    !currentStatus
  );
}

/* ==================================================
   الفنيون
================================================== */

export async function listTechnicians(
  filters = {}
) {
  return listUsers({
    ...filters,
    role: ROLE.TECHNICIAN,
  });
}

export async function listAvailableTechnicians(
  filters = {}
) {
  const technicians =
    await listTechnicians({
      ...filters,
      isActive: true,
      includeWorkload: true,
    });

  const maximumOpenTickets =
    Number(
      filters.maximumOpenTickets
    ) >= 0
      ? Number(
          filters.maximumOpenTickets
        )
      : null;

  return technicians
    .filter((technician) => {
      const availability =
        technician
          .availability_status ||
        technician
          .availabilityStatus ||
        "AVAILABLE";

      if (
        availability ===
        "OFF_DUTY"
      ) {
        return false;
      }

      if (
        maximumOpenTickets ===
        null
      ) {
        return true;
      }

      return (
        Number(
          technician
            .open_tickets_count ||
            0
        ) <=
        maximumOpenTickets
      );
    })
    .sort(
      (
        firstTechnician,
        secondTechnician
      ) =>
        Number(
          firstTechnician
            .open_tickets_count ||
            0
        ) -
        Number(
          secondTechnician
            .open_tickets_count ||
            0
        )
    );
}

/* ==================================================
   المديرون
================================================== */

export async function listManagers(
  filters = {}
) {
  return listUsers({
    ...filters,
    roles: MANAGER_ROLES,
    includeWorkload: false,
  });
}

/* ==================================================
   إحصاءات المستخدمين
================================================== */

export async function getUserStatistics(
  organizationId
) {
  const users =
    await listUsers({
      organizationId,
      includeWorkload: true,
    });

  return {
    total:
      users.length,

    active:
      users.filter(
        (user) =>
          user.is_active
      ).length,

    inactive:
      users.filter(
        (user) =>
          !user.is_active
      ).length,

    organizationAdmins:
      users.filter(
        (user) =>
          user.role ===
          ROLE.ORGANIZATION_ADMIN
      ).length,

    branchManagers:
      users.filter(
        (user) =>
          user.role ===
          ROLE.BRANCH_MANAGER
      ).length,

    supervisors:
      users.filter(
        (user) =>
          user.role ===
          ROLE.SUPERVISOR
      ).length,

    technicians:
      users.filter(
        (user) =>
          user.role ===
          ROLE.TECHNICIAN
      ).length,

    inventoryManagers:
      users.filter(
        (user) =>
          user.role ===
          ROLE.INVENTORY_MANAGER
      ).length,

    registeredReporters:
      users.filter(
        (user) =>
          user.role ===
          ROLE.REGISTERED_REPORTER
      ).length,

    techniciansWithOverdueTickets:
      users.filter(
        (user) =>
          user.role ===
            ROLE.TECHNICIAN &&
          Number(
            user
              .overdue_tickets_count ||
              0
          ) > 0
      ).length,
  };
}

/* ==================================================
   حذف المستخدم
================================================== */

export async function deleteUser(
  userId,
  options = {}
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب."
    );
  }

  const authenticatedUserId =
    await getCurrentUserId();

  if (
    String(
      authenticatedUserId
    ) === String(userId)
  ) {
    throw new Error(
      "لا يمكنك حذف حسابك الحالي."
    );
  }

  if (!options.permanent) {
    return setUserStatus(
      userId,
      false
    );
  }

  const {
    count,
    error: ticketsError,
  } =
    await requireSupabase()
      .from("tickets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "assigned_technician_id",
        userId
      )
      .in(
        "status",
        OPEN_TICKET_STATUSES
      );

  if (ticketsError) {
    throw enhanceUserError(
      ticketsError
    );
  }

  if ((count || 0) > 0) {
    throw new Error(
      "لا يمكن حذف المستخدم لوجود طلبات صيانة مفتوحة مسندة إليه."
    );
  }

  await syncUserLocations(
    userId,
    []
  );

  const { error } =
    await requireSupabase()
      .from("profiles")
      .delete()
      .eq("id", userId);

  if (error) {
    throw enhanceUserError(
      error
    );
  }

  return true;
}

/* ==================================================
   أسماء بديلة للتوافق
================================================== */

export const getUsers =
  listUsers;

export const getUserById =
  getUser;

export const createProfile =
  createUser;

export const updateProfile =
  updateUser;

export const archiveUser =
  setUserStatus;

export const getTechnicians =
  listTechnicians;

export const getManagers =
  listManagers;