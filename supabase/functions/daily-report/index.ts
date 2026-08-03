import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const OPEN_TICKET_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

const PRIORITIES = [
  "EMERGENCY",
  "HIGH",
  "MEDIUM",
  "LOW",
];

type RequestBody = {
  organizationId?: string;
  organization_id?: string;
  date?: string;
  timezone?: string;
  notifyManagers?: boolean;
  notify_managers?: boolean;
};

type AuthorizationResult = {
  authorized: boolean;
  actorId: string | null;
  actorName: string;
  role: string | null;
  organizationId: string | null;
  isCron: boolean;
};

type Organization = {
  id: string;
  name: string;
  status: string;
};

type CreatedTicket = {
  id: string;
  ticket_number: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
  locations:
    | {
        id: string;
        name: string;
      }
    | null;
  assets:
    | {
        id: string;
        name: string;
        asset_number: string | null;
      }
    | null;
};

type RatingRecord = {
  rating: number;
};

type ManagerRecord = {
  id: string;
  email: string | null;
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

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
}

function addDays(
  dateKey: string,
  amount: number,
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  date.setUTCDate(
    date.getUTCDate() + amount,
  );

  return date.toISOString().slice(0, 10);
}

function getTimeZoneParts(
  date: Date,
  timeZone: string,
) {
  const formatter =
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

  const parts = formatter.formatToParts(
    date,
  );

  const values: Record<string, string> =
    {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffset(
  date: Date,
  timeZone: string,
) {
  const parts = getTimeZoneParts(
    date,
    timeZone,
  );

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return representedAsUtc -
    date.getTime();
}

function localMidnightToUtc(
  dateKey: string,
  timeZone: string,
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const utcGuess = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    ),
  );

  const firstOffset =
    getTimeZoneOffset(
      utcGuess,
      timeZone,
    );

  let result = new Date(
    utcGuess.getTime() - firstOffset,
  );

  const secondOffset =
    getTimeZoneOffset(
      result,
      timeZone,
    );

  if (firstOffset !== secondOffset) {
    result = new Date(
      utcGuess.getTime() - secondOffset,
    );
  }

  return result;
}

function getPreviousDateKey(
  timeZone: string,
) {
  const nowParts = getTimeZoneParts(
    new Date(),
    timeZone,
  );

  const todayKey = [
    nowParts.year,
    String(nowParts.month).padStart(2, "0"),
    String(nowParts.day).padStart(2, "0"),
  ].join("-");

  return addDays(todayKey, -1);
}

