import { requireSupabase } from "../lib/supabase";

const LOCATION_SELECT = `
  id,
  organization_id,
  name,
  address,
  description,
  is_active,
  created_at,
  updated_at
`;

const OPEN_TICKET_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

/* ==================================================
   تنظيف وتجهيز البيانات
================================================== */

function cleanString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
}

function normalizeBoolean(value, fallback = true) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    const normalizedValue = value
      .trim()
      .toLowerCase();

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

function normalizeLocationPayload(payload = {}) {
  return {
    organizationId:
      payload.organizationId ||
      payload.organization_id ||
      null,

    name: cleanString(payload.name),

    address: cleanString(payload.address),

    description: cleanString(
      payload.description
    ),

    isActive: normalizeBoolean(
      payload.isActive ??
        payload.is_active,
      true
    ),
  };
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .replace(/[(),.%]/g, " ")
    .replace(/\s+/g, " ");
}

/* ==================================================
   التحقق من بيانات الموقع
================================================== */

function validateLocationPayload(
  payload,
  {
    requireOrganization = true,
  } = {}
) {
  if (
    !payload.name ||
    payload.name.length < 2
  ) {
    throw new Error(
      "اسم الموقع يجب ألا يقل عن حرفين."
    );
  }

  if (payload.name.length > 120) {
    throw new Error(
      "اسم الموقع يجب ألا يتجاوز 120 حرفًا."
    );
  }

  if (
    payload.address &&
    payload.address.length > 300
  ) {
    throw new Error(
      "عنوان الموقع يجب ألا يتجاوز 300 حرف."
    );
  }

  if (
    payload.description &&
    payload.description.length > 1000
  ) {
    throw new Error(
      "وصف الموقع يجب ألا يتجاوز 1000 حرف."
    );
  }

  if (
    requireOrganization &&
    !payload.organizationId
  ) {
    throw new Error(
      "يجب تحديد المنشأة التابعة للموقع."
    );
  }
}

/* ==================================================
   معالجة أخطاء Supabase
================================================== */

function enhanceLocationError(error) {
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
      "لم يتم العثور على الموقع."
    );
  }

  if (
    error?.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return new Error(
      "يوجد موقع آخر بالاسم نفسه داخل المنشأة."
    );
  }

  if (
    error?.code === "23503" ||
    message.includes("foreign key")
  ) {
    return new Error(
      "لا يمكن تنفيذ العملية بسبب وجود بيانات مرتبطة بهذا الموقع."
    );
  }

  if (
    error?.code === "42501" ||
    message.includes("permission") ||
    message.includes("row-level security") ||
    message.includes("rls")
  ) {
    return new Error(
      "لا تملكين صلاحية إدارة المواقع."
    );
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("network")
  ) {
    return new Error(
      "تعذر الاتصال بالخادم. تحققي من اتصال الإنترنت."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "حدث خطأ أثناء معالجة بيانات الموقع."
      );
}

/* ==================================================
   استعلام اختياري آمن
================================================== */

async function safeQuery(queryBuilder) {
  try {
    const { data, error } =
      await queryBuilder;

    if (error) {
      return [];
    }

    return data || [];
  } catch {
    return [];
  }
}

function createCountMap(items, keyName) {
  const result = new Map();

  items.forEach((item) => {
    const key = item?.[keyName];

    if (!key) {
      return;
    }

    const normalizedKey =
      String(key);

    result.set(
      normalizedKey,
      (result.get(normalizedKey) || 0) + 1
    );
  });

  return result;
}

/* ==================================================
   إضافة أعداد الأجهزة والطلبات والمستخدمين
================================================== */

