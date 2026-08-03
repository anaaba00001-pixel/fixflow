import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = [
  "PLATFORM_ADMIN",
  "ORGANIZATION_ADMIN",
  "SUPERVISOR",
];

const ALLOWED_CHANNELS = [
  "IN_APP",
  "EMAIL",
] as const;

type NotificationChannel =
  (typeof ALLOWED_CHANNELS)[number];

type RequestBody = {
  notificationId?: string;
  notification_id?: string;

  organizationId?: string;
  organization_id?: string;

  userId?: string;
  user_id?: string;

  ticketId?: string;
  ticket_id?: string;

  recipientEmail?: string;
  recipient_email?: string;

  type?: string;
  eventType?: string;
  event_type?: string;

  title?: string;
  message?: string;

  channel?: string;

  limit?: number;

  retryFailed?: boolean;
  retry_failed?: boolean;
};

type AuthorizationResult = {
  authorized: boolean;
  actorId: string | null;
  role: string | null;
  organizationId: string | null;
  isCron: boolean;
};

type NotificationRecord = {
  id: string;
  organization_id: string;
  user_id: string | null;
  ticket_id: string | null;
  channel: NotificationChannel;
  event_type: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

type ProfileRecord = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

type TicketRecord = {
  id: string;
  ticket_number: string;
  organization_id: string;
  title: string;
  status: string;
  priority: string;
  reporter_name: string | null;
  reporter_contact: string | null;
};

type NotificationTemplate = {
  title: string;
  message: string;
};

function createResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value: unknown) {
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

function normalizeChannel(
  value: unknown,
): NotificationChannel {
  const channel = String(
    value || "IN_APP",
  )
    .trim()
    .toUpperCase();

  if (
    !ALLOWED_CHANNELS.includes(
      channel as NotificationChannel,
    )
  ) {
    throw new Error(
      "قناة الإشعار غير صحيحة.",
    );
  }

  return channel as NotificationChannel;
}

function normalizeEventType(value: unknown) {
  const eventType = String(value || "")
    .trim()
    .toUpperCase();

  if (!eventType) {
    throw new Error(
      "نوع الإشعار مطلوب.",
    );
  }

  if (
    !/^[A-Z0-9_]{2,80}$/.test(eventType)
  ) {
    throw new Error(
      "نوع الإشعار غير صحيح.",
    );
  }

  return eventType;
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.trim().split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const emailMatch = value.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );

  return emailMatch?.[0] || null;
}

function validateEmail(email: string) {
  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error(
      "البريد الإلكتروني للمستلم غير صحيح.",
    );
  }
}

async function authorizeRequest(
  request: Request,
  supabase: SupabaseClient,
): Promise<AuthorizationResult> {
  const configuredCronSecret =
    Deno.env.get("CRON_SECRET");

  const providedCronSecret =
    request.headers.get(
      "x-cron-secret",
    );

  if (
    configuredCronSecret &&
    providedCronSecret ===
      configuredCronSecret
  ) {
    return {
      authorized: true,
      actorId: null,
      role: "CRON",
      organizationId: null,
      isCron: true,
    };
  }

  const token =
    getBearerToken(request);

  if (!token) {
    return {
      authorized: false,
      actorId: null,
      role: null,
      organizationId: null,
      isCron: false,
    };
  }

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser(token);

  if (
    authError ||
    !authData.user
  ) {
    return {
      authorized: false,
      actorId: null,
      role: null,
      organizationId: null,
      isCron: false,
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      `
        id,
        organization_id,
        role,
        is_active
      `,
    )
    .eq("id", authData.user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.is_active === false ||
    !ALLOWED_ROLES.includes(profile.role)
  ) {
    return {
      authorized: false,
      actorId: authData.user.id,
      role: profile?.role || null,
      organizationId:
        profile?.organization_id || null,
      isCron: false,
    };
  }

  return {
    authorized: true,
    actorId: profile.id,
    role: profile.role,
    organizationId:
      profile.organization_id,
    isCron: false,
  };
}

function canAccessOrganization(
  authorization: AuthorizationResult,
  organizationId: string,
) {
  if (authorization.isCron) {
    return true;
  }

  if (
    authorization.role ===
    "PLATFORM_ADMIN"
  ) {
    return true;
  }

  return (
    Boolean(authorization.organizationId) &&
    String(
      authorization.organizationId,
    ) === String(organizationId)
  );
}

async function getProfile(
  supabase: SupabaseClient,
  userId: string | null,
) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
        id,
        organization_id,
        full_name,
        email,
        role,
        is_active
      `,
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProfileRecord | null;
}

async function getTicket(
  supabase: SupabaseClient,
  ticketId: string | null,
) {
  if (!ticketId) {
    return null;
  }

  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
        id,
        ticket_number,
        organization_id,
        title,
        status,
        priority,
        reporter_name,
        reporter_contact
      `,
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as TicketRecord | null;
}

