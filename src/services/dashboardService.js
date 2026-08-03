import { requireSupabase } from "../lib/supabase";

const OPEN_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

const CLOSED_STATUSES = [
  "CLOSED",
  "CANCELLED",
];

const STATUS_ORDER = [
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

const PRIORITY_ORDER = [
  "EMERGENCY",
  "HIGH",
  "MEDIUM",
  "LOW",
];

const STATUS_LABELS = {
  NEW: "جديد",
  ASSIGNED: "تم التعيين",
  ACCEPTED: "مقبول",
  IN_PROGRESS: "جاري العمل",
  WAITING_PARTS: "بانتظار قطعة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  REOPENED: "معاد فتحه",
  CLOSED: "مغلق",
  CANCELLED: "ملغي",
};

const PRIORITY_LABELS = {
  EMERGENCY: "طارئة",
  HIGH: "مرتفعة",
  MEDIUM: "متوسطة",
  LOW: "منخفضة",
};

const TICKET_SELECT_EXTENDED = `
  id,
  ticket_number,
  title,
  description,
  status,
  priority,
  organization_id,
  location_id,
  category_id,
  asset_id,
  assigned_technician_id,
  reporter_name,
  created_at,
  updated_at,
  due_at,
  assigned_at,
  accepted_at,
  started_at,
  completed_at,
  closed_at,
  cancelled_at,
  is_overdue,
  locations (
    id,
    name
  ),
  assets (
    id,
    name,
    asset_number
  ),
  categories (
    id,
    name
  ),
  assigned_technician:profiles!tickets_assigned_technician_id_fkey (
    id,
    full_name,
    specialization,
    availability_status
  )
`;

const TICKET_SELECT_BASIC = `
  id,
  ticket_number,
  title,
  description,
  status,
  priority,
  organization_id,
  location_id,
  category_id,
  asset_id,
  assigned_technician_id,
  reporter_name,
  created_at,
  updated_at,
  due_at,
  assigned_at,
  accepted_at,
  started_at,
  completed_at,
  closed_at,
  cancelled_at,
  is_overdue,
  locations (
    id,
    name
  ),
  assets (
    id,
    name,
    asset_number
  ),
  categories (
    id,
    name
  ),
  assigned_technician:profiles!tickets_assigned_technician_id_fkey (
    id,
    full_name
  )
`;

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function normalizeDateStart(value) {
  if (!value) {
    return null;
  }

  return String(value).includes("T")
    ? value
    : `${value}T00:00:00`;
}

function normalizeDateEnd(value) {
  if (!value) {
    return null;
  }

  return String(value).includes("T")
    ? value
    : `${value}T23:59:59.999`;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(Boolean)
        .map(String)
    ),
  ];
}

function isTicketClosed(ticket) {
  return CLOSED_STATUSES.includes(
    ticket?.status
  );
}

function isTicketOpen(ticket) {
  return OPEN_STATUSES.includes(
    ticket?.status
  );
}

function isTicketOverdue(
  ticket,
  now = Date.now()
) {
  if (
    !ticket ||
    isTicketClosed(ticket)
  ) {
    return false;
  }

  if (
    ticket.is_overdue === true ||
    ticket.isOverdue === true
  ) {
    return true;
  }

  const dueTimestamp =
    getTimestamp(
      ticket.due_at ||
        ticket.dueAt
    );

  return (
    dueTimestamp > 0 &&
    dueTimestamp < now
  );
}

function getLocationName(ticket) {
  return (
    ticket?.location_name ||
    ticket?.location?.name ||
    ticket?.locations?.name ||
    "موقع غير محدد"
  );
}

function getAssetName(ticket) {
  return (
    ticket?.asset_name ||
    ticket?.asset?.name ||
    ticket?.assets?.name ||
    "دون جهاز محدد"
  );
}

function getCategoryName(ticket) {
  return (
    ticket?.category_name ||
    ticket?.category?.name ||
    ticket?.categories?.name ||
    "دون تصنيف"
  );
}

function getTechnician(ticket) {
  return (
    ticket?.assigned_technician ||
    ticket?.technician ||
    ticket?.profiles ||
    null
  );
}

function getTechnicianName(ticket) {
  const technician =
    getTechnician(ticket);

  return (
    ticket?.technician_name ||
    technician?.full_name ||
    technician?.name ||
    "غير معيّن"
  );
}

