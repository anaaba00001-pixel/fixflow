import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import TicketFilters from "../../components/tickets/TicketFilters";
import TicketPriorityBadge from "../../components/tickets/TicketPriorityBadge";
import TicketStatusBadge from "../../components/tickets/TicketStatusBadge";
import useAuth from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import { navigate } from "../../routes/AppRouter";
import { listTickets } from "../../services/ticketService";
import { formatDate } from "../../utils/formatDate";

/* ==================================================
   القيم الافتراضية
================================================== */

const EMPTY_FILTERS = Object.freeze({
  search: "",
  status: "",
  priority: "",
  locationId: "",
  categoryId: "",
  technicianId: "",
  dateFrom: "",
  dateTo: "",
  overdueOnly: false,
  emergencyOnly: false,
});

/* ==================================================
   بيانات العرض التجريبي
================================================== */

const DEMO_LOCATIONS = [
  {
    id: "demo-location-riyadh",
    name: "فرع الرياض",
  },
  {
    id: "demo-location-north",
    name: "الفرع الشمالي",
  },
];

const DEMO_CATEGORIES = [
  {
    id: "demo-category-ac",
    name: "تكييف وتبريد",
  },
  {
    id: "demo-category-electric",
    name: "كهرباء وإنارة",
  },
  {
    id: "demo-category-plumbing",
    name: "سباكة",
  },
  {
    id: "demo-category-general",
    name: "صيانة عامة",
  },
];

const DEMO_TECHNICIANS = [
  {
    id: "technician-1",
    full_name: "محمد العتيبي",
    specialization: "تكييف وتبريد",
    is_active: true,
  },
  {
    id: "technician-2",
    full_name: "أحمد الشمري",
    specialization: "كهرباء",
    is_active: true,
  },
  {
    id: "technician-3",
    full_name: "سالم الحربي",
    specialization: "سباكة",
    is_active: true,
  },
];