function buildTemplate(
  eventType: string,
  ticket: TicketRecord | null,
  profile: ProfileRecord | null,
): NotificationTemplate {
  const ticketNumber =
    ticket?.ticket_number ||
    ticket?.id ||
    "";

  const ticketTitle =
    ticket?.title || "طلب الصيانة";

  const technicianName =
    profile?.full_name || "فني الصيانة";

  switch (eventType) {
    case "TICKET_CREATED":
      return {
        title: "تم إنشاء طلب صيانة جديد",
        message:
          ticketNumber
            ? `تم إنشاء الطلب ${ticketNumber}: ${ticketTitle}`
            : "تم إنشاء طلب صيانة جديد.",
      };

    case "EMERGENCY_TICKET":
      return {
        title: "طلب صيانة طارئ",
        message:
          ticketNumber
            ? `يوجد طلب صيانة طارئ ${ticketNumber}: ${ticketTitle}`
            : "يوجد طلب صيانة طارئ جديد.",
      };

    case "TECHNICIAN_ASSIGNED":
      return {
        title: "تم تعيين طلب صيانة",
        message:
          ticketNumber
            ? `تم تعيين الطلب ${ticketNumber} إلى ${technicianName}: ${ticketTitle}`
            : "تم تعيين طلب صيانة جديد إليك.",
      };

    case "TICKET_ACCEPTED":
      return {
        title: "تم قبول طلب الصيانة",
        message:
          ticketNumber
            ? `تم قبول الطلب ${ticketNumber}.`
            : "تم قبول طلب الصيانة.",
      };

    case "WORK_STARTED":
      return {
        title: "بدأ العمل على الطلب",
        message:
          ticketNumber
            ? `بدأ الفني العمل على الطلب ${ticketNumber}.`
            : "بدأ الفني العمل على طلب الصيانة.",
      };

    case "WAITING_PARTS":
      return {
        title: "الطلب بانتظار قطع الغيار",
        message:
          ticketNumber
            ? `تم تعليق الطلب ${ticketNumber} حتى توفير قطع الغيار.`
            : "طلب الصيانة بانتظار قطع الغيار.",
      };

    case "WORK_RESUMED":
      return {
        title: "تم استئناف العمل",
        message:
          ticketNumber
            ? `تم استئناف العمل على الطلب ${ticketNumber}.`
            : "تم استئناف العمل على طلب الصيانة.",
      };

    case "TICKET_OVERDUE":
      return {
        title: "طلب صيانة متأخر",
        message:
          ticketNumber
            ? `تجاوز الطلب ${ticketNumber} وقت الاستحقاق: ${ticketTitle}`
            : "يوجد طلب صيانة تجاوز وقت الاستحقاق.",
      };

    case "REPAIR_COMPLETED":
    case "APPROVAL_REQUIRED":
      return {
        title: "اكتملت أعمال الصيانة",
        message:
          ticketNumber
            ? `اكتملت أعمال الطلب ${ticketNumber} وهو بانتظار الاعتماد.`
            : "اكتملت أعمال الصيانة وهي بانتظار الاعتماد.",
      };

    case "TICKET_CLOSED":
      return {
        title: "تم إغلاق طلب الصيانة",
        message:
          ticketNumber
            ? `تم إغلاق الطلب ${ticketNumber} بنجاح.`
            : "تم إغلاق طلب الصيانة بنجاح.",
      };

    case "TICKET_REOPENED":
      return {
        title: "أُعيد فتح طلب الصيانة",
        message:
          ticketNumber
            ? `تمت إعادة فتح الطلب ${ticketNumber}.`
            : "تمت إعادة فتح طلب الصيانة.",
      };

    case "TICKET_CANCELLED":
      return {
        title: "تم إلغاء طلب الصيانة",
        message:
          ticketNumber
            ? `تم إلغاء الطلب ${ticketNumber}.`
            : "تم إلغاء طلب الصيانة.",
      };

    case "DAILY_REPORT_READY":
      return {
        title: "التقرير اليومي جاهز",
        message:
          "تم إنشاء التقرير اليومي لنشاط الصيانة.",
      };

    case "MONTHLY_REPORT_READY":
      return {
        title: "التقرير الشهري جاهز",
        message:
          "تم إنشاء التقرير الشهري لنشاط الصيانة.",
      };

    default:
      return {
        title: "إشعار من FixFlow",
        message:
          ticketNumber
            ? `يوجد تحديث جديد على الطلب ${ticketNumber}.`
            : "يوجد تحديث جديد في نظام FixFlow.",
      };
  }
}

