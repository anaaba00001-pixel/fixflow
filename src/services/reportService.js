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
  NEW: "جديدة",
  ASSIGNED: "تم التعيين",
  ACCEPTED: "مقبولة",
  IN_PROGRESS: "جاري العمل",
  WAITING_PARTS: "بانتظار قطعة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  REOPENED: "معاد فتحها",
  CLOSED: "مغلقة",
  CANCELLED: "ملغاة",
};

const PRIORITY_LABELS = {
  EMERGENCY: "طارئة",
  HIGH: "مرتفعة",
  MEDIUM: "متوسطة",
  LOW: "منخفضة",
};

const TICKET_SELECT_WITH_SPECIALIZATION = `
  *,
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
    specialization
  ),
  ticket_ratings (
    id,
    rating,
    comment,
    created_at
  ),
  ticket_history (
    id,
    to_status,
    created_at
  )
`;

const TICKET_SELECT_BASIC = `
  *,
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
  ),
  ticket_ratings (
    id,
    rating,
    comment,
    created_at
  ),
  ticket_history (
    id,
    to_status,
    created_at
  )
`;

function cleanValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function normalizeStartDate(value) {
  if (!value) {
    return null;
  }

  return String(value).includes("T")
    ? value
    : `${value}T00:00:00`;
}

function normalizeEndDate(value) {
  if (!value) {
    return null;
  }

  return String(value).includes("T")
    ? value
    : `${value}T23:59:59.999`;
}

function calculateDurationMinutes(start, end) {
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
      60000
  );
}