function calculateAverage(values) {
  const validValues =
    values.filter(
      (value) =>
        Number.isFinite(value) &&
        value >= 0
    );

  if (
    validValues.length === 0
  ) {
    return 0;
  }

  return (
    validValues.reduce(
      (total, value) =>
        total + value,
      0
    ) / validValues.length
  );
}

function calculateDurationMinutes(
  start,
  end
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
    (
      endTimestamp -
      startTimestamp
    ) / 60000
  );
}

function normalizeTicket(ticket) {
  const technician =
    getTechnician(ticket);

  return {
    ...ticket,

    location_name:
      getLocationName(ticket),

    asset_name:
      getAssetName(ticket),

    category_name:
      getCategoryName(ticket),

    technician_name:
      getTechnicianName(ticket),

    technician_specialization:
      technician?.specialization ||
      "",

    technician_availability_status:
      technician
        ?.availability_status ||
      "AVAILABLE",

    is_overdue:
      isTicketOverdue(ticket),
  };
}

function createDistribution(
  tickets,
  field,
  labels,
  order
) {
  const counts =
    new Map(
      order.map(
        (key) => [key, 0]
      )
    );

  tickets.forEach(
    (ticket) => {
      const key =
        ticket?.[field];

      if (!key) {
        return;
      }

      counts.set(
        key,
        (
          counts.get(key) ||
          0
        ) + 1
      );
    }
  );

  return [
    ...counts.entries(),
  ].map(
    ([key, value]) => ({
      key,
      label:
        labels[key] || key,
      value,
    })
  );
}

function createTechnicianWorkload(
  tickets,
  technicians
) {
  const workloadMap =
    new Map();

  technicians.forEach(
    (technician) => {
      workloadMap.set(
        String(technician.id),
        {
          id:
            technician.id,

          name:
            technician.full_name ||
            technician.fullName ||
            technician.name ||
            "فني صيانة",

          specialization:
            technician.specialization ||
            "",

          availabilityStatus:
            technician
              .availability_status ||
            technician
              .availabilityStatus ||
            "AVAILABLE",

          totalTickets: 0,
          openTickets: 0,
          closedTickets: 0,
          overdueTickets: 0,
          emergencyTickets: 0,
        }
      );
    }
  );

  tickets.forEach(
    (ticket) => {
      const relation =
        getTechnician(ticket);

      const technicianId =
        ticket
          .assigned_technician_id ||
        ticket
          .assignedTechnicianId ||
        relation?.id;

      if (!technicianId) {
        return;
      }

      const key =
        String(technicianId);

      if (
        !workloadMap.has(key)
      ) {
        workloadMap.set(
          key,
          {
            id:
              technicianId,

            name:
              getTechnicianName(
                ticket
              ),

            specialization:
              relation
                ?.specialization ||
              "",

            availabilityStatus:
              relation
                ?.availability_status ||
              "AVAILABLE",

            totalTickets: 0,
            openTickets: 0,
            closedTickets: 0,
            overdueTickets: 0,
            emergencyTickets: 0,
          }
        );
      }

      const workload =
        workloadMap.get(key);

      workload.totalTickets += 1;

      if (
        isTicketOpen(ticket)
      ) {
        workload.openTickets += 1;
      }

      if (
        ticket.status ===
        "CLOSED"
      ) {
        workload.closedTickets += 1;
      }

      if (
        isTicketOverdue(ticket)
      ) {
        workload.overdueTickets += 1;
      }

      if (
        ticket.priority ===
          "EMERGENCY" &&
        !isTicketClosed(ticket)
      ) {
        workload.emergencyTickets += 1;
      }
    }
  );

  return [
    ...workloadMap.values(),
  ].sort(
    (
      firstTechnician,
      secondTechnician
    ) => {
      if (
        secondTechnician
          .openTickets !==
        firstTechnician
          .openTickets
      ) {
        return (
          secondTechnician
            .openTickets -
          firstTechnician
            .openTickets
        );
      }

      return firstTechnician
        .name
        .localeCompare(
          secondTechnician.name,
          "ar"
        );
    }
  );
}