function createEmailHtml(
  title: string,
  message: string,
  ticket: TicketRecord | null,
) {
  const appUrl =
    Deno.env.get("APP_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "";

  const ticketLink =
    appUrl && ticket?.id
      ? `${appUrl.replace(
          /\/+$/,
          "",
        )}/tickets/${ticket.id}`
      : null;

  return `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

      <body
        style="
          margin: 0;
          padding: 24px;
          background: #f4f7f6;
          font-family: Arial, sans-serif;
          color: #203531;
        "
      >
        <div
          style="
            max-width: 620px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 14px;
            padding: 30px;
            border: 1px solid #e2e9e7;
          "
        >
          <h1
            style="
              margin: 0 0 18px;
              font-size: 24px;
            "
          >
            ${escapeHtml(title)}
          </h1>

          <p
            style="
              margin: 0;
              font-size: 16px;
              line-height: 1.8;
            "
          >
            ${escapeHtml(message)}
          </p>

          ${
            ticketLink
              ? `
                <p style="margin: 26px 0 0;">
                  <a
                    href="${escapeHtml(ticketLink)}"
                    style="
                      display: inline-block;
                      padding: 12px 22px;
                      border-radius: 9px;
                      background: #245d53;
                      color: #ffffff;
                      text-decoration: none;
                    "
                  >
                    عرض طلب الصيانة
                  </a>
                </p>
              `
              : ""
          }

          <p
            style="
              margin: 30px 0 0;
              padding-top: 20px;
              border-top: 1px solid #e2e9e7;
              color: #6c7e7a;
              font-size: 13px;
            "
          >
            تم إرسال هذه الرسالة تلقائيًا من نظام FixFlow.
          </p>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail({
  recipientEmail,
  title,
  message,
  ticket,
}: {
  recipientEmail: string;
  title: string;
  message: string;
  ticket: TicketRecord | null;
}) {
  const resendApiKey =
    Deno.env.get("RESEND_API_KEY");

  const emailFrom =
    Deno.env.get("EMAIL_FROM") ||
    "FixFlow <onboarding@resend.dev>";

  if (!resendApiKey) {
    throw new Error(
      "المتغير RESEND_API_KEY غير موجود في إعدادات Supabase.",
    );
  }

  validateEmail(recipientEmail);

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${resendApiKey}`,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        from: emailFrom,
        to: [recipientEmail],
        subject: title,
        html: createEmailHtml(
          title,
          message,
          ticket,
        ),
      }),
    },
  );

  const responseData =
    await response.json().catch(
      (): Record<string, unknown> => ({}),
    );

  if (!response.ok) {
    const errorMessage =
      typeof responseData.message === "string"
        ? responseData.message
        : `فشل إرسال البريد برمز ${response.status}.`;

    throw new Error(errorMessage);
  }

  return responseData;
}

async function markAsSent(
  supabase: SupabaseClient,
  notification: NotificationRecord,
) {
  const now =
    new Date().toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "SENT",
      attempts:
        Number(notification.attempts || 0) +
        1,
      last_error: null,
      sent_at: now,
    })
    .eq("id", notification.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as NotificationRecord;
}

