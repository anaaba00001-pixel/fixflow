import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseClientType =
  ReturnType<typeof createClient>;

type TicketPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EMERGENCY";

type CreateTicketBody = {
  assetToken?: string;
  asset_token?: string;

  qrToken?: string;
  qr_token?: string;

  title?: string;
  description?: string;
  priority?: string;

  reporterName?: string;
  reporter_name?: string;

  reporterContact?: string;
  reporter_contact?: string;

  reporterPhone?: string;
  reporter_phone?: string;

  reporterEmail?: string;
  reporter_email?: string;

  categoryId?: string;
  category_id?: string;
};

type ManagerRecord = {
  id: string;
  email: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const ALLOWED_PRIORITIES: TicketPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "EMERGENCY",
];

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

function cleanString(
  value: unknown,
  maximumLength = 5000,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(
    0,
    maximumLength,
  );
}

function normalizePriority(
  value: unknown,
): TicketPriority {
  const priority = String(
    value || "MEDIUM",
  )
    .trim()
    .toUpperCase() as TicketPriority;

  if (
    !ALLOWED_PRIORITIES.includes(
      priority,
    )
  ) {
    throw new Error(
      "INVALID_PRIORITY",
    );
  }

  return priority;
}

function normalizeError(
  error: unknown,
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (
        error as {
          message?: unknown;
        }
      ).message ||
        "حدث خطأ غير متوقع.",
    );
  }

  return "حدث خطأ غير متوقع.";
}

function validateEmail(
  email: string | null,
) {
  if (!email) {
    return;
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailPattern.test(email)
  ) {
    throw new Error(
      "INVALID_EMAIL",
    );
  }
}

