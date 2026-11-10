import { requireSupabase } from "../lib/supabase";

const ASSET_SELECT = `
  id,
  organization_id,
  location_id,
  category_id,
  name,
  asset_number,
  serial_number,
  is_active,
  created_at,
  updated_at,
  locations (
    id,
    organization_id,
    name,
    address,
    is_active
  ),
  categories (
    id,
    organization_id,
    name,
    is_active
  )
`;

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

function normalizeAssetPayload(payload = {}) {
  return {
    organizationId:
      payload.organizationId ||
      payload.organization_id ||
      null,

    locationId:
      payload.locationId ||
      payload.location_id ||
      null,

    categoryId:
      payload.categoryId ||
      payload.category_id ||
      null,

    name: cleanString(payload.name),

    assetNumber: cleanString(
      payload.assetNumber ||
        payload.asset_number ||
        payload.assetCode ||
        payload.asset_code
    ),

    serialNumber: cleanString(
      payload.serialNumber ||
        payload.serial_number
    ),

    isActive: normalizeBoolean(
      payload.isActive ??
        payload.is_active,
      true
    ),
  };
}

function validateAssetPayload(
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
      "اسم الجهاز يجب ألا يقل عن حرفين."
    );
  }

  if (payload.name.length > 160) {
    throw new Error(
      "اسم الجهاز يجب ألا يتجاوز 160 حرفًا."
    );
  }

  if (!payload.locationId) {
    throw new Error(
      "يجب اختيار موقع الجهاز."
    );
  }

  if (
    requireOrganization &&
    !payload.organizationId
  ) {
    throw new Error(
      "معرّف المنشأة مطلوب لإضافة الجهاز."
    );
  }

  if (
    payload.assetNumber &&
    payload.assetNumber.length > 100
  ) {
    throw new Error(
      "الرقم الداخلي يجب ألا يتجاوز 100 حرف."
    );
  }

  if (
    payload.serialNumber &&
    payload.serialNumber.length > 150
  ) {
    throw new Error(
      "الرقم التسلسلي يجب ألا يتجاوز 150 حرفًا."
    );
  }
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .replace(/[(),.%]/g, " ")
    .replace(/\s+/g, " ");
}

function createRandomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);

  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !==
      "function"
  ) {
    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function createAssetNumber() {
  const year = new Date().getFullYear();

  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `AST-${year}-${randomPart}`;
}

async function hashToken(token) {
  if (
    typeof crypto === "undefined" ||
    !crypto.subtle
  ) {
    throw new Error(
      "المتصفح لا يدعم إنشاء رمز QR آمن."
    );
  }

  const encodedToken =
    new TextEncoder().encode(token);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encodedToken
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function getApplicationUrl() {
  const configuredUrl =
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL;

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/+$/,
      ""
    );
  }

  if (
    typeof window !== "undefined"
  ) {
    return window.location.origin;
  }

  return "";
}

export function buildAssetRequestUrl(
  qrToken
) {
  if (!qrToken) {
    return "";
  }

  return `${getApplicationUrl()}/request/${encodeURIComponent(
    qrToken
  )}`;
}

function enhanceAssetError(error) {
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
      "لم يتم العثور على الجهاز."
    );
  }

  if (
    error?.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    if (
      message.includes(
        "qr_token_hash"
      )
    ) {
      return new Error(
        "تعذر إنشاء رمز QR فريد. أعيدي المحاولة."
      );
    }

    if (
      message.includes("serial")
    ) {
      return new Error(
        "الرقم التسلسلي مستخدم لجهاز آخر."
      );
    }

    return new Error(
      "الرقم الداخلي مستخدم مسبقًا داخل المنشأة."
    );
  }

  if (
    error?.code === "23503" ||
    message.includes(
      "foreign key"
    )
  ) {
    return new Error(
      "الموقع أو التصنيف المحدد غير صالح."
    );
  }

  if (
    error?.code === "42501" ||
    message.includes(
      "row-level security"
    ) ||
    message.includes(
      "permission"
    ) ||
    message.includes("rls")
  ) {
    return new Error(
      "لا تملكين صلاحية تنفيذ هذه العملية."
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
        "حدث خطأ أثناء معالجة الجهاز."
      );
}