async function markAsFailed(
  supabase: SupabaseClient,
  notification: NotificationRecord,
  errorMessage: string,
) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "FAILED",
      attempts:
        Number(notification.attempts || 0) +
        1,
      last_error:
        errorMessage.slice(0, 1000),
    })
    .eq("id", notification.id)
    .select("*")
    .single();

  if (error) {
    console.error(
      "Unable to mark notification as failed:",
      error,
    );

    return notification;
  }

  return data as NotificationRecord;
}

async function resolveRecipientEmail(
  profile: ProfileRecord | null,
  ticket: TicketRecord | null,
  customEmail: string | null,
) {
  const recipientEmail =
    customEmail ||
    profile?.email ||
    extractEmail(
      ticket?.reporter_contact || null,
    );

  if (!recipientEmail) {
    throw new Error(
      "لم يتم العثور على بريد إلكتروني للمستلم.",
    );
  }

  validateEmail(recipientEmail);

  return recipientEmail;
}

async function processNotification(
  supabase: SupabaseClient,
  notification: NotificationRecord,
  overrides: {
    recipientEmail?: string | null;
    title?: string | null;
    message?: string | null;
  } = {},
) {
  try {
    if (
      notification.status === "SENT"
    ) {
      return {
        notificationId:
          notification.id,
        status: "SKIPPED",
        reason:
          "تم إرسال الإشعار مسبقًا.",
      };
    }

    const [profile, ticket] =
      await Promise.all([
        getProfile(
          supabase,
          notification.user_id,
        ),

        getTicket(
          supabase,
          notification.ticket_id,
        ),
      ]);

    if (
      profile &&
      profile.is_active === false
    ) {
      throw new Error(
        "حساب مستلم الإشعار غير نشط.",
      );
    }

    const template = buildTemplate(
      notification.event_type,
      ticket,
      profile,
    );

    const title =
      overrides.title ||
      template.title;

    const message =
      overrides.message ||
      template.message;

    if (
      notification.channel === "EMAIL"
    ) {
      const recipientEmail =
        await resolveRecipientEmail(
          profile,
          ticket,
          overrides.recipientEmail ||
            null,
        );

      await sendEmail({
        recipientEmail,
        title,
        message,
        ticket,
      });
    }

    const updatedNotification =
      await markAsSent(
        supabase,
        notification,
      );

    return {
      notificationId:
        notification.id,

      channel:
        notification.channel,

      eventType:
        notification.event_type,

      status: "SENT",

      attempts:
        updatedNotification.attempts,
    };
  } catch (error) {
    const errorMessage =
      normalizeError(error);

    await markAsFailed(
      supabase,
      notification,
      errorMessage,
    );

    return {
      notificationId:
        notification.id,

      channel:
        notification.channel,

      eventType:
        notification.event_type,

      status: "FAILED",

      error: errorMessage,
    };
  }
}

async function getNotificationById(
  supabase: SupabaseClient,
  notificationId: string,
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (error || !data) {
    throw new Error(
      "لم يتم العثور على الإشعار.",
    );
  }

  return data as NotificationRecord;
}

async function createNotification(
  supabase: SupabaseClient,
  body: RequestBody,
) {
  const organizationId =
    cleanString(body.organizationId) ||
    cleanString(body.organization_id);

  if (!organizationId) {
    throw new Error(
      "معرّف المنشأة مطلوب.",
    );
  }

  const userId =
    cleanString(body.userId) ||
    cleanString(body.user_id);

  const ticketId =
    cleanString(body.ticketId) ||
    cleanString(body.ticket_id);

  const channel =
    normalizeChannel(body.channel);

  const eventType =
    normalizeEventType(
      body.eventType ||
        body.event_type ||
        body.type,
    );

  if (
    channel === "IN_APP" &&
    !userId
  ) {
    throw new Error(
      "معرّف المستخدم مطلوب للإشعار الداخلي.",
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      organization_id:
        organizationId,

      user_id: userId,

      ticket_id: ticketId,

      channel,

      event_type: eventType,

      status: "PENDING",

      attempts: 0,

      last_error: null,

      sent_at: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "تعذر إنشاء الإشعار.",
    );
  }

  return data as NotificationRecord;
}

