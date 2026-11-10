// deno-lint-ignore-file no-explicit-any
import { createClient } from "@supabase/supabase-js";

type SupabaseClientType = ReturnType<
  typeof createClient<any, "public", "public">
>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPEN_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

const ALLOWED_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "EMERGENCY",
];

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

type PublicAction =
  | "resolve_asset"
  | "create"
  | "track"
  | "confirm_resolution"
  | "reopen"
  | "rate";

type AttachmentPayload = {
  name?: string;
  type?: string;
  size?: number;
  base64?: string;
};

type RequestBody = {
  action?: PublicAction | string;

  qrToken?: string;
  qr_token?: string;

  trackingToken?: string;
  tracking_token?: string;

  assetId?: string;
  asset_id?: string;

  locationId?: string;
  location_id?: string;

  categoryId?: string;
  category_id?: string;

  title?: string;
  description?: string;
  priority?: string;

  reporterName?: string;
  reporter_name?: string;

  reporterPhone?: string;
  reporter_phone?: string;

  reporterEmail?: string;
  reporter_email?: string;

  reporterContact?: string;
  reporter_contact?: string;

  reason?: string;
  comment?: string;
  rating?: number;

  attachment?: AttachmentPayload | null;
};

type ManagerRecord = {
  id: string;
  email: string | null;
};

function createResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function cleanString(value: unknown) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const result = String(value).trim();

  return result || null;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        "حدث خطأ غير متوقع.",
    );
  }

  return "حدث خطأ غير متوقع.";
}

function firstRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value;
}

function normalizePriority(value: unknown) {
  const priority = String(
    value || "MEDIUM",
  )
    .trim()
    .toUpperCase();

  if (
    !ALLOWED_PRIORITIES.includes(priority)
  ) {
    throw new Error("INVALID_PRIORITY");
  }

  return priority;
}

function validateEmail(
  email: string | null,
) {
  if (!email) {
    return;
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error("INVALID_EMAIL");
  }
}