function calculateAverage(values) {
  const validValues = values.filter(
    (value) =>
      Number.isFinite(value) &&
      value >= 0
  );

  if (validValues.length === 0) {
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

function getLocationName(ticket) {
  return (
    ticket.location_name ||
    ticket.location?.name ||
    ticket.locations?.name ||
    "موقع غير محدد"
  );
}

function getAssetName(ticket) {
  return (
    ticket.asset_name ||
    ticket.asset?.name ||
    ticket.assets?.name ||
    "دون جهاز محدد"
  );
}

function getAssetNumber(ticket) {
  return (
    ticket.asset_number ||
    ticket.asset?.asset_number ||
    ticket.assets?.asset_number ||
    "—"
  );
}

function getCategoryName(ticket) {
  return (
    ticket.category_name ||
    ticket.category?.name ||
    ticket.categories?.name ||
    "دون تصنيف"
  );
}

function getTechnician(ticket) {
  return (
    ticket.assigned_technician ||
    ticket.technician ||
    ticket.profiles ||
    null
  );
}

function getTechnicianName(ticket) {
  const technician =
    getTechnician(ticket);

  return (
    ticket.technician_name ||
    technician?.full_name ||
    technician?.name ||
    "غير معيّن"
  );
}

function getTicketRatingRecord(ticket) {
  const relation =
    ticket.ticket_ratings ||
    ticket.ticket_rating ||
    ticket.rating_record ||
    null;

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function normalizeRating(value) {
  const rating =
    Number(value);

  if (
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return null;
  }

  return Math.round(rating);
}

function getTicketRating(ticket) {
  const ratingRecord =
    getTicketRatingRecord(ticket);

  return normalizeRating(
    ratingRecord?.rating ??
      ticket.reporter_rating ??
      ticket.rating ??
      ticket.satisfaction_rating
  );
}

function getTicketRatingComment(ticket) {
  const ratingRecord =
    getTicketRatingRecord(ticket);

  return cleanValue(
    ratingRecord?.comment ??
      ticket.rating_comment ??
      ticket.reporter_comment ??
      ticket.satisfaction_comment
  );
}

function getTicketRatingDate(ticket) {
  const ratingRecord =
    getTicketRatingRecord(ticket);

  return (
    ratingRecord?.created_at ||
    ticket.rated_at ||
    ticket.updated_at ||
    ticket.closed_at ||
    ticket.created_at ||
    null
  );
}

function getReopenCount(ticket) {
  const history =
    Array.isArray(
      ticket.ticket_history
    )
      ? ticket.ticket_history
      : [];

  const historyCount =
    history.filter(
      (entry) =>
        entry?.to_status ===
        "REOPENED"
    ).length;

  if (historyCount > 0) {
    return historyCount;
  }

  const storedCount =
    Number(
      ticket.reopen_count ||
        ticket.reopened_count ||
        0
    );

  if (
    Number.isFinite(storedCount) &&
    storedCount > 0
  ) {
    return storedCount;
  }

  return ticket.status === "REOPENED"
    ? 1
    : 0;
}

function isTicketOverdue(ticket) {
  if (
    ["CLOSED", "CANCELLED"].includes(
      ticket.status
    )
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
    dueTimestamp < Date.now()
  );
}

function createDistribution(
  tickets,
  field,
  labels,
  order
) {
  const counts =
    new Map();

  order.forEach((key) => {
    counts.set(key, 0);
  });

  tickets.forEach((ticket) => {
    const key =
      ticket[field];

    if (!key) {
      return;
    }

    counts.set(
      key,
      (counts.get(key) || 0) + 1
    );
  });

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

function createLocationReport(tickets) {
  const locations =
    new Map();

  tickets.forEach((ticket) => {
    const locationId =
      ticket.location_id ||
      ticket.locationId ||
      ticket.locations?.id ||
      ticket.location?.id ||
      "unknown";

    const key =
      String(locationId);

    if (!locations.has(key)) {
      locations.set(key, {
        id: locationId,
        name:
          getLocationName(ticket),
        totalTickets: 0,
        closedTickets: 0,
        overdueTickets: 0,
        categories:
          new Map(),
      });
    }

    const location =
      locations.get(key);

    location.totalTickets += 1;

    if (
      ticket.status === "CLOSED"
    ) {
      location.closedTickets += 1;
    }

    if (
      isTicketOverdue(ticket)
    ) {
      location.overdueTickets += 1;
    }

    const categoryName =
      getCategoryName(ticket);

    location.categories.set(
      categoryName,
      (
        location.categories.get(
          categoryName
        ) || 0
      ) + 1
    );
  });

  return [
    ...locations.values(),
  ]
    .map((location) => {
      const topCategoryEntry =
        [
          ...location.categories.entries(),
        ].sort(
          (
            firstEntry,
            secondEntry
          ) =>
            secondEntry[1] -
            firstEntry[1]
        )[0];

      return {
        id:
          location.id,

        name:
          location.name,

        totalTickets:
          location.totalTickets,

        closedTickets:
          location.closedTickets,

        overdueTickets:
          location.overdueTickets,

        topCategory:
          topCategoryEntry?.[0] ||
          "—",
      };
    })
    .sort(
      (
        firstLocation,
        secondLocation
      ) =>
        secondLocation.totalTickets -
        firstLocation.totalTickets
    );
}

function createTechnicianReport(
  tickets,
  technicians = []
) {
  const technicianMap =
    new Map();

  technicians.forEach(
    (technician) => {
      technicianMap.set(
        String(technician.id),
        {
          id:
            technician.id,

          name:
            technician.full_name ||
            technician.name ||
            "فني صيانة",

          specialization:
            technician.specialization ||
            "",

          totalTickets: 0,
          closedTickets: 0,
          overdueTickets: 0,
          responseDurations: [],
          repairDurations: [],
          ratings: [],
        }
      );
    }
  );

  tickets.forEach((ticket) => {
    const assignedTechnician =
      getTechnician(ticket);

    const technicianId =
      ticket.assigned_technician_id ||
      ticket.assignedTechnicianId ||
      assignedTechnician?.id;

    if (!technicianId) {
      return;
    }

    const key =
      String(technicianId);

    if (
      !technicianMap.has(key)
    ) {
      technicianMap.set(key, {
        id:
          technicianId,

        name:
          getTechnicianName(
            ticket
          ),

        specialization:
          assignedTechnician
            ?.specialization ||
          "",

        totalTickets: 0,
        closedTickets: 0,
        overdueTickets: 0,
        responseDurations: [],
        repairDurations: [],
        ratings: [],
      });
    }

    const technician =
      technicianMap.get(key);

    technician.totalTickets += 1;

    if (
      ticket.status === "CLOSED"
    ) {
      technician.closedTickets += 1;
    }

    if (
      isTicketOverdue(ticket)
    ) {
      technician.overdueTickets += 1;
    }

    const responseDuration =
      calculateDurationMinutes(
        ticket.created_at,
        ticket.assigned_at ||
          ticket.accepted_at ||
          ticket.started_at
      );

    if (
      responseDuration !== null
    ) {
      technician
        .responseDurations
        .push(responseDuration);
    }

    const repairDuration =
      calculateDurationMinutes(
        ticket.started_at ||
          ticket.accepted_at,

        ticket.completed_at ||
          ticket.closed_at
      );

    if (
      repairDuration !== null
    ) {
      technician
        .repairDurations
        .push(repairDuration);
    }

    const rating =
      getTicketRating(ticket);

    if (rating !== null) {
      technician.ratings.push(
        rating
      );
    }
  });

  return [
    ...technicianMap.values(),
  ]
    .filter(
      (technician) =>
        technician.totalTickets >
        0
    )
    .map((technician) => ({
      id:
        technician.id,

      name:
        technician.name,

      specialization:
        technician.specialization,

      totalTickets:
        technician.totalTickets,

      closedTickets:
        technician.closedTickets,

      overdueTickets:
        technician.overdueTickets,

      averageResponseMinutes:
        Math.round(
          calculateAverage(
            technician
              .responseDurations
          )
        ),

      averageRepairMinutes:
        Math.round(
          calculateAverage(
            technician
              .repairDurations
          )
        ),

      averageRating:
        technician.ratings.length >
        0
          ? Number(
              calculateAverage(
                technician.ratings
              ).toFixed(1)
            )
          : 0,
    }))
    .sort(
      (
        firstTechnician,
        secondTechnician
      ) =>
        secondTechnician.closedTickets -
        firstTechnician.closedTickets
    );
}

function createAssetsReport(tickets) {
  const assets =
    new Map();

  tickets.forEach((ticket) => {
    const assetId =
      ticket.asset_id ||
      ticket.assetId ||
      ticket.assets?.id ||
      ticket.asset?.id;

    if (!assetId) {
      return;
    }

    const key =
      String(assetId);

    if (!assets.has(key)) {
      assets.set(key, {
        id:
          assetId,

        name:
          getAssetName(ticket),

        assetNumber:
          getAssetNumber(ticket),

        locationName:
          getLocationName(ticket),

        breakdownsCount: 0,
        reopenedCount: 0,
        partsCost: 0,
        lastMaintenanceAt:
          null,
      });
    }

    const asset =
      assets.get(key);

    asset.breakdownsCount += 1;

    asset.reopenedCount +=
      getReopenCount(ticket);

    asset.partsCost += Number(
      ticket.parts_cost ??
        ticket.partsCost ??
        ticket.material_cost ??
        ticket.estimated_cost ??
        0
    );

    const maintenanceDate =
      ticket.closed_at ||
      ticket.completed_at ||
      ticket.updated_at ||
      ticket.created_at;

    if (
      getTimestamp(
        maintenanceDate
      ) >
      getTimestamp(
        asset.lastMaintenanceAt
      )
    ) {
      asset.lastMaintenanceAt =
        maintenanceDate;
    }
  });

  return [
    ...assets.values(),
  ].sort(
    (
      firstAsset,
      secondAsset
    ) =>
      secondAsset.breakdownsCount -
      firstAsset.breakdownsCount
  );
}

function createSatisfactionReport(
  tickets
) {
  const ratings = [];
  const comments = [];

  tickets.forEach((ticket) => {
    const rating =
      getTicketRating(ticket);

    if (rating === null) {
      return;
    }

    ratings.push(rating);

    const comment =
      getTicketRatingComment(
        ticket
      );

    if (comment) {
      const ratingRecord =
        getTicketRatingRecord(
          ticket
        );

      comments.push({
        id:
          ratingRecord?.id ||
          ticket.id ||
          `${ticket.ticket_number}-${rating}`,

        rating,
        comment,

        createdAt:
          getTicketRatingDate(
            ticket
          ),
      });
    }
  });

  const ratingDistribution =
    [5, 4, 3, 2, 1].map(
      (rating) => ({
        rating,

        count:
          ratings.filter(
            (value) =>
              value === rating
          ).length,
      })
    );

  return {
    averageRating:
      ratings.length > 0
        ? Number(
            calculateAverage(
              ratings
            ).toFixed(1)
          )
        : 0,

    ratingsCount:
      ratings.length,

    lowRatingsCount:
      ratings.filter(
        (rating) =>
          rating <= 2
      ).length,

    ratingDistribution,

    comments:
      comments
        .sort(
          (
            firstComment,
            secondComment
          ) =>
            getTimestamp(
              secondComment.createdAt
            ) -
            getTimestamp(
              firstComment.createdAt
            )
        )
        .slice(0, 20),
  };
}

function createSummary(tickets) {
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
    tickets
      .map((ticket) =>
        calculateDurationMinutes(
          ticket.started_at ||
            ticket.accepted_at,

          ticket.completed_at ||
            ticket.closed_at
        )
      )
      .filter(
        (value) =>
          value !== null
      );

  const ratings =
    tickets
      .map(getTicketRating)
      .filter(
        (rating) =>
          rating !== null
      );

  return {
    totalTickets:
      tickets.length,

    closedTickets:
      tickets.filter(
        (ticket) =>
          ticket.status ===
          "CLOSED"
      ).length,

    openTickets:
      tickets.filter(
        (ticket) =>
          OPEN_STATUSES.includes(
            ticket.status
          )
      ).length,

    overdueTickets:
      tickets.filter(
        isTicketOverdue
      ).length,

    reopenedTickets:
      tickets.filter(
        (ticket) =>
          getReopenCount(
            ticket
          ) > 0
      ).length,

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

    averageRating:
      ratings.length > 0
        ? Number(
            calculateAverage(
              ratings
            ).toFixed(1)
          )
        : 0,
  };
}

function applyTicketFilters(
  query,
  filters
) {
  let nextQuery =
    query;

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

  const status =
    filters.status;

  const priority =
    filters.priority;

  const dateFrom =
    normalizeStartDate(
      filters.dateFrom ||
        filters.date_from
    );

  const dateTo =
    normalizeEndDate(
      filters.dateTo ||
        filters.date_to
    );

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

  if (status) {
    nextQuery =
      nextQuery.eq(
        "status",
        status
      );
  }

  if (priority) {
    nextQuery =
      nextQuery.eq(
        "priority",
        priority
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

function isMissingSpecializationError(
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
    )
  );
}

function enhanceReportError(error) {
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
      "لا تملكين صلاحية عرض التقارير."
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
      "تعذر قراءة علاقات التقارير من قاعدة البيانات. تأكدي من تطبيق ملفات الترحيل ثم أعيدي تحميل الصفحة."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "تعذر تحميل بيانات التقرير."
      );
}

async function executeTicketsQuery(
  filters,
  selectValue
) {
  let query =
    requireSupabase()
      .from("tickets")
      .select(selectValue)
      .order("created_at", {
        ascending: false,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              filters.limit
            ) || 5000,
            1
          ),
          5000
        )
      );

  query =
    applyTicketFilters(
      query,
      filters
    );

  return query;
}

async function fetchTickets(filters) {
  let result =
    await executeTicketsQuery(
      filters,
      TICKET_SELECT_WITH_SPECIALIZATION
    );

  if (
    result.error &&
    isMissingSpecializationError(
      result.error
    )
  ) {
    result =
      await executeTicketsQuery(
        filters,
        TICKET_SELECT_BASIC
      );
  }

  if (result.error) {
    throw enhanceReportError(
      result.error
    );
  }

  return result.data || [];
}

async function fetchTechnicians(
  filters
) {
  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  async function runSelect(
    selectValue
  ) {
    let query =
      requireSupabase()
        .from("profiles")
        .select(selectValue)
        .eq(
          "role",
          "TECHNICIAN"
        )
        .order("full_name");

    if (organizationId) {
      query =
        query.eq(
          "organization_id",
          organizationId
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
      is_active
    `);

  if (
    result.error &&
    isMissingSpecializationError(
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
    return [];
  }

  return result.data || [];
}

export async function getReports(
  filters = {}
) {
  try {
    const [
      tickets,
      technicians,
    ] = await Promise.all([
      fetchTickets(filters),
      fetchTechnicians(
        filters
      ),
    ]);

    return {
      generatedAt:
        new Date().toISOString(),

      summary:
        createSummary(tickets),

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

      locations:
        createLocationReport(
          tickets
        ),

      technicians:
        createTechnicianReport(
          tickets,
          technicians
        ),

      assets:
        createAssetsReport(
          tickets
        ),

      satisfaction:
        createSatisfactionReport(
          tickets
        ),

      tickets,
    };
  } catch (error) {
    throw enhanceReportError(
      error
    );
  }
}

function escapeCsvValue(value) {
  const normalizedValue =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  return `"${normalizedValue.replace(
    /"/g,
    '""'
  )}"`;
}

function convertRowsToCsv(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return "";
  }

  const headers = [
    ...new Set(
      rows.flatMap((row) =>
        Object.keys(row || {})
      )
    ),
  ];

  const headerRow =
    headers
      .map(
        escapeCsvValue
      )
      .join(",");

  const dataRows =
    rows.map((row) =>
      headers
        .map((header) => {
          const value =
            row?.[header];

          if (
            typeof value ===
              "object" &&
            value !== null
          ) {
            return escapeCsvValue(
              JSON.stringify(
                value
              )
            );
          }

          return escapeCsvValue(
            value
          );
        })
        .join(",")
    );

  return [
    headerRow,
    ...dataRows,
  ].join("\n");
}

function getExportRows(
  report,
  section
) {
  if (
    section ===
    "technicians"
  ) {
    return (
      report.technicians ||
      []
    );
  }

  if (section === "assets") {
    return (
      report.assets || []
    );
  }

  if (
    section ===
    "locations"
  ) {
    return (
      report.locations || []
    );
  }

  if (
    section ===
    "satisfaction"
  ) {
    return (
      report.satisfaction
        ?.comments || []
    );
  }

  if (
    section === "summary"
  ) {
    return [
      report.summary || {},
    ];
  }

  return (
    report.tickets || []
  ).map((ticket) => ({
    ticketNumber:
      ticket.ticket_number ||
      ticket.ticketNumber ||
      ticket.id,

    title:
      ticket.title,

    status:
      STATUS_LABELS[
        ticket.status
      ] || ticket.status,

    priority:
      PRIORITY_LABELS[
        ticket.priority
      ] || ticket.priority,

    location:
      getLocationName(ticket),

    asset:
      getAssetName(ticket),

    assetNumber:
      getAssetNumber(ticket),

    category:
      getCategoryName(ticket),

    technician:
      getTechnicianName(
        ticket
      ),

    reporter:
      ticket.reporter_name ||
      "",

    createdAt:
      ticket.created_at,

    dueAt:
      ticket.due_at,

    closedAt:
      ticket.closed_at,

    rating:
      getTicketRating(
        ticket
      ) || "",

    overdue:
      isTicketOverdue(ticket)
        ? "نعم"
        : "لا",
  }));
}

function downloadFile({
  content,
  filename,
  mimeType,
}) {
  const blob =
    new Blob([content], {
      type: mimeType,
    });

  const fileUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    fileUrl;

  anchor.download =
    filename;

  anchor.style.display =
    "none";

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(
      fileUrl
    );
  }, 0);
}