async function attachLocationCounts(locations) {
  if (
    !Array.isArray(locations) ||
    locations.length === 0
  ) {
    return [];
  }

  const locationIds = locations
    .map((location) => location.id)
    .filter(Boolean);

  if (locationIds.length === 0) {
    return locations;
  }

  const supabase = requireSupabase();

  const [
    assets,
    tickets,
    userLocations,
  ] = await Promise.all([
    safeQuery(
      supabase
        .from("assets")
        .select(
          "id, location_id, is_active"
        )
        .in(
          "location_id",
          locationIds
        )
    ),

    safeQuery(
      supabase
        .from("tickets")
        .select(
          "id, location_id, status"
        )
        .in(
          "location_id",
          locationIds
        )
    ),

    safeQuery(
      supabase
        .from("user_locations")
        .select(
          "location_id"
        )
        .in(
          "location_id",
          locationIds
        )
    ),
  ]);

  const assetsCountMap =
    createCountMap(
      assets,
      "location_id"
    );

  const usersCountMap =
    createCountMap(
      userLocations,
      "location_id"
    );

  const openTicketsCountMap =
    createCountMap(
      tickets.filter((ticket) =>
        OPEN_TICKET_STATUSES.includes(
          ticket.status
        )
      ),
      "location_id"
    );

  const totalTicketsCountMap =
    createCountMap(
      tickets,
      "location_id"
    );

  return locations.map((location) => {
    const locationKey =
      String(location.id);

    return {
      ...location,

      assets_count:
        assetsCountMap.get(
          locationKey
        ) || 0,

      users_count:
        usersCountMap.get(
          locationKey
        ) || 0,

      open_tickets_count:
        openTicketsCountMap.get(
          locationKey
        ) || 0,

      tickets_count:
        totalTicketsCountMap.get(
          locationKey
        ) || 0,
    };
  });
}

/* ==================================================
   جلب قائمة المواقع
================================================== */

export async function listLocations(
  filters = {}
) {
  let query = requireSupabase()
    .from("locations")
    .select(LOCATION_SELECT)
    .order("name", {
      ascending: true,
    });

  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  if (organizationId) {
    query = query.eq(
      "organization_id",
      organizationId
    );
  }

  const activeFilter =
    filters.isActive ??
    filters.is_active ??
    filters.active;

  if (
    activeFilter !== undefined &&
    activeFilter !== ""
  ) {
    query = query.eq(
      "is_active",
      normalizeBoolean(
        activeFilter
      )
    );
  }

  const search =
    normalizeSearchValue(
      filters.search
    );

  if (search) {
    query = query.or(
      [
        `name.ilike.%${search}%`,
        `address.ilike.%${search}%`,
        `description.ilike.%${search}%`,
      ].join(",")
    );
  }

  const limit = Math.min(
    Math.max(
      Number(filters.limit) || 500,
      1
    ),
    1000
  );

  query = query.limit(limit);

  const { data, error } =
    await query;

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  const locations = data || [];

  if (
    filters.includeCounts === false
  ) {
    return locations;
  }

  return attachLocationCounts(
    locations
  );
}

/* ==================================================
   جلب موقع واحد
================================================== */

export async function getLocation(
  locationId,
  options = {}
) {
  if (!locationId) {
    throw new Error(
      "معرّف الموقع مطلوب."
    );
  }

  const { data, error } =
    await requireSupabase()
      .from("locations")
      .select(LOCATION_SELECT)
      .eq("id", locationId)
      .single();

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  if (
    options.includeCounts === false
  ) {
    return data;
  }

  const [locationWithCounts] =
    await attachLocationCounts([
      data,
    ]);

  return (
    locationWithCounts ||
    data
  );
}

/* ==================================================
   إنشاء موقع
================================================== */

export async function createLocation(
  formPayload = {}
) {
  const payload =
    normalizeLocationPayload(
      formPayload
    );

  validateLocationPayload(
    payload,
    {
      requireOrganization: true,
    }
  );

  const { data, error } =
    await requireSupabase()
      .from("locations")
      .insert({
        organization_id:
          payload.organizationId,

        name:
          payload.name,

        address:
          payload.address,

        description:
          payload.description,

        is_active:
          payload.isActive,
      })
      .select(LOCATION_SELECT)
      .single();

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  return {
    ...data,

    assets_count: 0,
    users_count: 0,
    open_tickets_count: 0,
    tickets_count: 0,
  };
}

/* ==================================================
   تحديث موقع
================================================== */