async function hashToken(
  token: string,
) {
  const encodedToken =
    new TextEncoder().encode(token);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encodedToken,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function createRandomToken(
  byteLength = 32,
) {
  const bytes =
    new Uint8Array(byteLength);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function calculateDueAt(
  priority: string,
) {
  const hoursByPriority: Record<
    string,
    number
  > = {
    EMERGENCY: 2,
    HIGH: 8,
    MEDIUM: 24,
    LOW: 72,
  };

  const dueAt = new Date();

  dueAt.setHours(
    dueAt.getHours() +
      (hoursByPriority[priority] || 24),
  );

  return dueAt.toISOString();
}

function buildReporterContact(
  body: RequestBody,
) {
  const providedContact =
    cleanString(body.reporterContact) ||
    cleanString(body.reporter_contact);

  const phone =
    cleanString(body.reporterPhone) ||
    cleanString(body.reporter_phone);

  const email =
    cleanString(body.reporterEmail) ||
    cleanString(body.reporter_email);

  validateEmail(email);

  return [
    providedContact,
    phone
      ? `الهاتف: ${phone}`
      : null,
    email
      ? `البريد: ${email}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ") || null;
}

function decodeBase64(
  base64Value: string,
) {
  const normalizedBase64 =
    base64Value.includes(",")
      ? base64Value.split(",").pop() || ""
      : base64Value;

  const binaryString =
    atob(normalizedBase64);

  const bytes =
    new Uint8Array(
      binaryString.length,
    );

  for (
    let index = 0;
    index < binaryString.length;
    index += 1
  ) {
    bytes[index] =
      binaryString.charCodeAt(index);
  }

  return bytes;
}

function getFileExtension(
  mimeType: string,
) {
  const extensions: Record<
    string,
    string
  > = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[mimeType] || "bin";
}

async function findAssetByQrToken(
  supabase: SupabaseClientType,
  qrToken: string,
) {
  const qrTokenHash =
    await hashToken(qrToken);

  const { data, error } =
    await supabase
      .from("assets")
      .select(
        `
          id,
          organization_id,
          location_id,
          category_id,
          name,
          asset_number,
          serial_number,
          is_active,
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
          ),
          organizations (
            id,
            name,
            status
          )
        `,
      )
      .eq(
        "qr_token_hash",
        qrTokenHash,
      )
      .maybeSingle();

  if (error || !data) {
    throw new Error("INVALID_QR");
  }

  if (data.is_active === false) {
    throw new Error("ASSET_INACTIVE");
  }

  const location =
    firstRelation(data.locations);

  const organization =
    firstRelation(
      data.organizations,
    );

  if (
    !location ||
    location.is_active === false
  ) {
    throw new Error(
      "LOCATION_INACTIVE",
    );
  }

  if (
    !organization ||
    organization.status !== "ACTIVE"
  ) {
    throw new Error(
      "ORGANIZATION_INACTIVE",
    );
  }

  return data;
}

async function resolveAsset(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const qrToken =
    cleanString(body.qrToken) ||
    cleanString(body.qr_token);

  if (!qrToken) {
    throw new Error("INVALID_QR");
  }

  const asset =
    await findAssetByQrToken(
      supabase,
      qrToken,
    );

  const location =
    firstRelation(asset.locations);

  const category =
    firstRelation(asset.categories);

  const {
    data: categories,
    error,
  } = await supabase
    .from("categories")
    .select(
      `
        id,
        organization_id,
        name,
        is_active
      `,
    )
    .eq(
      "organization_id",
      asset.organization_id,
    )
    .eq("is_active", true)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    asset: {
      id: asset.id,

      organization_id:
        asset.organization_id,

      location_id:
        asset.location_id,

      category_id:
        asset.category_id,

      name:
        asset.name,

      asset_number:
        asset.asset_number,

      serial_number:
        asset.serial_number,

      is_active:
        asset.is_active,

      location,

      locations:
        location,

      category,

      categories:
        category,
    },

    categories:
      categories || [],
  };
}

async function getNextTicketNumber(
  supabase: SupabaseClientType,
  organizationId: string,
) {
  const year =
    new Date().getFullYear();

  const insertResult =
    await supabase
      .from("ticket_counters")
      .insert({
        organization_id:
          organizationId,

        year,

        last_value: 1,
      })
      .select("last_value")
      .maybeSingle();

  if (
    !insertResult.error &&
    insertResult.data
  ) {
    return `MT-${year}-${String(
      insertResult.data.last_value,
    ).padStart(6, "0")}`;
  }

  if (
    insertResult.error &&
    insertResult.error.code !== "23505"
  ) {
    throw new Error(
      insertResult.error.message,
    );
  }

  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {
    const {
      data: counter,
      error: counterError,
    } = await supabase
      .from("ticket_counters")
      .select("last_value")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("year", year)
      .single();

    if (
      counterError ||
      !counter
    ) {
      throw new Error(
        counterError?.message ||
          "TICKET_COUNTER_ERROR",
      );
    }

    const currentValue =
      Number(counter.last_value);

    const nextValue =
      currentValue + 1;

    const {
      data: updatedCounter,
      error: updateError,
    } = await supabase
      .from("ticket_counters")
      .update({
        last_value: nextValue,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("year", year)
      .eq(
        "last_value",
        currentValue,
      )
      .select("last_value")
      .maybeSingle();

    if (updateError) {
      throw new Error(
        updateError.message,
      );
    }

    if (updatedCounter) {
      return `MT-${year}-${String(
        updatedCounter.last_value,
      ).padStart(6, "0")}`;
    }
  }

  throw new Error(
    "TICKET_COUNTER_ERROR",
  );
}

async function checkDuplicateTicket(
  supabase: SupabaseClientType,
  assetId: string,
  title: string,
) {
  const tenMinutesAgo =
    new Date(
      Date.now() -
        10 * 60 * 1000,
    ).toISOString();

  const { data, error } =
    await supabase
      .from("tickets")
      .select("id")
      .eq("asset_id", assetId)
      .in(
        "status",
        OPEN_STATUSES,
      )
      .ilike("title", title)
      .gte(
        "created_at",
        tenMinutesAgo,
      )
      .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (
    data &&
    data.length > 0
  ) {
    throw new Error(
      "DUPLICATE_OPEN_TICKET",
    );
  }
}

async function uploadAttachment(
  supabase: SupabaseClientType,
  ticket: {
    id: string;
    organization_id: string;
  },
  attachment:
    | AttachmentPayload
    | null
    | undefined,
  type:
    | "REPORT"
    | "BEFORE_REPAIR"
    | "AFTER_REPAIR",
) {
  if (!attachment?.base64) {
    return null;
  }

  const mimeType =
    cleanString(attachment.type) ||
    "application/octet-stream";

  if (
    !ALLOWED_IMAGE_TYPES.includes(
      mimeType,
    )
  ) {
    throw new Error(
      "INVALID_ATTACHMENT_TYPE",
    );
  }

  const fileBytes =
    decodeBase64(
      attachment.base64,
    );

  const sizeBytes =
    Number(
      attachment.size ||
        fileBytes.byteLength,
    );

  if (
    sizeBytes < 1 ||
    sizeBytes >
      5 * 1024 * 1024
  ) {
    throw new Error(
      "INVALID_ATTACHMENT_SIZE",
    );
  }

  const extension =
    getFileExtension(mimeType);

  const storagePath = [
    ticket.organization_id,
    ticket.id,
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");

  const {
    error: uploadError,
  } = await supabase.storage
    .from("ticket-attachments")
    .upload(
      storagePath,
      fileBytes,
      {
        contentType: mimeType,
        upsert: false,
      },
    );

  if (uploadError) {
    throw new Error(
      `ATTACHMENT_UPLOAD_FAILED: ${uploadError.message}`,
    );
  }

  const { data, error } =
    await supabase
      .from(
        "ticket_attachments",
      )
      .insert({
        organization_id:
          ticket.organization_id,

        ticket_id:
          ticket.id,

        uploaded_by:
          null,

        storage_path:
          storagePath,

        type,

        mime_type:
          mimeType,

        size_bytes:
          sizeBytes,
      })
      .select("*")
      .single();

  if (error) {
    await supabase.storage
      .from(
        "ticket-attachments",
      )
      .remove([storagePath]);

    throw new Error(error.message);
  }

  return data;
}

async function createManagerNotifications(
  supabase: SupabaseClientType,
  ticket: {
    id: string;
    organization_id: string;
    priority: string;
  },
) {
  const {
    data: managerData,
    error,
  } = await supabase
    .from("profiles")
    .select("id, email")
    .eq(
      "organization_id",
      ticket.organization_id,
    )
    .eq("is_active", true)
    .in("role", [
      "ORGANIZATION_ADMIN",
      "SUPERVISOR",
    ]);

  if (
    error ||
    !managerData?.length
  ) {
    return;
  }

  const managers =
    managerData as ManagerRecord[];

  const now =
    new Date().toISOString();

  const eventType =
    ticket.priority === "EMERGENCY"
      ? "EMERGENCY_TICKET"
      : "TICKET_CREATED";

  const notifications =
    managers.flatMap(
      (
        manager: ManagerRecord,
      ) => {
        const inAppNotification = {
          organization_id:
            ticket.organization_id,

          user_id:
            manager.id,

          ticket_id:
            ticket.id,

          channel:
            "IN_APP",

          event_type:
            eventType,

          status:
            "SENT",

          attempts:
            1,

          last_error:
            null,

          sent_at:
            now,
        };

        if (!manager.email) {
          return [
            inAppNotification,
          ];
        }

        return [
          inAppNotification,

          {
            organization_id:
              ticket.organization_id,

            user_id:
              manager.id,

            ticket_id:
              ticket.id,

            channel:
              "EMAIL",

            event_type:
              eventType,

            status:
              "PENDING",

            attempts:
              0,

            last_error:
              null,

            sent_at:
              null,
          },
        ];
      },
    );

  const {
    error: insertError,
  } = await supabase
    .from("notifications")
    .insert(notifications);

  if (insertError) {
    console.error(
      "Notification error:",
      insertError,
    );
  }
}

async function findTicketByTrackingToken(
  supabase: SupabaseClientType,
  trackingToken: string,
) {
  const trackingTokenHash =
    await hashToken(
      trackingToken,
    );

  const { data, error } =
    await supabase
      .from("tickets")
      .select(
        `
          *,
          locations (
            id,
            name,
            address
          ),
          assets (
            id,
            name,
            asset_number,
            serial_number
          ),
          categories (
            id,
            name
          )
        `,
      )
      .eq(
        "tracking_token_hash",
        trackingTokenHash,
      )
      .maybeSingle();

  if (
    error ||
    !data
  ) {
    throw new Error(
      "TRACKING_TOKEN_NOT_FOUND",
    );
  }

  return data;
}

async function hydratePublicTicket(
  supabase: SupabaseClientType,
  ticket: Record<
    string,
    unknown
  >,
) {
  const location =
    firstRelation(
      ticket.locations as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null,
    );

  const asset =
    firstRelation(
      ticket.assets as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null,
    );

  const category =
    firstRelation(
      ticket.categories as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null,
    );

  const ticketId =
    String(ticket.id || "");

  const [
    ratingResult,
    commentResult,
  ] = await Promise.all([
    supabase
      .from("ticket_ratings")
      .select(
        "rating, comment, created_at",
      )
      .eq(
        "ticket_id",
        ticketId,
      )
      .maybeSingle(),

    supabase
      .from("ticket_comments")
      .select(
        "comment, created_at",
      )
      .eq(
        "ticket_id",
        ticketId,
      )
      .eq(
        "is_internal",
        false,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle(),
  ]);

  const rating =
    ratingResult.data;

  const publicComment =
    commentResult.data?.comment ||
    null;

  return {
    ...ticket,

    location,

    asset,

    category,

    location_name:
      location?.name ||
      "موقع غير محدد",

    asset_name:
      asset?.name ||
      "جهاز غير محدد",

    asset_number:
      asset?.asset_number ||
      null,

    category_name:
      category?.name ||
      null,

    public_message:
      publicComment ||
      ticket.resolution ||
      null,

    reporter_rating:
      rating?.rating ||
      null,

    rating:
      rating?.rating ||
      null,

    rating_comment:
      rating?.comment ||
      null,
  };
}

async function getPublicTicket(
  supabase: SupabaseClientType,
  trackingToken: string,
) {
  const ticket =
    await findTicketByTrackingToken(
      supabase,
      trackingToken,
    );

  return hydratePublicTicket(
    supabase,
    ticket,
  );
}

async function createTicket(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const qrToken =
    cleanString(body.qrToken) ||
    cleanString(body.qr_token);

  if (!qrToken) {
    throw new Error("INVALID_QR");
  }

  const asset =
    await findAssetByQrToken(
      supabase,
      qrToken,
    );

  const providedAssetId =
    cleanString(body.assetId) ||
    cleanString(body.asset_id);

  if (
    providedAssetId &&
    String(providedAssetId) !==
      String(asset.id)
  ) {
    throw new Error(
      "INVALID_ASSET",
    );
  }

  const title =
    cleanString(body.title);

  const description =
    cleanString(
      body.description,
    );

  if (
    !title ||
    title.length < 3
  ) {
    throw new Error(
      "INVALID_TITLE",
    );
  }

  if (
    title.length > 200
  ) {
    throw new Error(
      "INVALID_TITLE",
    );
  }

  if (
    !description ||
    description.length < 10
  ) {
    throw new Error(
      "INVALID_DESCRIPTION",
    );
  }

  if (
    description.length > 3000
  ) {
    throw new Error(
      "INVALID_DESCRIPTION",
    );
  }

  const priority =
    normalizePriority(
      body.priority,
    );

  const reporterName =
    cleanString(
      body.reporterName,
    ) ||
    cleanString(
      body.reporter_name,
    );

  const reporterContact =
    buildReporterContact(body);

  const requestedCategoryId =
    cleanString(
      body.categoryId,
    ) ||
    cleanString(
      body.category_id,
    );

  let categoryId =
    requestedCategoryId ||
    asset.category_id ||
    null;

  if (categoryId) {
    const {
      data: category,
    } = await supabase
      .from("categories")
      .select(
        `
          id,
          organization_id,
          is_active
        `,
      )
      .eq("id", categoryId)
      .eq(
        "organization_id",
        asset.organization_id,
      )
      .eq("is_active", true)
      .maybeSingle();

    if (!category) {
      categoryId =
        asset.category_id ||
        null;
    }
  }

  await checkDuplicateTicket(
    supabase,
    asset.id,
    title,
  );

  const ticketNumber =
    await getNextTicketNumber(
      supabase,
      asset.organization_id,
    );

  const trackingToken =
    createRandomToken();

  const trackingTokenHash =
    await hashToken(
      trackingToken,
    );

  const { data: ticket, error } =
    await supabase
      .from("tickets")
      .insert({
        organization_id:
          asset.organization_id,

        ticket_number:
          ticketNumber,

        tracking_token_hash:
          trackingTokenHash,

        asset_id:
          asset.id,

        location_id:
          asset.location_id,

        category_id:
          categoryId,

        title,

        description,

        priority,

        status:
          "NEW",

        reporter_name:
          reporterName,

        reporter_contact:
          reporterContact,

        due_at:
          calculateDueAt(
            priority,
          ),

        is_overdue:
          false,
      })
      .select("*")
      .single();

  if (
    error ||
    !ticket
  ) {
    throw new Error(
      error?.message ||
        "TICKET_CREATE_FAILED",
    );
  }

  const {
    error: historyError,
  } = await supabase
    .from("ticket_history")
    .insert({
      organization_id:
        ticket.organization_id,

      ticket_id:
        ticket.id,

      actor_id:
        null,

      from_status:
        null,

      to_status:
        "NEW",

      reason:
        "تم إنشاء الطلب من صفحة البلاغ العامة.",
    });

  if (historyError) {
    console.error(
      "History error:",
      historyError,
    );
  }

  let attachmentWarning:
    | string
    | null = null;

  if (body.attachment) {
    try {
      await uploadAttachment(
        supabase,
        ticket,
        body.attachment,
        "REPORT",
      );
    } catch (
      attachmentError
    ) {
      attachmentWarning =
        normalizeError(
          attachmentError,
        );

      console.error(
        "Attachment error:",
        attachmentError,
      );
    }
  }

  await createManagerNotifications(
    supabase,
    ticket,
  );

  const responseTicket =
    await getPublicTicket(
      supabase,
      trackingToken,
    );

  return {
    ticket: {
      ...responseTicket,

      tracking_token:
        trackingToken,

      trackingToken,
    },

    trackingToken,

    tracking_token:
      trackingToken,

    attachmentWarning,
  };
}

function trackTicket(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const trackingToken =
    cleanString(
      body.trackingToken,
    ) ||
    cleanString(
      body.tracking_token,
    );

  if (!trackingToken) {
    throw new Error(
      "TRACKING_TOKEN_REQUIRED",
    );
  }

  return getPublicTicket(
    supabase,
    trackingToken,
  );
}

async function confirmResolution(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const trackingToken =
    cleanString(
      body.trackingToken,
    ) ||
    cleanString(
      body.tracking_token,
    );

  if (!trackingToken) {
    throw new Error(
      "TRACKING_TOKEN_REQUIRED",
    );
  }

  const ticket =
    await findTicketByTrackingToken(
      supabase,
      trackingToken,
    );

  if (
    ticket.status === "CLOSED"
  ) {
    return hydratePublicTicket(
      supabase,
      ticket,
    );
  }

  if (
    ticket.status !==
    "PENDING_APPROVAL"
  ) {
    throw new Error(
      "TICKET_NOT_PENDING_APPROVAL",
    );
  }

  if (!ticket.supervisor_approved_at) {
    throw new Error("SUPERVISOR_APPROVAL_REQUIRED");
  }

  const now =
    new Date().toISOString();

  const { data, error } =
    await supabase
      .from("tickets")
      .update({
        status:
          "CLOSED",

        closed_at:
          now,

        first_closed_at:
          ticket.first_closed_at || now,

        last_closed_at:
          now,

        reporter_confirmed_at:
          now,

        updated_at:
          now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "TICKET_CLOSE_FAILED",
    );
  }

  const {
    error: historyError,
  } = await supabase
    .from("ticket_history")
    .insert({
      organization_id:
        ticket.organization_id,

      ticket_id:
        ticket.id,

      actor_id:
        null,

      from_status:
        ticket.status,

      to_status:
        "CLOSED",

      reason:
        "أكد المبلّغ أن المشكلة تم حلها.",
    });

  if (historyError) {
    console.error(
      "History error:",
      historyError,
    );
  }

  return getPublicTicket(
    supabase,
    trackingToken,
  );
}

async function reopenTicket(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const trackingToken =
    cleanString(
      body.trackingToken,
    ) ||
    cleanString(
      body.tracking_token,
    );

  const reason =
    cleanString(body.reason);

  const description =
    cleanString(
      body.description,
    );

  if (!trackingToken) {
    throw new Error(
      "TRACKING_TOKEN_REQUIRED",
    );
  }

  if (
    !reason ||
    reason.length < 5
  ) {
    throw new Error(
      "INVALID_REOPEN_REASON",
    );
  }

  if (
    !description ||
    description.length < 10
  ) {
    throw new Error(
      "INVALID_REOPEN_DESCRIPTION",
    );
  }

  const ticket =
    await findTicketByTrackingToken(
      supabase,
      trackingToken,
    );

  if (
    ![
      "PENDING_APPROVAL",
      "CLOSED",
    ].includes(ticket.status)
  ) {
    throw new Error(
      "TICKET_CANNOT_BE_REOPENED",
    );
  }

  const now =
    new Date().toISOString();

  const { data, error } =
    await supabase
      .from("tickets")
      .update({
        status:
          "REOPENED",

        closed_at:
          null,

        completed_at:
          null,

        reopened_at:
          now,

        reopen_count:
          Number(ticket.reopen_count || 0) + 1,

        current_cycle_started_at:
          now,

        supervisor_approved_at:
          null,

        supervisor_approved_by:
          null,

        reporter_confirmed_at:
          null,

        updated_at:
          now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "TICKET_REOPEN_FAILED",
    );
  }

  const {
    error: historyError,
  } = await supabase
    .from("ticket_history")
    .insert({
      organization_id:
        ticket.organization_id,

      ticket_id:
        ticket.id,

      actor_id:
        null,

      from_status:
        ticket.status,

      to_status:
        "REOPENED",

      reason:
        `${reason}\n\n${description}`,
    });

  if (historyError) {
    console.error(
      "History error:",
      historyError,
    );
  }

  if (body.attachment) {
    try {
      await uploadAttachment(
        supabase,
        ticket,
        body.attachment,
        "REPORT",
      );
    } catch (
      attachmentError
    ) {
      console.error(
        "Reopen attachment error:",
        attachmentError,
      );
    }
  }

  return getPublicTicket(
    supabase,
    trackingToken,
  );
}

async function rateTicket(
  supabase: SupabaseClientType,
  body: RequestBody,
) {
  const trackingToken =
    cleanString(
      body.trackingToken,
    ) ||
    cleanString(
      body.tracking_token,
    );

  const rating =
    Number(body.rating);

  const comment =
    cleanString(body.comment);

  if (!trackingToken) {
    throw new Error(
      "TRACKING_TOKEN_REQUIRED",
    );
  }

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new Error(
      "INVALID_RATING",
    );
  }

  const ticket =
    await findTicketByTrackingToken(
      supabase,
      trackingToken,
    );

  if (
    ticket.status !== "CLOSED"
  ) {
    throw new Error(
      "TICKET_MUST_BE_CLOSED",
    );
  }

  const {
    data: existingRating,
    error: existingRatingError,
  } = await supabase
    .from("ticket_ratings")
    .select("id")
    .eq(
      "ticket_id",
      ticket.id,
    )
    .maybeSingle();

  if (existingRatingError) {
    throw new Error(
      existingRatingError.message,
    );
  }

  if (existingRating) {
    throw new Error(
      "RATING_ALREADY_SUBMITTED",
    );
  }

  const { error } =
    await supabase
      .from("ticket_ratings")
      .insert({
        organization_id:
          ticket.organization_id,

        ticket_id:
          ticket.id,

        rating,

        comment,
      });

  if (error) {
    throw new Error(error.message);
  }

  return getPublicTicket(
    supabase,
    trackingToken,
  );
}

Deno.serve(
  async (request: Request) => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !== "POST"
    ) {
      return createResponse(
        {
          success:
            false,

          error:
            "هذه الخدمة تقبل طلبات POST فقط.",
        },
        405,
      );
    }

    try {
      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        return createResponse(
          {
            success:
              false,

            error:
              "إعدادات Supabase غير مكتملة.",
          },
          500,
        );
      }

      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,

              persistSession:
                false,
            },
          },
        );

      let body: RequestBody;

      try {
        body =
          await request.json();
      } catch {
        return createResponse(
          {
            success:
              false,

            error:
              "بيانات الطلب غير صالحة.",
          },
          400,
        );
      }

      const action =
        String(
          body.action || "",
        )
          .trim()
          .toLowerCase() as PublicAction;

      let result: unknown;

      switch (action) {
        case "resolve_asset":
          result =
            await resolveAsset(
              supabase,
              body,
            );
          break;

        case "create":
          result =
            await createTicket(
              supabase,
              body,
            );
          break;

        case "track":
          result =
            await trackTicket(
              supabase,
              body,
            );
          break;

        case "confirm_resolution":
          result =
            await confirmResolution(
              supabase,
              body,
            );
          break;

        case "reopen":
          result =
            await reopenTicket(
              supabase,
              body,
            );
          break;

        case "rate":
          result =
            await rateTicket(
              supabase,
              body,
            );
          break;

        default:
          return createResponse(
            {
              success:
                false,

              error:
                "نوع العملية المطلوبة غير صحيح.",
            },
            400,
          );
      }

      return createResponse({
        success:
          true,

        data:
          result,

        ...(
          typeof result ===
              "object" &&
            result !== null
            ? result
            : {}
        ),
      });
    } catch (error) {
      console.error(
        "public-ticket error:",
        error,
      );

      const message =
        normalizeError(error);

      const clientErrorPatterns = [
        "INVALID_",
        "NOT_FOUND",
        "REQUIRED",
        "DUPLICATE",
        "INACTIVE",
        "CANNOT",
        "MUST_BE",
        "ALREADY",
        "NOT_PENDING",
      ];

      const status =
        clientErrorPatterns.some(
          (pattern) =>
            message.includes(
              pattern,
            ),
        )
          ? 400
          : 500;

      return createResponse(
        {
          success:
            false,

          error:
            message,
        },
        status,
      );
    }
  },
);