function createFileDate() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printReport(
  rows,
  title
) {
  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1000,height=800"
    );

  if (!printWindow) {
    throw new Error(
      "تعذر فتح نافذة الطباعة. اسمحي بالنوافذ المنبثقة ثم حاولي مرة أخرى."
    );
  }

  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : [];

  const tableHeaders =
    headers
      .map(
        (header) =>
          `<th>${escapeHtml(
            header
          )}</th>`
      )
      .join("");

  const tableRows =
    rows
      .map(
        (row) => `
          <tr>
            ${headers
              .map(
                (header) => {
                  const value =
                    row[
                      header
                    ];

                  return `<td>${escapeHtml(
                    typeof value ===
                      "object" &&
                      value !==
                        null
                      ? JSON.stringify(
                          value
                        )
                      : value
                  )}</td>`;
                }
              )
              .join("")}
          </tr>
        `
      )
      .join("");

  const emptyRow =
    rows.length === 0
      ? `<tr><td colspan="${Math.max(
          headers.length,
          1
        )}">لا توجد بيانات في التقرير.</td></tr>`
      : "";

  printWindow.document.write(`
    <!doctype html>

    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />

        <title>
          ${escapeHtml(title)}
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 28px;
            color: #243c38;
          }

          h1 {
            margin-bottom: 8px;
          }

          p {
            color: #667875;
          }

          table {
            width: 100%;
            margin-top: 24px;
            border-collapse: collapse;
            font-size: 12px;
          }

          th,
          td {
            padding: 9px;
            border: 1px solid #dce5e2;
            text-align: right;
            vertical-align: top;
          }

          th {
            background: #f1f6f4;
          }

          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>

      <body>
        <h1>
          ${escapeHtml(title)}
        </h1>

        <p>
          تاريخ الإنشاء:
          ${escapeHtml(
            new Date().toLocaleString(
              "ar-SA"
            )
          )}
        </p>

        <table>
          <thead>
            <tr>
              ${tableHeaders}
            </tr>
          </thead>

          <tbody>
            ${tableRows}
            ${emptyRow}
          </tbody>
        </table>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

export async function exportReport(
  options = {}
) {
  const {
    format = "csv",
    section = "tickets",
    demoData,
    ...filters
  } = options;

  const report =
    demoData ||
    (await getReports(
      filters
    ));

  const rows =
    getExportRows(
      report,
      section
    );

  const normalizedFormat =
    String(format)
      .trim()
      .toLowerCase();

  const filenameBase =
    `fixflow-${section}-${createFileDate()}`;

  if (
    normalizedFormat ===
      "pdf" ||
    normalizedFormat ===
      "print"
  ) {
    printReport(
      rows,
      `تقرير FixFlow - ${section}`
    );

    return {
      success: true,
      format: "pdf",
      rowsCount:
        rows.length,
    };
  }

  if (
    normalizedFormat ===
    "json"
  ) {
    downloadFile({
      content:
        JSON.stringify(
          rows,
          null,
          2
        ),

      filename:
        `${filenameBase}.json`,

      mimeType:
        "application/json;charset=utf-8",
    });

    return {
      success: true,
      format: "json",
      rowsCount:
        rows.length,
    };
  }

  const csvContent =
    convertRowsToCsv(
      rows
    );

  downloadFile({
    content:
      `\uFEFF${csvContent}`,

    filename:
      `${filenameBase}.csv`,

    mimeType:
      "text/csv;charset=utf-8",
  });

  return {
    success: true,
    format: "csv",
    rowsCount:
      rows.length,
  };
}

export const getReportData =
  getReports;

export const fetchReports =
  getReports;

export const downloadReport =
  exportReport;