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

const STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
  "CLOSED",
  "CANCELLED",
];

type RequestBody = {
  organizationId?: string;
  organization_id?: string;
  year?: number;
  month?: number;
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

type NamedRelation = {
  id: string;
  name: string;
};

type AssetRelation = {
  id: string;
  name: string;
  asset_number: string | null;
};

type TechnicianRelation = {
  id: string;
  full_name: string;
};

type TicketRecord = {
  id: string;
  ticket_number: string;
  organization_id: string;
  location_id: string;
  asset_id: string;
  assigned_technician_id: string | null;
  title: string;
  priority: string;
  status: string;
  estimated_cost: number | string | null;
  is_overdue: boolean;
  created_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  locations:
    | NamedRelation
    | NamedRelation[]
    | null;
  assets:
    | AssetRelation
    | AssetRelation[]
    | null;
  profiles:
    | TechnicianRelation
    | TechnicianRelation[]
    | null;
};

type RatingRecord = {
  rating: number;
};

type ManagerRecord = {
  id: string;
  email: string | null;
};

type DistributionItem = {
  key: string;
  value: number;
};

type WorkloadItem = {
  id: string;
  name: string;
  totalTickets: number;
  closedTickets: number;
  overdueTickets: number;
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

function getFirstRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function getTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function calculateDurationMinutes(
  start: string | null,
  end: string | null,
) {
  const startTimestamp =
    getTimestamp(start);

  const endTimestamp =
    getTimestamp(end);

  if (
    startTimestamp <= 0 ||
    endTimestamp <= 0 ||
    endTimestamp < startTimestamp
  ) {
    return null;
  }

  return Math.round(
    (endTimestamp - startTimestamp) /
      60000,
  );
}

function calculateAverage(
  values: number[],
) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce(
    (sum: number, value: number) =>
      sum + value,
    0,
  );

  return total / values.length;
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

  const parts =
    formatter.formatToParts(date);

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

function localDateToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
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

function getPreviousMonth(
  timeZone: string,
) {
  const currentParts =
    getTimeZoneParts(
      new Date(),
      timeZone,
    );

  let year = currentParts.year;
  let month = currentParts.month - 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return {
    year,
    month,
  };
}

function getReportPeriod(
  requestedYear: number | undefined,
  requestedMonth: number | undefined,
  timeZone: string,
) {
  const previousMonth =
    getPreviousMonth(timeZone);

  const year =
    requestedYear || previousMonth.year;

  const month =
    requestedMonth || previousMonth.month;

  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new Error(
      "سنة التقرير غير صحيحة.",
    );
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "شهر التقرير يجب أن يكون من 1 إلى 12.",
    );
  }

  const nextMonth =
    month === 12 ? 1 : month + 1;

  const nextMonthYear =
    month === 12 ? year + 1 : year;

  const start = localDateToUtc(
    year,
    month,
    1,
    timeZone,
  );

  const end = localDateToUtc(
    nextMonthYear,
    nextMonth,
    1,
    timeZone,
  );

  return {
    year,
    month,
    monthKey:
      `${year}-${String(month).padStart(
        2,
        "0",
      )}`,

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
      actorId: profile.id,
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
          organization_id,
          location_id,
          asset_id,
          assigned_technician_id,
          title,
          priority,
          status,
          estimated_cost,
          is_overdue,
          created_at,
          assigned_at,
          accepted_at,
          started_at,
          completed_at,
          closed_at,
          cancelled_at,
          locations (
            id,
            name
          ),
          assets (
            id,
            name,
            asset_number
          ),
          profiles (
            id,
            full_name
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
      .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as TicketRecord[];
}

async function getPerformanceTickets(
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
          organization_id,
          location_id,
          asset_id,
          assigned_technician_id,
          title,
          priority,
          status,
          estimated_cost,
          is_overdue,
          created_at,
          assigned_at,
          accepted_at,
          started_at,
          completed_at,
          closed_at,
          cancelled_at,
          locations (
            id,
            name
          ),
          assets (
            id,
            name,
            asset_number
          ),
          profiles (
            id,
            full_name
          )
        `,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .or(
        [
          `completed_at.gte.${start}`,
          `closed_at.gte.${start}`,
        ].join(","),
      )
      .or(
        [
          `completed_at.lt.${end}`,
          `closed_at.lt.${end}`,
        ].join(","),
      )
      .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as TicketRecord[];
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

async function getCurrentOpenCount(
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

async function getCurrentOverdueCount(
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

async function getReopenedCount(
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

async function getRatings(
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

  return (data || []) as RatingRecord[];
}

function createDistribution(
  tickets: TicketRecord[],
  field: "priority" | "status",
  values: string[],
): DistributionItem[] {
  return values.map(
    (value: string) => ({
      key: value,

      value: tickets.filter(
        (ticket: TicketRecord) =>
          ticket[field] === value,
      ).length,
    }),
  );
}

function createLocationWorkload(
  tickets: TicketRecord[],
) {
  const workload = new Map<
    string,
    WorkloadItem
  >();

  tickets.forEach(
    (ticket: TicketRecord) => {
      const location =
        getFirstRelation(
          ticket.locations,
        );

      const locationId =
        location?.id ||
        ticket.location_id;

      const key = String(locationId);

      if (!workload.has(key)) {
        workload.set(key, {
          id: locationId,
          name:
            location?.name ||
            "موقع غير محدد",
          totalTickets: 0,
          closedTickets: 0,
          overdueTickets: 0,
        });
      }

      const item =
        workload.get(key);

      if (!item) {
        return;
      }

      item.totalTickets += 1;

      if (ticket.status === "CLOSED") {
        item.closedTickets += 1;
      }

      if (ticket.is_overdue) {
        item.overdueTickets += 1;
      }
    },
  );

  return [...workload.values()]
    .sort(
      (
        first: WorkloadItem,
        second: WorkloadItem,
      ) =>
        second.totalTickets -
        first.totalTickets,
    )
    .slice(0, 10);
}

function createAssetWorkload(
  tickets: TicketRecord[],
) {
  const workload = new Map<
    string,
    {
      id: string;
      name: string;
      assetNumber: string | null;
      totalTickets: number;
      closedTickets: number;
      overdueTickets: number;
      estimatedCost: number;
    }
  >();

  tickets.forEach(
    (ticket: TicketRecord) => {
      const asset =
        getFirstRelation(ticket.assets);

      const assetId =
        asset?.id || ticket.asset_id;

      const key = String(assetId);

      if (!workload.has(key)) {
        workload.set(key, {
          id: assetId,
          name:
            asset?.name ||
            "جهاز غير محدد",

          assetNumber:
            asset?.asset_number || null,

          totalTickets: 0,
          closedTickets: 0,
          overdueTickets: 0,
          estimatedCost: 0,
        });
      }

      const item = workload.get(key);

      if (!item) {
        return;
      }

      item.totalTickets += 1;

      if (ticket.status === "CLOSED") {
        item.closedTickets += 1;
      }

      if (ticket.is_overdue) {
        item.overdueTickets += 1;
      }

      item.estimatedCost +=
        Number(ticket.estimated_cost || 0);
    },
  );

  return [...workload.values()]
    .sort(
      (
        first,
        second,
      ) =>
        second.totalTickets -
        first.totalTickets,
    )
    .slice(0, 10);
}

function createTechnicianWorkload(
  tickets: TicketRecord[],
) {
  const workload = new Map<
    string,
    WorkloadItem
  >();

  tickets.forEach(
    (ticket: TicketRecord) => {
      if (
        !ticket.assigned_technician_id
      ) {
        return;
      }

      const technician =
        getFirstRelation(
          ticket.profiles,
        );

      const technicianId =
        technician?.id ||
        ticket.assigned_technician_id;

      const key =
        String(technicianId);

      if (!workload.has(key)) {
        workload.set(key, {
          id: technicianId,
          name:
            technician?.full_name ||
            "فني غير محدد",
          totalTickets: 0,
          closedTickets: 0,
          overdueTickets: 0,
        });
      }

      const item =
        workload.get(key);

      if (!item) {
        return;
      }

      item.totalTickets += 1;

      if (ticket.status === "CLOSED") {
        item.closedTickets += 1;
      }

      if (ticket.is_overdue) {
        item.overdueTickets += 1;
      }
    },
  );

  return [...workload.values()]
    .sort(
      (
        first: WorkloadItem,
        second: WorkloadItem,
      ) =>
        second.closedTickets -
        first.closedTickets,
    )
    .slice(0, 10);
}

function createPerformanceSummary(
  tickets: TicketRecord[],
) {
  const responseDurations: number[] = [];
  const repairDurations: number[] = [];

  tickets.forEach(
    (ticket: TicketRecord) => {
      const responseDuration =
        calculateDurationMinutes(
          ticket.created_at,
          ticket.assigned_at ||
            ticket.accepted_at ||
            ticket.started_at,
        );

      if (responseDuration !== null) {
        responseDurations.push(
          responseDuration,
        );
      }

      const repairDuration =
        calculateDurationMinutes(
          ticket.started_at ||
            ticket.accepted_at,
          ticket.completed_at ||
            ticket.closed_at,
        );

      if (repairDuration !== null) {
        repairDurations.push(
          repairDuration,
        );
      }
    },
  );

  return {
    measuredResponseTickets:
      responseDurations.length,

    measuredRepairTickets:
      repairDurations.length,

    averageResponseMinutes:
      Math.round(
        calculateAverage(
          responseDurations,
        ),
      ),

    averageRepairMinutes:
      Math.round(
        calculateAverage(
          repairDurations,
        ),
      ),
  };
}

function createRatingSummary(
  ratings: RatingRecord[],
) {
  const values = ratings
    .map(
      (rating: RatingRecord) =>
        Number(rating.rating),
    )
    .filter(
      (rating: number) =>
        Number.isFinite(rating) &&
        rating >= 1 &&
        rating <= 5,
    );

  return {
    ratingsCount: values.length,

    averageRating:
      values.length > 0
        ? Number(
            calculateAverage(
              values,
            ).toFixed(1),
          )
        : 0,

    lowRatingsCount:
      values.filter(
        (rating: number) =>
          rating <= 2,
      ).length,

    distribution: [5, 4, 3, 2, 1].map(
      (rating: number) => ({
        rating,

        count: values.filter(
          (value: number) =>
            value === rating,
        ).length,
      }),
    ),
  };
}

async function createMonthlyReport(
  supabase: SupabaseClient,
  organization: Organization,
  period: ReturnType<
    typeof getReportPeriod
  >,
) {
  const [
    createdTickets,
    performanceTickets,
    assignedCount,
    startedCount,
    completedCount,
    closedCount,
    cancelledCount,
    reopenedCount,
    currentOpenCount,
    currentOverdueCount,
    ratings,
  ] = await Promise.all([
    getCreatedTickets(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),

    getPerformanceTickets(
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

    getReopenedCount(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),

    getCurrentOpenCount(
      supabase,
      organization.id,
    ),

    getCurrentOverdueCount(
      supabase,
      organization.id,
    ),

    getRatings(
      supabase,
      organization.id,
      period.start,
      period.end,
    ),
  ]);

  const performance =
    createPerformanceSummary(
      performanceTickets,
    );

  const ratingSummary =
    createRatingSummary(ratings);

  const estimatedCost =
    createdTickets.reduce(
      (
        total: number,
        ticket: TicketRecord,
      ) =>
        total +
        Number(
          ticket.estimated_cost || 0,
        ),
      0,
    );

  const emergencyCount =
    createdTickets.filter(
      (ticket: TicketRecord) =>
        ticket.priority === "EMERGENCY",
    ).length;

  const completionRate =
    createdTickets.length > 0
      ? Math.round(
          (
            closedCount /
            createdTickets.length
          ) * 100,
        )
      : 0;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
    },

    reportType: "MONTHLY",

    year: period.year,

    month: period.month,

    monthKey: period.monthKey,

    timezone: period.timeZone,

    periodStart: period.start,

    periodEnd: period.end,

    summary: {
      createdTickets:
        createdTickets.length,

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

      emergencyTickets:
        emergencyCount,

      currentOpenTickets:
        currentOpenCount,

      currentOverdueTickets:
        currentOverdueCount,

      completionRate,

      estimatedCost:
        Number(
          estimatedCost.toFixed(2),
        ),

      ...performance,

      ...ratingSummary,
    },

    ticketsByPriority:
      createDistribution(
        createdTickets,
        "priority",
        PRIORITIES,
      ),

    ticketsByStatus:
      createDistribution(
        createdTickets,
        "status",
        STATUSES,
      ),

    topLocations:
      createLocationWorkload(
        createdTickets,
      ),

    topAssets:
      createAssetWorkload(
        createdTickets,
      ),

    technicianPerformance:
      createTechnicianWorkload(
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
  const { data, error } =
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

  const managers =
    (data || []) as ManagerRecord[];

  if (managers.length === 0) {
    return 0;
  }

  const now =
    new Date().toISOString();

  const notifications =
    managers.flatMap(
      (manager: ManagerRecord) => {
        const inAppNotification = {
          organization_id:
            organizationId,

          user_id: manager.id,

          ticket_id: null,

          channel: "IN_APP",

          event_type:
            "MONTHLY_REPORT_READY",

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
              "MONTHLY_REPORT_READY",

            status: "PENDING",

            attempts: 0,

            last_error: null,

            sent_at: null,

            created_at: now,
          },
        ];
      },
    );

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
        "MONTHLY_REPORT_GENERATED",

      entity_type: "REPORT",

      entity_id: null,

      old_values: null,

      new_values: report,
    });

  if (error) {
    console.error(
      "Monthly report audit error:",
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
            "غير مصرح بإنشاء التقرير الشهري.",
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

    const requestedYear =
      Number(
        body.year ||
          requestUrl.searchParams.get(
            "year",
          ),
      ) || undefined;

    const requestedMonth =
      Number(
        body.month ||
          requestUrl.searchParams.get(
            "month",
          ),
      ) || undefined;

    const notifyManagersParameter =
      requestUrl.searchParams.get(
        "notifyManagers",
      );

    const notifyManagers =
      body.notifyManagers ??
      body.notify_managers ??
      notifyManagersParameter !== "false";

    const period =
      getReportPeriod(
        requestedYear,
        requestedMonth,
        timezone,
      );

    const organizations =
      await getOrganizations(
        supabase,
        authorization,
        requestedOrganizationId,
      );

    const reports: Record<
      string,
      unknown
    >[] = [];

    const failures: Record<
      string,
      unknown
    >[] = [];

    for (
      const organization of organizations
    ) {
      try {
        const report =
          await createMonthlyReport(
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
          `Monthly report failed for organization ${organization.id}:`,
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
          : `تم إنشاء ${reports.length} تقرير شهري.`,

      year: period.year,

      month: period.month,

      monthKey: period.monthKey,

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
      "monthly-report error:",
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