function createLocationWorkload(
  tickets
) {
  const workloadMap =
    new Map();

  tickets.forEach(
    (ticket) => {
      const locationId =
        ticket.location_id ||
        ticket.locationId ||
        ticket.locations?.id ||
        ticket.location?.id ||
        "unknown";

      const key =
        String(locationId);

      if (
        !workloadMap.has(key)
      ) {
        workloadMap.set(
          key,
          {
            id:
              locationId,

            name:
              getLocationName(
                ticket
              ),

            totalTickets: 0,
            openTickets: 0,
            closedTickets: 0,
            overdueTickets: 0,
            emergencyTickets: 0,
          }
        );
      }

      const workload =
        workloadMap.get(key);

      workload.totalTickets += 1;

      if (
        isTicketOpen(ticket)
      ) {
        workload.openTickets += 1;
      }

      if (
        ticket.status ===
        "CLOSED"
      ) {
        workload.closedTickets += 1;
      }

      if (
        isTicketOverdue(ticket)
      ) {
        workload.overdueTickets += 1;
      }

      if (
        ticket.priority ===
          "EMERGENCY" &&
        !isTicketClosed(ticket)
      ) {
        workload.emergencyTickets += 1;
      }
    }
  );

  return [
    ...workloadMap.values(),
  ].sort(
    (
      firstLocation,
      secondLocation
    ) =>
      secondLocation
        .totalTickets -
      firstLocation
        .totalTickets
  );
}

function createDashboardStats(
  tickets,
  totalCount
) {
  const closedTickets =
    tickets.filter(
      (ticket) =>
        ticket.status ===
        "CLOSED"
    );

  const openTickets =
    tickets.filter(
      isTicketOpen
    );

  const overdueTickets =
    tickets.filter(
      isTicketOverdue
    );

  const emergencyTickets =
    tickets.filter(
      (ticket) =>
        ticket.priority ===
          "EMERGENCY" &&
        !isTicketClosed(ticket)
    );

  const responseDurations =
    tickets
      .map((ticket) =>
        calculateDurationMinutes(
          ticket.created_at,

          ticket.assigned_at ||
            ticket.accepted_at ||
            ticket.started_at
        )
      )
      .filter(
        (value) =>
          value !== null
      );

  const repairDurations =
    closedTickets
      .map((ticket) =>
        calculateDurationMinutes(
          ticket.started_at ||
            ticket.accepted_at ||
            ticket.created_at,

          ticket.completed_at ||
            ticket.closed_at
        )
      )
      .filter(
        (value) =>
          value !== null
      );

  const relevantTotal =
    Number.isFinite(
      Number(totalCount)
    )
      ? Number(totalCount)
      : tickets.length;

  const completedCount =
    closedTickets.length;

  return {
    totalTickets:
      relevantTotal,

    total:
      relevantTotal,

    openTickets:
      openTickets.length,

    open:
      openTickets.length,

    newTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
          "NEW"
      ).length,

    assignedTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
          "ASSIGNED"
      ).length,

    inProgressTickets:
      tickets.filter(
        (ticket) =>
          [
            "ACCEPTED",
            "IN_PROGRESS",
            "WAITING_PARTS",
            "REOPENED",
          ].includes(
            ticket.status
          )
      ).length,

    pendingApprovalTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
          "PENDING_APPROVAL"
      ).length,

    closedTickets:
      completedCount,

    closed:
      completedCount,

    cancelledTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
          "CANCELLED"
      ).length,

    overdueTickets:
      overdueTickets.length,

    overdue:
      overdueTickets.length,

    emergencyTickets:
      emergencyTickets.length,

    emergency:
      emergencyTickets.length,

    unassignedTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
            "NEW" &&
          !ticket
            .assigned_technician_id
      ).length,

    completionRate:
      relevantTotal > 0
        ? Math.round(
            (
              completedCount /
              relevantTotal
            ) * 100
          )
        : 0,

    overdueRate:
      openTickets.length > 0
        ? Math.round(
            (
              overdueTickets.length /
              openTickets.length
            ) * 100
          )
        : 0,

    averageResponseMinutes:
      Math.round(
        calculateAverage(
          responseDurations
        )
      ),

    averageRepairMinutes:
      Math.round(
        calculateAverage(
          repairDurations
        )
      ),
  };
}