async function validateRelations({
  organizationId,
  locationId,
  categoryId,
}) {
  const locationResult =
    await requireSupabase()
      .from("locations")
      .select(
        `
          id,
          organization_id,
          name,
          is_active
        `
      )
      .eq("id", locationId)
      .single();

  if (locationResult.error) {
    throw enhanceAssetError(
      locationResult.error
    );
  }

  if (
    locationResult.data.is_active ===
    false
  ) {
    throw new Error(
      "لا يمكن إضافة جهاز إلى موقع غير نشط."
    );
  }

  if (
    organizationId &&
    String(
      locationResult.data
        .organization_id
    ) !== String(organizationId)
  ) {
    throw new Error(
      "الموقع المحدد لا يتبع المنشأة المختارة."
    );
  }

  if (!categoryId) {
    return {
      organizationId:
        organizationId ||
        locationResult.data
          .organization_id,

      location:
        locationResult.data,

      category: null,
    };
  }

  const categoryResult =
    await requireSupabase()
      .from("categories")
      .select(
        `
          id,
          organization_id,
          name,
          is_active
        `
      )
      .eq("id", categoryId)
      .single();

  if (categoryResult.error) {
    throw enhanceAssetError(
      categoryResult.error
    );
  }

  if (
    categoryResult.data.is_active ===
    false
  ) {
    throw new Error(
      "التصنيف المحدد غير نشط."
    );
  }

  if (
    String(
      categoryResult.data
        .organization_id
    ) !==
    String(
      locationResult.data
        .organization_id
    )
  ) {
    throw new Error(
      "يجب أن يتبع التصنيف والموقع المنشأة نفسها."
    );
  }

  return {
    organizationId:
      organizationId ||
      locationResult.data
        .organization_id,

    location:
      locationResult.data,

    category:
      categoryResult.data,
  };
}

/* ==================================================
   جلب قائمة الأجهزة
================================================== */