const DEMO_TICKETS = [
  {
    id: "demo-ticket-1",
    ticket_number: "MT-2026-00125",
    title: "المكيف لا يبرد",
    description:
      "المكيف يعمل لكن الهواء الخارج غير بارد.",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-ac",
    asset_id: "demo-asset-ac",
    assigned_technician_id: "technician-1",
    priority: "EMERGENCY",
    status: "PENDING_APPROVAL",
    reporter_name: "ريم محمد",
    created_at: "2026-08-03T00:30:00+03:00",
    updated_at: "2026-08-03T01:45:00+03:00",
    due_at: "2026-08-03T03:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-ac",
      name: "تكييف وتبريد",
    },

    assets: {
      id: "demo-asset-ac",
      name: "مكيف غرفة الاجتماعات",
      asset_number: "AC-RYD-001",
    },

    profiles: {
      id: "technician-1",
      full_name: "محمد العتيبي",
    },
  },

  {
    id: "demo-ticket-2",
    ticket_number: "MT-2026-00124",
    title: "تسرب مياه أسفل المغسلة",
    description:
      "يوجد تسرب مستمر أسفل مغسلة الموظفين.",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-plumbing",
    asset_id: null,
    assigned_technician_id: "technician-3",
    priority: "HIGH",
    status: "IN_PROGRESS",
    reporter_name: "خالد محمد",
    created_at: "2026-08-02T22:20:00+03:00",
    updated_at: "2026-08-03T00:15:00+03:00",
    due_at: "2026-08-03T02:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-plumbing",
      name: "سباكة",
    },

    assets: null,

    profiles: {
      id: "technician-3",
      full_name: "سالم الحربي",
    },
  },

  {
    id: "demo-ticket-3",
    ticket_number: "MT-2026-00123",
    title: "إضاءة الممر متقطعة",
    description:
      "إضاءة الممر الشمالي تعمل بصورة متقطعة.",
    organization_id: "demo-organization",
    location_id: "demo-location-north",
    category_id: "demo-category-electric",
    asset_id: "demo-asset-light",
    assigned_technician_id: "technician-2",
    priority: "MEDIUM",
    status: "ASSIGNED",
    reporter_name: "سارة علي",
    created_at: "2026-08-02T17:40:00+03:00",
    updated_at: "2026-08-02T18:10:00+03:00",
    due_at: "2026-08-04T10:00:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },

    categories: {
      id: "demo-category-electric",
      name: "كهرباء وإنارة",
    },

    assets: {
      id: "demo-asset-light",
      name: "إنارة الممر B",
      asset_number: "EL-NTH-014",
    },

    profiles: {
      id: "technician-2",
      full_name: "أحمد الشمري",
    },
  },

  {
    id: "demo-ticket-4",
    ticket_number: "MT-2026-00122",
    title: "قطعة غيار مطلوبة للمصعد",
    description:
      "يتطلب المصعد استبدال حساس الباب قبل استئناف العمل.",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-general",
    asset_id: "demo-asset-elevator",
    assigned_technician_id: "technician-1",
    priority: "HIGH",
    status: "WAITING_PARTS",
    reporter_name: "نورة سالم",
    created_at: "2026-08-02T12:10:00+03:00",
    updated_at: "2026-08-02T15:20:00+03:00",
    due_at: "2026-08-05T12:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-general",
      name: "صيانة عامة",
    },

    assets: {
      id: "demo-asset-elevator",
      name: "مصعد الموظفين",
      asset_number: "EV-RYD-002",
    },

    profiles: {
      id: "technician-1",
      full_name: "محمد العتيبي",
    },
  },

  {
    id: "demo-ticket-5",
    ticket_number: "MT-2026-00121",
    title: "الباب الإلكتروني لا يفتح",
    description:
      "تم فحص قارئ البطاقة وإعادة ضبط وحدة التحكم.",
    organization_id: "demo-organization",
    location_id: "demo-location-north",
    category_id: "demo-category-electric",
    asset_id: "demo-asset-door",
    assigned_technician_id: "technician-2",
    priority: "LOW",
    status: "CLOSED",
    reporter_name: "تركي عبدالله",
    created_at: "2026-08-01T19:45:00+03:00",
    updated_at: "2026-08-02T10:15:00+03:00",
    due_at: "2026-08-03T10:00:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },

    categories: {
      id: "demo-category-electric",
      name: "كهرباء وإنارة",
    },

    assets: {
      id: "demo-asset-door",
      name: "باب المدخل الرئيسي",
      asset_number: "DR-NTH-003",
    },

    profiles: {
      id: "technician-2",
      full_name: "أحمد الشمري",
    },
  },
];

/* ==================================================
   دوال مساعدة
================================================== */

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getUserLocationIds(user) {
  const directLocationId =
    user?.location_id ||
    user?.locationId;

  const locationIds =
    user?.location_ids ||
    user?.locationIds ||
    [];

  const values = [];

  if (directLocationId) {
    values.push(directLocationId);
  }

  if (Array.isArray(locationIds)) {
    values.push(...locationIds);
  }

  return [
    ...new Set(
      values
        .filter(Boolean)
        .map(String)
    ),
  ];
}