function applyFilters(
  query,
  filters
) {
  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  const locationId =
    filters.locationId ||
    filters.location_id;

  const technicianId =
    filters.technicianId ||
    filters.technician_id;

  const categoryId =
    filters.categoryId ||
    filters.category_id;

  const locationIds =
    normalizeIds(
      filters.locationIds ||
        filters.location_ids
    );

  const dateFrom =
    normalizeDateStart(
      filters.dateFrom ||
        filters.date_from
    );

  const dateTo =
    normalizeDateEnd(
      filters.dateTo ||
        filters.date_to
    );

  let nextQuery =
    query;

  if (organizationId) {
    nextQuery =
      nextQuery.eq(
        "organization_id",
        organizationId
      );
  }

  if (locationId) {
    nextQuery =
      nextQuery.eq(
        "location_id",
        locationId
      );
  } else if (
    locationIds.length > 0
  ) {
    nextQuery =
      nextQuery.in(
        "location_id",
        locationIds
      );
  }

  if (technicianId) {
    nextQuery =
      nextQuery.eq(
        "assigned_technician_id",
        technicianId
      );
  }

  if (categoryId) {
    nextQuery =
      nextQuery.eq(
        "category_id",
        categoryId
      );
  }

  if (filters.status) {
    nextQuery =
      nextQuery.eq(
        "status",
        filters.status
      );
  }

  if (filters.priority) {
    nextQuery =
      nextQuery.eq(
        "priority",
        filters.priority
      );
  }

  if (dateFrom) {
    nextQuery =
      nextQuery.gte(
        "created_at",
        dateFrom
      );
  }

  if (dateTo) {
    nextQuery =
      nextQuery.lte(
        "created_at",
        dateTo
      );
  }

  return nextQuery;
}