export async function updateLocation(
  locationId,
  formPayload = {}
) {
  if (!locationId) {
    throw new Error(
      "معرّف الموقع مطلوب."
    );
  }

  const payload =
    normalizeLocationPayload(
      formPayload
    );

  validateLocationPayload(
    payload,
    {
      requireOrganization: false,
    }
  );

  const { data, error } =
    await requireSupabase()
      .from("locations")
      .update({
        name:
          payload.name,

        address:
          payload.address,

        description:
          payload.description,

        is_active:
          payload.isActive,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", locationId)
      .select(LOCATION_SELECT)
      .single();

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  return getLocation(data.id);
}

/* ==================================================
   عدد الطلبات المفتوحة
================================================== */

export async function getLocationOpenTicketsCount(
  locationId
) {
  if (!locationId) {
    throw new Error(
      "معرّف الموقع مطلوب."
    );
  }

  const { count, error } =
    await requireSupabase()
      .from("tickets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "location_id",
        locationId
      )
      .in(
        "status",
        OPEN_TICKET_STATUSES
      );

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  return count || 0;
}

/* ==================================================
   تفعيل أو تعطيل الموقع
================================================== */

export async function setLocationStatus(
  locationId,
  isActive,
  options = {}
) {
  if (!locationId) {
    throw new Error(
      "معرّف الموقع مطلوب."
    );
  }

  const normalizedStatus =
    normalizeBoolean(
      isActive,
      false
    );

  if (
    !normalizedStatus &&
    options.checkOpenTickets !==
      false
  ) {
    const openTicketsCount =
      await getLocationOpenTicketsCount(
        locationId
      );

    if (openTicketsCount > 0) {
      throw new Error(
        `لا يمكن تعطيل الموقع لوجود ${openTicketsCount} طلب صيانة مفتوح مرتبط به.`
      );
    }
  }

  const { data, error } =
    await requireSupabase()
      .from("locations")
      .update({
        is_active:
          normalizedStatus,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", locationId)
      .select(LOCATION_SELECT)
      .single();

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  return getLocation(data.id);
}

export async function toggleLocationStatus(
  location,
  options = {}
) {
  if (!location?.id) {
    throw new Error(
      "بيانات الموقع غير مكتملة."
    );
  }

  const currentStatus =
    location.is_active ??
    location.isActive ??
    true;

  return setLocationStatus(
    location.id,
    !currentStatus,
    options
  );
}

/* ==================================================
   حذف الموقع
================================================== */

export async function deleteLocation(
  locationId,
  options = {}
) {
  if (!locationId) {
    throw new Error(
      "معرّف الموقع مطلوب."
    );
  }

  if (!options.permanent) {
    return setLocationStatus(
      locationId,
      false,
      options
    );
  }

  const openTicketsCount =
    await getLocationOpenTicketsCount(
      locationId
    );

  if (openTicketsCount > 0) {
    throw new Error(
      "لا يمكن حذف الموقع نهائيًا لوجود طلبات صيانة مفتوحة مرتبطة به."
    );
  }

  const {
    count: assetsCount,
    error: assetsError,
  } = await requireSupabase()
    .from("assets")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "location_id",
      locationId
    );

  if (assetsError) {
    throw enhanceLocationError(
      assetsError
    );
  }

  if ((assetsCount || 0) > 0) {
    throw new Error(
      "لا يمكن حذف الموقع قبل نقل الأجهزة المرتبطة به إلى موقع آخر."
    );
  }

  const {
    count: ticketsCount,
    error: ticketsError,
  } = await requireSupabase()
    .from("tickets")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "location_id",
      locationId
    );

  if (ticketsError) {
    throw enhanceLocationError(
      ticketsError
    );
  }

  if ((ticketsCount || 0) > 0) {
    throw new Error(
      "لا يمكن حذف الموقع نهائيًا لوجود سجل طلبات صيانة مرتبط به. يمكنك تعطيله بدلًا من ذلك."
    );
  }

  const { error } =
    await requireSupabase()
      .from("locations")
      .delete()
      .eq("id", locationId);

  if (error) {
    throw enhanceLocationError(
      error
    );
  }

  return true;
}

/* ==================================================
   الأسماء البديلة للتوافق
================================================== */

export const getLocations =
  listLocations;

export const getLocationById =
  getLocation;

export const archiveLocation =
  setLocationStatus;