function getReportPeriod(
  requestedDate: string | null,
  timeZone: string,
) {
  const dateKey =
    requestedDate ||
    getPreviousDateKey(timeZone);

  if (!isValidDateKey(dateKey)) {
    throw new Error(
      "صيغة تاريخ التقرير يجب أن تكون YYYY-MM-DD.",
    );
  }

  const nextDateKey =
    addDays(dateKey, 1);

  const start =
    localMidnightToUtc(
      dateKey,
      timeZone,
    );

  const end =
    localMidnightToUtc(
      nextDateKey,
      timeZone,
    );

  return {
    dateKey,
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone,
  };
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
      actorName: "النظام الآلي",
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
      actorName: "",
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
      actorName: "",
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
        full_name,
        email,
        role,
        is_active
      `,
    )
    .eq("id", authData.user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.is_active === false
  ) {
    return {
      authorized: false,
      actorId: null,
      actorName: "",
      role: null,
      organizationId: null,
      isCron: false,
    };
  }

  const allowedRoles = [
    "PLATFORM_ADMIN",
    "ORGANIZATION_ADMIN",
    "SUPERVISOR",
  ];

  if (
    !allowedRoles.includes(profile.role)
  ) {
    return {
      authorized: false,
      actorId: null,
      actorName: "",
      role: profile.role,
      organizationId:
        profile.organization_id,
      isCron: false,
    };
  }

  return {
    authorized: true,
    actorId: profile.id,
    actorName:
      profile.full_name ||
      profile.email ||
      "مدير النظام",
    role: profile.role,
    organizationId:
      profile.organization_id,
    isCron: false,
  };
}

async function getOrganizations(
  supabase: SupabaseClient,
  authorization: AuthorizationResult,
  requestedOrganizationId: string | null,
) {
  let query = supabase
    .from("organizations")
    .select("id, name, status")
    .eq("status", "ACTIVE")
    .order("name");

  if (
    authorization.role !==
      "PLATFORM_ADMIN" &&
    !authorization.isCron
  ) {
    if (!authorization.organizationId) {
      return [];
    }

    query = query.eq(
      "id",
      authorization.organizationId,
    );
  } else if (requestedOrganizationId) {
    query = query.eq(
      "id",
      requestedOrganizationId,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const organizations =
    (data || []) as Organization[];

  if (
    requestedOrganizationId &&
    organizations.length === 0
  ) {
    throw new Error(
      "المنشأة المطلوبة غير موجودة أو غير نشطة.",
    );
  }

  return organizations;
}

async function countByDateField(
  supabase: SupabaseClient,
  organizationId: string,
  field: string,
  start: string,
  end: string,
) {
  const { count, error } =
    await supabase
      .from("tickets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .gte(field, start)
      .lt(field, end);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

async function getCreatedTickets(
  supabase: SupabaseClient,
  organizationId: string,
  start: string,
  end: string,
) {
  const { data, error } =
    await supabase
      .from("tickets")
      .select(
        `
          id,
          ticket_number,
          title,
          priority,
          status,
          created_at,
          locations (
            id,
            name
          ),
          assets (
            id,
            name,
            asset_number
          )
        `,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", {
        ascending: false,
      })
      .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as CreatedTicket[];
}

async function getOpenTicketsCount(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { count, error } =
    await supabase
      .from("tickets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .in(
        "status",
        OPEN_TICKET_STATUSES,
      );

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

async function getOverdueTicketsCount(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { count, error } =
    await supabase
      .from("tickets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("is_overdue", true)
      .in(
        "status",
        OPEN_TICKET_STATUSES,
      );

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

async function getReopenedTicketsCount(
  supabase: SupabaseClient,
  organizationId: string,
  start: string,
  end: string,
) {
  const { count, error } =
    await supabase
      .from("ticket_history")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("to_status", "REOPENED")
      .gte("created_at", start)
      .lt("created_at", end);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

async function getRatingsSummary(
  supabase: SupabaseClient,
  organizationId: string,
  start: string,
  end: string,
) {
  const { data, error } =
    await supabase
      .from("ticket_ratings")
      .select("rating")
      .eq(
        "organization_id",
        organizationId,
      )
      .gte("created_at", start)
      .lt("created_at", end);

  if (error) {
    throw new Error(error.message);
  }

  const ratings = (
    (data || []) as RatingRecord[]
  )
    .map((item: RatingRecord) =>
      Number(item.rating)
    )
    .filter((rating: number) =>
      Number.isFinite(rating)
    );

  const total = ratings.reduce(
    (sum: number, rating: number) =>
      sum + rating,
    0
  );

  return {
    ratingsCount: ratings.length,

    averageRating:
      ratings.length > 0
        ? Number(
            (
              total / ratings.length
            ).toFixed(1),
          )
        : 0,

    lowRatingsCount:
      ratings.filter(
        (rating: number) => rating <= 2
      ).length,
  };
}

function countCreatedByPriority(
  tickets: CreatedTicket[],
) {
  return PRIORITIES.reduce(
    (
      result: Record<string, number>,
      priority,
    ) => {
      result[priority] =
        tickets.filter(
          (ticket) =>
            ticket.priority === priority,
        ).length;

      return result;
    },
    {},
  );
}

function createCriticalTickets(
  tickets: CreatedTicket[],
) {
  return tickets
    .filter((ticket) =>
      [
        "EMERGENCY",
        "HIGH",
      ].includes(ticket.priority),
    )
    .slice(0, 10)
    .map((ticket) => ({
      id: ticket.id,

      ticketNumber:
        ticket.ticket_number,

      title: ticket.title,

      priority: ticket.priority,

      status: ticket.status,

      location:
        ticket.locations?.name ||
        "موقع غير محدد",

      asset:
        ticket.assets?.name ||
        "جهاز غير محدد",

      assetNumber:
        ticket.assets?.asset_number ||
        null,

      createdAt:
        ticket.created_at,
    }));
}

async function createReportForOrganization(
  supabase: SupabaseClient,
  organization: Organization,
  period: ReturnType<
    typeof getReportPeriod
  >,
) {
  const [
    createdTickets,
    assignedCount,
    startedCount,
    completedCount,
    closedCount,
    cancelledCount,
    reopenedCount,
    openCount,
    overdueCount,
    ratings,
  ] = await Promise.all([
    getCreatedTickets(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),

    countByDateField(
      supabase,
      organization.id,
      "assigned_at",
      period.start,
      period.end,
    ),

    countByDateField(
      supabase,
      organization.id,
      "started_at",
      period.start,
      period.end,
    ),

    countByDateField(
      supabase,
      organization.id,
      "completed_at",
      period.start,
      period.end,
    ),

    countByDateField(
      supabase,
      organization.id,
      "closed_at",
      period.start,
      period.end,
    ),

    countByDateField(
      supabase,
      organization.id,
      "cancelled_at",
      period.start,
      period.end,
    ),

    getReopenedTicketsCount(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),

    getOpenTicketsCount(
      supabase,
      organization.id,
    ),

    getOverdueTicketsCount(
      supabase,
      organization.id,
    ),

    getRatingsSummary(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),
  ]);

  const priorityDistribution =
    countCreatedByPriority(
      createdTickets,
    );

  return {
    organization: {
      id: organization.id,
      name: organization.name,
    },

    reportType: "DAILY",

    date: period.dateKey,

    timezone: period.timeZone,

    periodStart: period.start,

    periodEnd: period.end,

    summary: {
      createdTickets:
        createdTickets.length,

      emergencyTickets:
        priorityDistribution.EMERGENCY ||
        0,

      highPriorityTickets:
        priorityDistribution.HIGH || 0,

      assignedTickets:
        assignedCount,

      startedTickets:
        startedCount,

      completedTickets:
        completedCount,

      closedTickets:
        closedCount,

      cancelledTickets:
        cancelledCount,

      reopenedTickets:
        reopenedCount,

      currentOpenTickets:
        openCount,

      currentOverdueTickets:
        overdueCount,

      ratingsCount:
        ratings.ratingsCount,

      averageRating:
        ratings.averageRating,

      lowRatingsCount:
        ratings.lowRatingsCount,
    },

    createdByPriority:
      priorityDistribution,

    criticalTickets:
      createCriticalTickets(
        createdTickets,
      ),

    generatedAt:
      new Date().toISOString(),
  };
}

async function createManagerNotifications(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data: managers, error } =
    await supabase
      .from("profiles")
      .select("id, email")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("is_active", true)
      .in("role", [
        "ORGANIZATION_ADMIN",
        "SUPERVISOR",
      ]);

  if (error) {
    throw new Error(error.message);
  }

  if (!managers?.length) {
    return 0;
  }

  const now =
    new Date().toISOString();

  const notifications = (
    managers as ManagerRecord[]
  ).flatMap((manager: ManagerRecord) => {
      const inAppNotification = {
        organization_id:
          organizationId,

        user_id: manager.id,

        ticket_id: null,

        channel: "IN_APP",

        event_type:
          "DAILY_REPORT_READY",

        status: "SENT",

        attempts: 0,

        last_error: null,

        sent_at: now,

        created_at: now,
      };

      if (!manager.email) {
        return [inAppNotification];
      }

      return [
        inAppNotification,

        {
          organization_id:
            organizationId,

          user_id: manager.id,

          ticket_id: null,

          channel: "EMAIL",

          event_type:
            "DAILY_REPORT_READY",

          status: "PENDING",

          attempts: 0,

          last_error: null,

          sent_at: null,

          created_at: now,
        },
      ];
    });

  const {
    error: notificationError,
  } = await supabase
    .from("notifications")
    .insert(notifications);

  if (notificationError) {
    throw new Error(
      notificationError.message,
    );
  }

  return notifications.length;
}

async function createAuditLog(
  supabase: SupabaseClient,
  report: Record<string, unknown>,
  organizationId: string,
  actorId: string | null,
) {
  const { error } = await supabase
    .from("audit_logs")
    .insert({
      organization_id:
        organizationId,

      actor_id: actorId,

      action:
        "DAILY_REPORT_GENERATED",

      entity_type: "REPORT",

      entity_id: null,

      old_values: null,

      new_values: report,
    });

  if (error) {
    console.error(
      "Daily report audit log error:",
      error,
    );
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (
    request.method !== "GET" &&
    request.method !== "POST"
  ) {
    return createResponse(
      {
        success: false,
        error:
          "هذه الخدمة تقبل طلبات GET أو POST فقط.",
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
            "غير مصرح بإنشاء التقرير اليومي.",
        },
        401,
      );
    }

    let body: RequestBody = {};

    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const requestUrl =
      new URL(request.url);

    const requestedOrganizationId =
      cleanString(
        body.organizationId ||
          body.organization_id ||
          requestUrl.searchParams.get(
            "organizationId",
          ),
      );

    if (
      requestedOrganizationId &&
      authorization.role !==
        "PLATFORM_ADMIN" &&
      !authorization.isCron &&
      String(
        requestedOrganizationId,
      ) !==
        String(
          authorization.organizationId,
        )
    ) {
      return createResponse(
        {
          success: false,
          error:
            "لا يمكنك إنشاء تقرير لمنشأة أخرى.",
        },
        403,
      );
    }

    const timezone =
      cleanString(
        body.timezone ||
          requestUrl.searchParams.get(
            "timezone",
          ),
      ) || "Asia/Riyadh";

    try {
      new Intl.DateTimeFormat("en", {
        timeZone: timezone,
      }).format();
    } catch {
      return createResponse(
        {
          success: false,
          error:
            "المنطقة الزمنية غير صحيحة.",
        },
        400,
      );
    }

    const requestedDate =
      cleanString(
        body.date ||
          requestUrl.searchParams.get(
            "date",
          ),
      );

    const notifyManagers =
      body.notifyManagers ??
      body.notify_managers ??
      requestUrl.searchParams.get(
        "notifyManagers",
      ) !== "false";

    const period =
      getReportPeriod(
        requestedDate,
        timezone,
      );

    const organizations =
      await getOrganizations(
        supabase,
        authorization,
        requestedOrganizationId,
      );

    const reports = [];
    const failures = [];

    for (
      const organization of organizations
    ) {
      try {
        const report =
          await createReportForOrganization(
            supabase,
            organization,
            period,
          );

        let notificationsCreated = 0;

        if (notifyManagers) {
          notificationsCreated =
            await createManagerNotifications(
              supabase,
              organization.id,
            );
        }

        await createAuditLog(
          supabase,
          report,
          organization.id,
          authorization.actorId,
        );

        reports.push({
          ...report,
          notificationsCreated,
        });
      } catch (error) {
        console.error(
          `Daily report failed for organization ${organization.id}:`,
          error,
        );

        failures.push({
          organizationId:
            organization.id,

          organizationName:
            organization.name,

          error:
            normalizeError(error),
        });
      }
    }

    return createResponse({
      success: failures.length === 0,

      message:
        organizations.length === 0
          ? "لا توجد منشآت متاحة لإنشاء التقرير."
          : `تم إنشاء ${reports.length} تقرير يومي.`,

      date: period.dateKey,

      timezone: period.timeZone,

      periodStart: period.start,

      periodEnd: period.end,

      reportsCreated:
        reports.length,

      reportsFailed:
        failures.length,

      reports,

      failures,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "daily-report error:",
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