function isMissingExtendedColumnError(
  error
) {
  const message =
    String(
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

function enhanceDashboardError(
  error
) {
  const message =
    String(
      error?.message ||
        error?.details ||
        error?.hint ||
        ""
    ).toLowerCase();

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
      "لا تملكين صلاحية عرض بيانات لوحة التحكم."
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

  if (
    message.includes(
      "relationship"
    ) ||
    message.includes(
      "schema cache"
    )
  ) {
    return new Error(
      "تعذر قراءة علاقات لوحة التحكم. تأكدي من تطبيق ملفات الترحيل ثم أعيدي تحميل الصفحة."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "تعذر تحميل بيانات لوحة التحكم."
      );
}

async function runTicketsQuery(
  filters,
  selectValue
) {
  const maximumTickets =
    Math.min(
      Math.max(
        Number(
          filters.limit
        ) || 5000,
        1
      ),
      5000
    );

  let query =
    requireSupabase()
      .from("tickets")
      .select(
        selectValue,
        {
          count: "exact",
        }
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(
        maximumTickets
      );

  query =
    applyFilters(
      query,
      filters
    );

  return query;
}

async function fetchDashboardTickets(
  filters
) {
  let result =
    await runTicketsQuery(
      filters,
      TICKET_SELECT_EXTENDED
    );

  if (
    result.error &&
    isMissingExtendedColumnError(
      result.error
    )
  ) {
    result =
      await runTicketsQuery(
        filters,
        TICKET_SELECT_BASIC
      );
  }

  if (result.error) {
    throw enhanceDashboardError(
      result.error
    );
  }

  return {
    tickets:
      (
        result.data ||
        []
      ).map(
        normalizeTicket
      ),

    totalCount:
      result.count ??
      result.data?.length ??
      0,
  };
}

async function fetchTechnicians(
  filters
) {
  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  const technicianId =
    filters.technicianId ||
    filters.technician_id;

  async function runSelect(
    selectValue
  ) {
    let query =
      requireSupabase()
        .from("profiles")
        .select(
          selectValue
        )
        .eq(
          "role",
          "TECHNICIAN"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "full_name"
        );

    if (organizationId) {
      query =
        query.eq(
          "organization_id",
          organizationId
        );
    }

    if (technicianId) {
      query =
        query.eq(
          "id",
          technicianId
        );
    }

    return query;
  }

  let result =
    await runSelect(`
      id,
      full_name,
      organization_id,
      specialization,
      availability_status,
      is_active
    `);

  if (
    result.error &&
    isMissingExtendedColumnError(
      result.error
    )
  ) {
    result =
      await runSelect(`
        id,
        full_name,
        organization_id,
        is_active
      `);
  }

  if (result.error) {
    throw enhanceDashboardError(
      result.error
    );
  }

  return result.data || [];
}

export async function getDashboardData(
  filters = {}
) {
  try {
    const [
      ticketResult,
      technicians,
    ] = await Promise.all([
      fetchDashboardTickets(
        filters
      ),

      fetchTechnicians(
        filters
      ),
    ]);

    const {
      tickets,
      totalCount,
    } = ticketResult;

    const stats =
      createDashboardStats(
        tickets,
        totalCount
      );

    const recentLimit =
      Math.min(
        Math.max(
          Number(
            filters.recentLimit
          ) || 6,
          1
        ),
        50
      );

    const overdueLimit =
      Math.min(
        Math.max(
          Number(
            filters.overdueLimit
          ) || 6,
          1
        ),
        50
      );

    const emergencyLimit =
      Math.min(
        Math.max(
          Number(
            filters.emergencyLimit
          ) || 20,
          1
        ),
        100
      );

    const recentTickets =
      [...tickets]
        .sort(
          (
            firstTicket,
            secondTicket
          ) =>
            getTimestamp(
              secondTicket
                .created_at
            ) -
            getTimestamp(
              firstTicket
                .created_at
            )
        )
        .slice(
          0,
          recentLimit
        );

    const overdueTickets =
      tickets
        .filter(
          isTicketOverdue
        )
        .sort(
          (
            firstTicket,
            secondTicket
          ) =>
            getTimestamp(
              firstTicket
                .due_at
            ) -
            getTimestamp(
              secondTicket
                .due_at
            )
        )
        .slice(
          0,
          overdueLimit
        );

    const emergencyTickets =
      tickets
        .filter(
          (ticket) =>
            ticket.priority ===
              "EMERGENCY" &&
            !isTicketClosed(
              ticket
            )
        )
        .sort(
          (
            firstTicket,
            secondTicket
          ) => {
            const firstDue =
              getTimestamp(
                firstTicket
                  .due_at
              );

            const secondDue =
              getTimestamp(
                secondTicket
                  .due_at
              );

            if (
              firstDue === 0 &&
              secondDue === 0
            ) {
              return (
                getTimestamp(
                  firstTicket
                    .created_at
                ) -
                getTimestamp(
                  secondTicket
                    .created_at
                )
              );
            }

            if (
              firstDue === 0
            ) {
              return 1;
            }

            if (
              secondDue === 0
            ) {
              return -1;
            }

            return (
              firstDue -
              secondDue
            );
          }
        )
        .slice(
          0,
          emergencyLimit
        );

    return {
      stats,
      summary: stats,

      tickets,
      recentTickets,
      overdueTickets,
      emergencyTickets,

      ticketsByStatus:
        createDistribution(
          tickets,
          "status",
          STATUS_LABELS,
          STATUS_ORDER
        ),

      ticketsByPriority:
        createDistribution(
          tickets,
          "priority",
          PRIORITY_LABELS,
          PRIORITY_ORDER
        ),

      technicians,

      technicianWorkload:
        createTechnicianWorkload(
          tickets,
          technicians
        ),

      locationWorkload:
        createLocationWorkload(
          tickets
        ),

      totalCount,

      generatedAt:
        new Date()
          .toISOString(),
    };
  } catch (error) {
    throw enhanceDashboardError(
      error
    );
  }
}

export async function getDashboardStats(
  filters = {}
) {
  const result =
    await getDashboardData(
      filters
    );

  return result.stats;
}

export async function getRecentTickets(
  filters = {}
) {
  const result =
    await getDashboardData({
      ...filters,

      recentLimit:
        filters.limit || 6,
    });

  return result.recentTickets;
}

export async function getOverdueTickets(
  filters = {}
) {
  const result =
    await getDashboardData({
      ...filters,

      overdueLimit:
        filters.limit || 6,
    });

  return result.overdueTickets;
}

export async function getEmergencyTickets(
  filters = {}
) {
  const result =
    await getDashboardData({
      ...filters,

      emergencyLimit:
        filters.limit || 20,
    });

  return result.emergencyTickets;
}

export const getDashboard =
  getDashboardData;

export const fetchDashboardData =
  getDashboardData;