async function getPendingNotifications(
  supabase: SupabaseClient,
  authorization: AuthorizationResult,
  limit: number,
  retryFailed: boolean,
) {
  let query = supabase
    .from("notifications")
    .select("*")
    .in(
      "status",
      retryFailed
        ? ["PENDING", "FAILED"]
        : ["PENDING"],
    )
    .lt("attempts", 5)
    .order("created_at", {
      ascending: true,
    })
    .limit(limit);

  if (
    !authorization.isCron &&
    authorization.role !==
      "PLATFORM_ADMIN"
  ) {
    query = query.eq(
      "organization_id",
      authorization.organizationId,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (
    data || []
  ) as NotificationRecord[];
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return createResponse(
      {
        success: false,
        error:
          "هذه الخدمة تقبل طلبات POST فقط.",
      },
      405,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

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
          success: false,
          error:
            "إعدادات Supabase غير مكتملة داخل Edge Function.",
        },
        500,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authorization =
      await authorizeRequest(
        request,
        supabase,
      );

    if (!authorization.authorized) {
      return createResponse(
        {
          success: false,
          error:
            "غير مصرح بإرسال الإشعارات.",
        },
        401,
      );
    }

    let body: RequestBody;

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const notificationId =
      cleanString(body.notificationId) ||
      cleanString(body.notification_id);

    const hasDirectNotification =
      Boolean(
        body.organizationId ||
          body.organization_id,
      ) &&
      Boolean(
        body.eventType ||
          body.event_type ||
          body.type,
      );

    if (notificationId) {
      const notification =
        await getNotificationById(
          supabase,
          notificationId,
        );

      if (
        !canAccessOrganization(
          authorization,
          notification.organization_id,
        )
      ) {
        return createResponse(
          {
            success: false,
            error:
              "لا يمكنك إرسال إشعار تابع لمنشأة أخرى.",
          },
          403,
        );
      }

      const result =
        await processNotification(
          supabase,
          notification,
          {
            recipientEmail:
              cleanString(
                body.recipientEmail,
              ) ||
              cleanString(
                body.recipient_email,
              ),

            title:
              cleanString(body.title),

            message:
              cleanString(body.message),
          },
        );

      return createResponse({
        success:
          result.status === "SENT" ||
          result.status === "SKIPPED",

        result,
      });
    }

    if (hasDirectNotification) {
      const organizationId =
        cleanString(
          body.organizationId,
        ) ||
        cleanString(
          body.organization_id,
        );

      if (
        !organizationId ||
        !canAccessOrganization(
          authorization,
          organizationId,
        )
      ) {
        return createResponse(
          {
            success: false,
            error:
              "لا يمكنك إنشاء إشعار لمنشأة أخرى.",
          },
          403,
        );
      }

      const notification =
        await createNotification(
          supabase,
          body,
        );

      const result =
        await processNotification(
          supabase,
          notification,
          {
            recipientEmail:
              cleanString(
                body.recipientEmail,
              ) ||
              cleanString(
                body.recipient_email,
              ),

            title:
              cleanString(body.title),

            message:
              cleanString(body.message),
          },
        );

      return createResponse(
        {
          success:
            result.status === "SENT",

          notification,

          result,
        },
        result.status === "SENT"
          ? 200
          : 500,
      );
    }

    const requestedLimit =
      Number(body.limit) || 50;

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      200,
    );

    const retryFailed =
      body.retryFailed ??
      body.retry_failed ??
      true;

    const notifications =
      await getPendingNotifications(
        supabase,
        authorization,
        limit,
        retryFailed,
      );

    const results = [];

    for (
      const notification of notifications
    ) {
      const result =
        await processNotification(
          supabase,
          notification,
        );

      results.push(result);
    }

    const sentCount =
      results.filter(
        (result) =>
          result.status === "SENT",
      ).length;

    const failedCount =
      results.filter(
        (result) =>
          result.status === "FAILED",
      ).length;

    const skippedCount =
      results.filter(
        (result) =>
          result.status === "SKIPPED",
      ).length;

    return createResponse({
      success: failedCount === 0,

      message:
        notifications.length === 0
          ? "لا توجد إشعارات معلقة للإرسال."
          : `تمت معالجة ${notifications.length} إشعار.`,

      summary: {
        found: notifications.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      },

      results,

      processedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "send-notification error:",
      error,
    );

    return createResponse(
      {
        success: false,
        error: normalizeError(error),
      },
      500,
    );
  }
});