function getLocationName(ticket) {
  return (
    ticket?.location_name ||
    ticket?.location?.name ||
    ticket?.locations?.name ||
    "موقع غير محدد"
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

function getAssetName(ticket) {
  return (
    ticket?.asset_name ||
    ticket?.asset?.name ||
    ticket?.assets?.name ||
    "بلاغ عام دون جهاز"
  );
}

function getTechnicianName(ticket) {
  return (
    ticket?.technician_name ||
    ticket?.assigned_technician?.full_name ||
    ticket?.technician?.full_name ||
    ticket?.profiles?.full_name ||
    "غير معيّن"
  );
}

function getTicketIdentifier(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
  );
}

function isOverdue(ticket) {
  if (
    !ticket ||
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

  const dueValue =
    ticket.due_at ||
    ticket.dueAt;

  if (!dueValue) {
    return false;
  }

  const dueTime =
    new Date(dueValue).getTime();

  return (
    !Number.isNaN(dueTime) &&
    dueTime < Date.now()
  );
}

function readStoredTickets() {
  const storageKeys = [
    "fixflow_tickets",
    "fixflow_my_tickets",
    "fixflow_reporter_tickets",
    "fixflow_public_tickets",
  ];

  const tickets = [];

  storageKeys.forEach(
    (storageKey) => {
      try {
        const storedValue =
          localStorage.getItem(
            storageKey
          );

        const parsedValue =
          storedValue
            ? JSON.parse(storedValue)
            : [];

        if (
          Array.isArray(parsedValue)
        ) {
          tickets.push(
            ...parsedValue
          );
        }
      } catch {
        return;
      }
    }
  );

  return tickets;
}

function removeDuplicateTickets(
  tickets
) {
  const uniqueTickets =
    new Map();

  tickets.forEach((ticket) => {
    const key = String(
      ticket?.id ||
        ticket?.ticket_number ||
        ticket?.ticketNumber ||
        ""
    );

    if (key) {
      uniqueTickets.set(
        key,
        ticket
      );
    }
  });

  return [
    ...uniqueTickets.values(),
  ];
}

function matchesTicketFilters(
  ticket,
  filters
) {
  const search = normalizeText(
    filters.search
  );

  if (search) {
    const searchableText =
      normalizeText(
        [
          getTicketIdentifier(
            ticket
          ),
          ticket.title,
          ticket.description,
          getAssetName(ticket),
          getLocationName(ticket),
          getCategoryName(ticket),
          getTechnicianName(
            ticket
          ),
          ticket.reporter_name,
          ticket.reporter_email,
          ticket.reporter_phone,
        ].join(" ")
      );

    if (
      !searchableText.includes(
        search
      )
    ) {
      return false;
    }
  }

  if (
    filters.status &&
    ticket.status !==
      filters.status
  ) {
    return false;
  }

  if (
    filters.priority &&
    ticket.priority !==
      filters.priority
  ) {
    return false;
  }

  if (
    filters.locationId &&
    String(
      ticket.location_id || ""
    ) !==
      String(
        filters.locationId
      )
  ) {
    return false;
  }

  if (
    filters.categoryId &&
    String(
      ticket.category_id || ""
    ) !==
      String(
        filters.categoryId
      )
  ) {
    return false;
  }

  if (
    filters.technicianId &&
    String(
      ticket.assigned_technician_id ||
        ""
    ) !==
      String(
        filters.technicianId
      )
  ) {
    return false;
  }

  const createdTime =
    new Date(
      ticket.created_at ||
        ticket.createdAt ||
        0
    ).getTime();

  if (filters.dateFrom) {
    const startTime =
      new Date(
        `${filters.dateFrom}T00:00:00`
      ).getTime();

    if (
      !Number.isNaN(
        startTime
      ) &&
      createdTime < startTime
    ) {
      return false;
    }
  }

  if (filters.dateTo) {
    const endTime =
      new Date(
        `${filters.dateTo}T23:59:59.999`
      ).getTime();

    if (
      !Number.isNaN(endTime) &&
      createdTime > endTime
    ) {
      return false;
    }
  }

  if (
    filters.overdueOnly &&
    !isOverdue(ticket)
  ) {
    return false;
  }

  if (
    filters.emergencyOnly &&
    ticket.priority !==
      "EMERGENCY"
  ) {
    return false;
  }

  return true;
}

function getPageInformation(role) {
  switch (role) {
    case "PLATFORM_ADMIN":
      return {
        eyebrow: "إدارة المنصة",

        title:
          "طلبات الصيانة",

        description:
          "عرض طلبات الصيانة في جميع المنشآت المتاحة لحسابك.",
      };

    case "BRANCH_MANAGER":
      return {
        eyebrow: "إدارة الفرع",

        title:
          "طلبات الفرع",

        description:
          "عرض ومتابعة طلبات الصيانة التابعة لفرعك.",
      };

    case "SUPERVISOR":
      return {
        eyebrow:
          "عمليات الصيانة",

        title:
          "إدارة طلبات الصيانة",

        description:
          "راجع الطلبات وعيّن الفنيين وتابع تقدم العمل.",
      };

    case "INVENTORY_MANAGER":
      return {
        eyebrow:
          "المخزون وقطع الغيار",

        title:
          "طلبات الصيانة المرتبطة بالمخزون",

        description:
          "تابع الطلبات التي تحتاج إلى قطع غيار وحالة تنفيذها.",
      };

    default:
      return {
        eyebrow:
          "إدارة المنشأة",

        title:
          "طلبات الصيانة",

        description:
          "عرض ومتابعة جميع طلبات الصيانة ضمن المنشأة.",
      };
  }
}

function sortTickets(tickets) {
  return [...tickets].sort(
    (
      firstTicket,
      secondTicket
    ) =>
      new Date(
        secondTicket.updated_at ||
          secondTicket.created_at ||
          0
      ).getTime() -
      new Date(
        firstTicket.updated_at ||
          firstTicket.created_at ||
          0
      ).getTime()
  );
}

/* ==================================================
   الصفحة
================================================== */

export default function TicketsPage() {
  const {
    user,
    role: authRole,
    organizationId,
    isPlatformAdmin,
    isDemo,
  } = useAuth();

  const role = normalizeRole(
    authRole || user?.role
  );

  const pageInformation =
    getPageInformation(role);

  const userLocationIds =
    useMemo(
      () =>
        getUserLocationIds(
          user
        ),
      [user]
    );

  const primaryLocationId =
    userLocationIds[0] ||
    null;

  const [
    tickets,
    setTickets,
  ] = useState([]);

  const [
    locations,
    setLocations,
  ] = useState([]);

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    technicians,
    setTechnicians,
  ] = useState([]);

  const [
    filters,
    setFilters,
  ] = useState(
    EMPTY_FILTERS
  );

  const [
    appliedFilters,
    setAppliedFilters,
  ] = useState(
    EMPTY_FILTERS
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* ==================================================
     تحميل خيارات الفلاتر
  ================================================== */

  const loadFilterOptions =
    useCallback(async () => {
      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const allowedDemoLocations =
          role ===
            "BRANCH_MANAGER" &&
          primaryLocationId
            ? DEMO_LOCATIONS.filter(
                (location) =>
                  String(
                    location.id
                  ) ===
                  String(
                    primaryLocationId
                  )
              )
            : role ===
                  "SUPERVISOR" &&
                userLocationIds.length >
                  0
              ? DEMO_LOCATIONS.filter(
                  (location) =>
                    userLocationIds.includes(
                      String(
                        location.id
                      )
                    )
                )
              : DEMO_LOCATIONS;

        setLocations(
          allowedDemoLocations
        );

        setCategories(
          DEMO_CATEGORIES
        );

        setTechnicians(
          DEMO_TECHNICIANS
        );

        return;
      }

      try {
        let locationsQuery =
          requireSupabase()
            .from("locations")
            .select(
              `
                id,
                name,
                organization_id,
                is_active
              `
            )
            .eq(
              "is_active",
              true
            )
            .order("name");

        let categoriesQuery =
          requireSupabase()
            .from("categories")
            .select(
              `
                id,
                name,
                organization_id,
                is_active
              `
            )
            .eq(
              "is_active",
              true
            )
            .order("name");

        let techniciansQuery =
          requireSupabase()
            .from("profiles")
            .select(
              `
                id,
                full_name,
                specialization,
                organization_id,
                is_active
              `
            )
            .eq(
              "role",
              "TECHNICIAN"
            )
            .eq(
              "is_active",
              true
            )
            .order("full_name");

        if (organizationId) {
          locationsQuery =
            locationsQuery.eq(
              "organization_id",
              organizationId
            );

          categoriesQuery =
            categoriesQuery.eq(
              "organization_id",
              organizationId
            );

          techniciansQuery =
            techniciansQuery.eq(
              "organization_id",
              organizationId
            );
        }

        const [
          locationsResult,
          categoriesResult,
          techniciansResult,
        ] = await Promise.all([
          locationsQuery,
          categoriesQuery,
          techniciansQuery,
        ]);

        if (
          locationsResult.error
        ) {
          throw locationsResult.error;
        }

        if (
          categoriesResult.error
        ) {
          throw categoriesResult.error;
        }

        if (
          techniciansResult.error
        ) {
          throw techniciansResult.error;
        }

        let nextLocations =
          locationsResult.data ||
          [];

        if (
          role ===
            "BRANCH_MANAGER" &&
          primaryLocationId
        ) {
          nextLocations =
            nextLocations.filter(
              (location) =>
                String(
                  location.id
                ) ===
                String(
                  primaryLocationId
                )
            );
        } else if (
          role ===
            "SUPERVISOR" &&
          userLocationIds.length >
            0
        ) {
          nextLocations =
            nextLocations.filter(
              (location) =>
                userLocationIds.includes(
                  String(
                    location.id
                  )
                )
            );
        }

        setLocations(
          nextLocations
        );

        setCategories(
          categoriesResult.data ||
            []
        );

        setTechnicians(
          techniciansResult.data ||
            []
        );
      } catch {
        setLocations([]);
        setCategories([]);
        setTechnicians([]);
      }
    }, [
      isDemo,
      role,
      organizationId,
      primaryLocationId,
      userLocationIds,
    ]);

  /* ==================================================
     تحميل الطلبات
  ================================================== */

  const loadTickets =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          if (
            isDemo ||
            !isSupabaseConfigured
          ) {
            const storedTickets =
              readStoredTickets();

            let nextTickets =
              removeDuplicateTickets(
                [
                  ...storedTickets,
                  ...DEMO_TICKETS,
                ]
              );

            if (
              !isPlatformAdmin &&
              organizationId
            ) {
              nextTickets =
                nextTickets.filter(
                  (ticket) =>
                    !ticket.organization_id ||
                    String(
                      ticket.organization_id
                    ) ===
                      String(
                        organizationId
                      )
                );
            }

            if (
              role ===
                "BRANCH_MANAGER" &&
              primaryLocationId
            ) {
              nextTickets =
                nextTickets.filter(
                  (ticket) =>
                    String(
                      ticket.location_id ||
                        ""
                    ) ===
                    String(
                      primaryLocationId
                    )
                );
            }

            if (
              role ===
                "SUPERVISOR" &&
              userLocationIds.length >
                0
            ) {
              nextTickets =
                nextTickets.filter(
                  (ticket) =>
                    userLocationIds.includes(
                      String(
                        ticket.location_id ||
                          ""
                      )
                    )
                );
            }

            if (
              role ===
                "TECHNICIAN" &&
              user?.id
            ) {
              nextTickets =
                nextTickets.filter(
                  (ticket) =>
                    String(
                      ticket.assigned_technician_id ||
                        ""
                    ) ===
                    String(user.id)
                );
            }

            nextTickets =
              nextTickets.filter(
                (ticket) =>
                  matchesTicketFilters(
                    ticket,
                    appliedFilters
                  )
              );

            setTickets(
              sortTickets(
                nextTickets
              )
            );

            return;
          }

          if (
            !isPlatformAdmin &&
            !organizationId
          ) {
            throw new Error(
              "لا توجد منشأة مرتبطة بالحساب الحالي."
            );
          }

          const serviceFilters = {
            ...appliedFilters,

            limit: 500,

            sortBy:
              "created_at",

            sortDirection:
              "desc",
          };

          delete serviceFilters.overdueOnly;
          delete serviceFilters.emergencyOnly;

          if (organizationId) {
            serviceFilters.organizationId =
              organizationId;
          }

          if (
            role ===
              "BRANCH_MANAGER" &&
            primaryLocationId
          ) {
            serviceFilters.locationId =
              primaryLocationId;
          }

          if (
            role ===
              "TECHNICIAN" &&
            user?.id
          ) {
            serviceFilters.technicianId =
              user.id;
          }

          let result =
            await listTickets(
              serviceFilters
            );

          if (
            role ===
              "SUPERVISOR" &&
            userLocationIds.length >
              0
          ) {
            result =
              result.filter(
                (ticket) =>
                  userLocationIds.includes(
                    String(
                      ticket.location_id ||
                        ""
                    )
                  )
              );
          }

          if (
            appliedFilters.overdueOnly
          ) {
            result =
              result.filter(
                isOverdue
              );
          }

          if (
            appliedFilters.emergencyOnly
          ) {
            result =
              result.filter(
                (ticket) =>
                  ticket.priority ===
                  "EMERGENCY"
              );
          }

          setTickets(
            sortTickets(result)
          );
        } catch (loadError) {
          setTickets([]);

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "تعذر تحميل طلبات الصيانة."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        appliedFilters,
        isDemo,
        isPlatformAdmin,
        organizationId,
        role,
        primaryLocationId,
        userLocationIds,
        user?.id,
      ]
    );

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  /* ==================================================
     الإحصاءات
  ================================================== */

  const statistics =
    useMemo(() => {
      return {
        total:
          tickets.length,

        newTickets:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              "NEW"
          ).length,

        active:
          tickets.filter(
            (ticket) =>
              [
                "ASSIGNED",
                "ACCEPTED",
                "IN_PROGRESS",
                "WAITING_PARTS",
                "REOPENED",
              ].includes(
                ticket.status
              )
          ).length,

        overdue:
          tickets.filter(
            isOverdue
          ).length,

        waitingParts:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              "WAITING_PARTS"
          ).length,
      };
    }, [tickets]);

  /* ==================================================
     الأحداث
  ================================================== */

  function handleApplyFilters(
    nextFilters
  ) {
    setAppliedFilters({
      ...EMPTY_FILTERS,
      ...nextFilters,
    });
  }

  function handleResetFilters() {
    setFilters(
      EMPTY_FILTERS
    );

    setAppliedFilters(
      EMPTY_FILTERS
    );
  }

  function openTicket(ticket) {
    const ticketId =
      ticket.id ||
      ticket.ticket_number;

    if (!ticketId) {
      return;
    }

    navigate(
      `/tickets/${encodeURIComponent(
        ticketId
      )}`
    );
  }

  /* ==================================================
     واجهة الصفحة
  ================================================== */

  return (
    <>
      <div className="page-header">
        <div>
          <small>
            {
              pageInformation.eyebrow
            }
          </small>

          <h1>
            {
              pageInformation.title
            }
          </h1>

          <p>
            {
              pageInformation.description
            }
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            loadTickets({
              silent: true,
            })
          }
          disabled={refreshing}
        >
          {refreshing
            ? "جاري التحديث…"
            : "↻ تحديث الطلبات"}
        </button>
      </div>

      {isDemo ||
      !isSupabaseConfigured ? (
        <div
          className="demo-callout"
          style={{
            marginBottom:
              "16px",
          }}
        >
          <strong>
            الوضع التجريبي
          </strong>

          <span>
            تعرض الصفحة بيانات
            تجريبية وأي طلبات محفوظة
            محليًا في المتصفح.
          </span>
        </div>
      ) : null}

      {error ? (
        <div
          className="form-error"
          role="alert"
          style={{
            marginBottom:
              "16px",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* الإحصاءات */}
      <section
        className="stats-grid"
        style={{
          marginBottom:
            "18px",
        }}
      >
        <article className="stat-card">
          <div>
            <small>
              إجمالي الطلبات
            </small>

            <strong>
              {statistics.total}
            </strong>

            <p>
              ضمن نطاق الحساب الحالي
            </p>
          </div>

          <span
            className="stat-icon blue-bg"
            aria-hidden="true"
          >
            ▤
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              طلبات جديدة
            </small>

            <strong>
              {
                statistics.newTickets
              }
            </strong>

            <p>
              لم يتم تعيينها بعد
            </p>
          </div>

          <span
            className="stat-icon violet-bg"
            aria-hidden="true"
          >
            +
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              قيد التنفيذ
            </small>

            <strong>
              {statistics.active}
            </strong>

            <p>
              مسندة أو جاري العمل
              عليها
            </p>
          </div>

          <span
            className="stat-icon amber-bg"
            aria-hidden="true"
          >
            ⚒
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              {role ===
              "INVENTORY_MANAGER"
                ? "بانتظار قطع"
                : "طلبات متأخرة"}
            </small>

            <strong>
              {role ===
              "INVENTORY_MANAGER"
                ? statistics.waitingParts
                : statistics.overdue}
            </strong>

            <p>
              {role ===
              "INVENTORY_MANAGER"
                ? "تحتاج إلى متابعة المخزون"
                : "تجاوزت موعد الاستحقاق"}
            </p>
          </div>

          <span
            className="stat-icon red-bg"
            aria-hidden="true"
          >
            !
          </span>
        </article>
      </section>

      {/* الفلاتر */}
      <TicketFilters
        value={filters}
        locations={locations}
        categories={categories}
        technicians={
          technicians
        }
        busy={
          loading ||
          refreshing
        }
        expanded={false}
        onChange={setFilters}
        onApply={
          handleApplyFilters
        }
        onReset={
          handleResetFilters
        }
      />

      {/* قائمة الطلبات */}
      <article
        className="panel"
        style={{
          marginTop:
            "16px",
        }}
      >
        <div className="panel-head">
          <div>
            <h2>
              قائمة الطلبات
            </h2>

            <p>
              {loading
                ? "جاري تحميل الطلبات…"
                : `${tickets.length} طلب مطابق للفلاتر الحالية`}
            </p>
          </div>
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "grid",
              gap: "10px",
              padding: "18px",
            }}
          >
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    height:
                      "64px",

                    borderRadius:
                      "10px",

                    background:
                      "#edf1f0",
                  }}
                />
              )
            )}
          </div>
        ) : tickets.length ===
          0 ? (
          <EmptyState
            icon="▤"
            title="لا توجد طلبات مطابقة"
            description="غيّر الفلاتر أو أعد تعيينها لعرض طلبات أخرى."
            actionLabel="إعادة تعيين الفلاتر"
            onAction={
              handleResetFilters
            }
          />
        ) : (
          <div className="ticket-list">
            {tickets.map(
              (ticket) => (
                <button
                  type="button"
                  className="ticket-row compact-row"
                  key={
                    ticket.id ||
                    ticket.ticket_number
                  }
                  onClick={() =>
                    openTicket(
                      ticket
                    )
                  }
                >
                  <span
                    className={`priority-dot priority-${String(
                      ticket.priority ||
                        "MEDIUM"
                    ).toLowerCase()}`}
                    aria-hidden="true"
                  />

                  <div className="ticket-main">
                    <strong>
                      {ticket.title ||
                        "طلب صيانة"}
                    </strong>

                    <small>
                      {getTicketIdentifier(
                        ticket
                      )}

                      {" · "}

                      {getAssetName(
                        ticket
                      )}
                    </small>
                  </div>

                  <div className="ticket-location">
                    <strong>
                      {getLocationName(
                        ticket
                      )}
                    </strong>

                    <small>
                      {getCategoryName(
                        ticket
                      )}

                      {" · "}

                      {getTechnicianName(
                        ticket
                      )}
                    </small>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",

                      flexWrap:
                        "wrap",

                      justifyContent:
                        "flex-end",

                      gap: "6px",
                    }}
                  >
                    <TicketPriorityBadge
                      priority={
                        ticket.priority
                      }
                    />

                    <TicketStatusBadge
                      status={
                        ticket.status
                      }
                    />

                    {isOverdue(
                      ticket
                    ) ? (
                      <span
                        className="badge"
                        style={{
                          color:
                            "#a84132",

                          background:
                            "#fae8e4",
                        }}
                      >
                        متأخر
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display:
                        "grid",

                      gap: "3px",

                      textAlign:
                        "left",
                    }}
                  >
                    <small>
                      آخر تحديث
                    </small>

                    <strong
                      style={{
                        fontSize:
                          "9px",
                      }}
                    >
                      {formatDate(
                        ticket.updated_at ||
                          ticket.created_at,
                        {
                          withTime:
                            true,
                        }
                      )}
                    </strong>
                  </div>

                  <span
                    className="chevron"
                    aria-hidden="true"
                  >
                    ‹
                  </span>
                </button>
              )
            )}
          </div>
        )}
      </article>
    </>
  );
}