export async function listAssets(
  filters = {}
) {
  let query = requireSupabase()
    .from("assets")
    .select(ASSET_SELECT)
    .order("created_at", {
      ascending: false,
    });

  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  const locationId =
    filters.locationId ||
    filters.location_id;

  const categoryId =
    filters.categoryId ||
    filters.category_id;

  if (organizationId) {
    query = query.eq(
      "organization_id",
      organizationId
    );
  }

  if (locationId) {
    query = query.eq(
      "location_id",
      locationId
    );
  }

  if (categoryId) {
    query = query.eq(
      "category_id",
      categoryId
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
        activeFilter,
        true
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
        `asset_number.ilike.%${search}%`,
        `serial_number.ilike.%${search}%`,
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
    throw enhanceAssetError(error);
  }

  return data || [];
}

/* ==================================================
   جلب جهاز واحد
================================================== */

export async function getAsset(
  assetId
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  const { data, error } =
    await requireSupabase()
      .from("assets")
      .select(ASSET_SELECT)
      .eq("id", assetId)
      .single();

  if (error) {
    throw enhanceAssetError(error);
  }

  return data;
}

/* ==================================================
   إنشاء جهاز
================================================== */

export async function createAsset(
  formPayload = {}
) {
  const payload =
    normalizeAssetPayload(
      formPayload
    );

  validateAssetPayload(
    payload,
    {
      requireOrganization: true,
    }
  );

  const relations =
    await validateRelations(
      payload
    );

  const qrToken =
    formPayload.qrToken ||
    formPayload.qr_token ||
    createRandomToken();

  const qrTokenHash =
    await hashToken(qrToken);

  const insertPayload = {
    organization_id:
      relations.organizationId,

    location_id:
      payload.locationId,

    category_id:
      payload.categoryId,

    name:
      payload.name,

    asset_number:
      payload.assetNumber ||
      createAssetNumber(),

    serial_number:
      payload.serialNumber,

    qr_token_hash:
      qrTokenHash,

    is_active:
      payload.isActive,
  };

  const { data, error } =
    await requireSupabase()
      .from("assets")
      .insert(insertPayload)
      .select(ASSET_SELECT)
      .single();

  if (error) {
    throw enhanceAssetError(error);
  }

  const storedToken = await requireSupabase().functions.invoke("asset-qr", {
    body: { action: "store", assetId: data.id, qrToken },
  });
  if (storedToken.error) {
    await requireSupabase().from("assets").delete().eq("id", data.id);
    throw enhanceAssetError(storedToken.error);
  }

  return {
    asset: {
      ...data,

      qr_token:
        qrToken,

      qrToken,
    },

    qrToken,

    qrUrl:
      buildAssetRequestUrl(
        qrToken
      ),
  };
}

/* ==================================================
   تحديث جهاز
================================================== */

export async function updateAsset(
  assetId,
  formPayload = {}
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  const currentAsset =
    await getAsset(assetId);

  const payload =
    normalizeAssetPayload({
      ...currentAsset,
      ...formPayload,

      organizationId:
        formPayload.organizationId ||
        formPayload.organization_id ||
        currentAsset.organization_id,
    });

  validateAssetPayload(
    payload,
    {
      requireOrganization: true,
    }
  );

  await validateRelations(
    payload
  );

  const updatePayload = {
    location_id:
      payload.locationId,

    category_id:
      payload.categoryId,

    name:
      payload.name,

    asset_number:
      payload.assetNumber,

    serial_number:
      payload.serialNumber,

    is_active:
      payload.isActive,

    updated_at:
      new Date().toISOString(),
  };

  const { data, error } =
    await requireSupabase()
      .from("assets")
      .update(updatePayload)
      .eq("id", assetId)
      .select(ASSET_SELECT)
      .single();

  if (error) {
    throw enhanceAssetError(error);
  }

  return data;
}

/* ==================================================
   تفعيل وتعطيل الجهاز
================================================== */

export async function setAssetStatus(
  assetId,
  isActive
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  const { data, error } =
    await requireSupabase()
      .from("assets")
      .update({
        is_active:
          normalizeBoolean(
            isActive,
            false
          ),

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", assetId)
      .select(ASSET_SELECT)
      .single();

  if (error) {
    throw enhanceAssetError(error);
  }

  return data;
}

export async function toggleAssetStatus(
  asset
) {
  if (!asset?.id) {
    throw new Error(
      "بيانات الجهاز غير مكتملة."
    );
  }

  const currentStatus =
    asset.is_active ??
    asset.isActive ??
    asset.status === "ACTIVE";

  return setAssetStatus(
    asset.id,
    !currentStatus
  );
}

/* ==================================================
   إنشاء رمز QR جديد
================================================== */

export async function regenerateAssetQr(
  assetId
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  const { data: tokenData, error } = await requireSupabase().functions.invoke(
    "asset-qr",
    { body: { action: "rotate", assetId } }
  );
  if (error) throw enhanceAssetError(error);
  const data = await getAsset(assetId);
  const qrToken = tokenData?.qrToken;

  return {
    asset: {
      ...data,

      qr_token:
        qrToken,

      qrToken,
    },

    qrToken,

    qrUrl:
      buildAssetRequestUrl(
        qrToken
      ),
  };
}

export async function getAssetQrToken(assetId) {
  if (!assetId) throw new Error("ASSET_ID_REQUIRED");
  const { data, error } = await requireSupabase().functions.invoke("asset-qr", {
    body: { action: "reveal", assetId },
  });
  if (error) throw enhanceAssetError(error);
  if (!data?.qrToken) throw new Error(data?.error || "QR_TOKEN_NOT_RECOVERABLE");
  return data.qrToken;
}

export async function disableAssetQr(
  assetId
) {
  return setAssetStatus(
    assetId,
    false
  );
}

/* ==================================================
   حذف الجهاز
================================================== */

export async function deleteAsset(
  assetId,
  options = {}
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  if (!options.permanent) {
    return setAssetStatus(
      assetId,
      false
    );
  }

  const {
    count,
    error: ticketsError,
  } = await requireSupabase()
    .from("tickets")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("asset_id", assetId);

  if (ticketsError) {
    throw enhanceAssetError(
      ticketsError
    );
  }

  if ((count || 0) > 0) {
    throw new Error(
      "لا يمكن حذف الجهاز نهائيًا لوجود طلبات صيانة مرتبطة به. يمكنك تعطيله بدلًا من ذلك."
    );
  }

  const { error } =
    await requireSupabase()
      .from("assets")
      .delete()
      .eq("id", assetId);

  if (error) {
    throw enhanceAssetError(error);
  }

  return true;
}

/* ==================================================
   أسماء بديلة للتوافق
================================================== */

export const getAssets =
  listAssets;

export const getAssetById =
  getAsset;

export const createAssetQr =
  regenerateAssetQr;

export const regenerateAssetQrToken =
  regenerateAssetQr;

export const archiveAsset =
  disableAssetQr;