function buildReporterContact(
  body: CreateTicketBody,
) {
  const directContact =
    cleanString(
      body.reporterContact ??
        body.reporter_contact,
      500,
    );

  const phone =
    cleanString(
      body.reporterPhone ??
        body.reporter_phone,
      100,
    );

  const email =
    cleanString(
      body.reporterEmail ??
        body.reporter_email,
      200,
    );

  validateEmail(email);

  return [
    directContact,

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

async function sha256(
  value: string,
) {
  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes,
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

function createTrackingToken() {
  const bytes =
    new Uint8Array(32);

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
  priority: TicketPriority,
) {
  const hoursByPriority: Record<
    TicketPriority,
    number
  > = {
    LOW: 72,
    MEDIUM: 24,
    HIGH: 8,
    EMERGENCY: 2,
  };

  const dueAt = new Date();

  dueAt.setHours(
    dueAt.getHours() +
      hoursByPriority[priority],
  );

  return dueAt.toISOString();
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
        last_value:
          nextValue,
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

async function createManagerNotifications(
  supabase: SupabaseClientType,
  ticket: {
    id: string;
    organization_id: string;
    priority: TicketPriority;
  },
) {
  const {
    data: managerData,
    error: managerError,
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

  if (managerError) {
    console.error(
      "Manager query error:",
      managerError,
    );

    return;
  }

  if (
    !managerData ||
    managerData.length === 0
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

        const emailNotification = {
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
        };

        return [
          inAppNotification,
          emailNotification,
        ];
      },
    );

  const {
    error: notificationError,
  } = await supabase
    .from("notifications")
    .insert(notifications);

  if (notificationError) {
    console.error(
      "Notification error:",
      notificationError,
    );
  }
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

          message:
            "هذه الخدمة تقبل طلبات POST فقط.",

          errorCode:
            "METHOD_NOT_ALLOWED",
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

            message:
              "إعدادات خدمة Supabase غير مكتملة.",

            errorCode:
              "SERVICE_NOT_CONFIGURED",
          },
          500,
        );
      }

      let body: CreateTicketBody;

      try {
        body =
          await request.json();
      } catch {
        return createResponse(
          {
            success:
              false,

            message:
              "صيغة البيانات المرسلة غير صحيحة.",

            errorCode:
              "INVALID_JSON",
          },
          400,
        );
      }

      const assetToken =
        cleanString(
          body.assetToken ??
            body.asset_token ??
            body.qrToken ??
            body.qr_token,
          256,
        );

      const title =
        cleanString(
          body.title,
          200,
        );

      const description =
        cleanString(
          body.description,
          3000,
        );

      const reporterName =
        cleanString(
          body.reporterName ??
            body.reporter_name,
          150,
        );

      let priority: TicketPriority;

      try {
        priority =
          normalizePriority(
            body.priority,
          );
      } catch {
        return createResponse(
          {
            success:
              false,

            message:
              "أولوية طلب الصيانة غير صحيحة.",

            errorCode:
              "INVALID_PRIORITY",
          },
          400,
        );
      }

      let reporterContact:
        | string
        | null;

      try {
        reporterContact =
          buildReporterContact(
            body,
          );
      } catch {
        return createResponse(
          {
            success:
              false,

            message:
              "عنوان البريد الإلكتروني غير صحيح.",

            errorCode:
              "INVALID_EMAIL",
          },
          400,
        );
      }

      if (!assetToken) {
        return createResponse(
          {
            success:
              false,

            message:
              "رمز الجهاز مطلوب.",

            errorCode:
              "ASSET_TOKEN_REQUIRED",
          },
          400,
        );
      }

      if (
        !title ||
        title.length < 3
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "عنوان الطلب يجب ألا يقل عن 3 أحرف.",

            errorCode:
              "INVALID_TITLE",
          },
          400,
        );
      }

      if (
        !description ||
        description.length < 10
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "وصف المشكلة يجب ألا يقل عن 10 أحرف.",

            errorCode:
              "INVALID_DESCRIPTION",
          },
          400,
        );
      }

      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false,
            },
          },
        );

      const assetTokenHash =
        await sha256(
          assetToken,
        );

      const {
        data: asset,
        error: assetError,
      } = await supabase
        .from("assets")
        .select(
          `
            id,
            organization_id,
            location_id,
            category_id,
            name,
            is_active,
            locations (
              id,
              is_active
            ),
            organizations (
              id,
              status
            )
          `,
        )
        .eq(
          "qr_token_hash",
          assetTokenHash,
        )
        .maybeSingle();

      if (
        assetError ||
        !asset
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "رمز الجهاز غير صحيح.",

            errorCode:
              "INVALID_ASSET_TOKEN",
          },
          404,
        );
      }

      if (
        asset.is_active === false
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "هذا الجهاز غير نشط.",

            errorCode:
              "ASSET_INACTIVE",
          },
          400,
        );
      }

      const location =
        Array.isArray(
          asset.locations,
        )
          ? asset.locations[0]
          : asset.locations;

      const organization =
        Array.isArray(
          asset.organizations,
        )
          ? asset.organizations[0]
          : asset.organizations;

      if (
        !location ||
        location.is_active === false
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "الموقع المرتبط بالجهاز غير نشط.",

            errorCode:
              "LOCATION_INACTIVE",
          },
          400,
        );
      }

      if (
        !organization ||
        organization.status !== "ACTIVE"
      ) {
        return createResponse(
          {
            success:
              false,

            message:
              "المنشأة المرتبطة بالجهاز غير نشطة.",

            errorCode:
              "ORGANIZATION_INACTIVE",
          },
          400,
        );
      }

      const requestedCategoryId =
        cleanString(
          body.categoryId ??
            body.category_id,
          100,
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
            "id, organization_id, is_active",
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

      const ticketNumber =
        await getNextTicketNumber(
          supabase,
          asset.organization_id,
        );

      const trackingToken =
        createTrackingToken();

      const trackingTokenHash =
        await sha256(
          trackingToken,
        );

      const now =
        new Date().toISOString();

      const {
        data: ticket,
        error: ticketError,
      } = await supabase
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

          created_at:
            now,

          updated_at:
            now,
        })
        .select(
          `
            id,
            organization_id,
            ticket_number,
            title,
            status,
            priority,
            due_at,
            created_at
          `,
        )
        .single();

      if (
        ticketError ||
        !ticket
      ) {
        throw new Error(
          ticketError?.message ||
            "تعذر إنشاء طلب الصيانة.",
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

      await createManagerNotifications(
        supabase,
        {
          id:
            ticket.id,

          organization_id:
            ticket.organization_id,

          priority:
            priority,
        },
      );

      return createResponse(
        {
          success:
            true,

          message:
            "تم إنشاء طلب الصيانة بنجاح.",

          data: {
            id:
              ticket.id,

            ticketNumber:
              ticket.ticket_number,

            ticket_number:
              ticket.ticket_number,

            status:
              ticket.status,

            priority:
              ticket.priority,

            dueAt:
              ticket.due_at,

            due_at:
              ticket.due_at,

            trackingToken,

            tracking_token:
              trackingToken,

            trackingPath:
              `/track/${trackingToken}`,
          },
        },
        201,
      );
    } catch (error) {
      console.error(
        "create-ticket failed:",
        error,
      );

      return createResponse(
        {
          success:
            false,

          message:
            "تعذر إنشاء طلب الصيانة الآن.",

          errorCode:
            "OPERATION_FAILED",

          details:
            normalizeError(error),
        },
        500,
      );
    }
  },
);