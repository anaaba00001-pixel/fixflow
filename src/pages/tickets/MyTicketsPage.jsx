import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import TicketPriorityBadge from "../../components/tickets/TicketPriorityBadge";
import TicketStatusBadge from "../../components/tickets/TicketStatusBadge";

import useAuth from "../../hooks/useAuth";
import { readLocalTickets } from "../../lib/localData";

import {
  isSupabaseConfigured,
} from "../../lib/supabase";

import {
  navigate,
} from "../../routes/AppRouter";

import {
  listTickets,
} from "../../services/ticketService";

import {
  formatDate,
} from "../../utils/formatDate";

/* ==================================================
   إعدادات الصفحة
================================================== */

const ACTIVE_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "REOPENED",
];

const TERMINAL_STATUSES = [
  "CLOSED",
  "CANCELLED",
];

const STORAGE_KEYS = [
  "fixflow_my_tickets",
  "fixflow_tickets",
  "fixflow_public_tickets",
];

const STATUS_FILTERS = [
  {
    value: "ALL",
    label: "جميع المهام",
  },
  {
    value: "ACTIVE",
    label: "المهام النشطة",
  },
  {
    value: "ASSIGNED",
    label: "المهام الجديدة",
  },
  {
    value: "IN_PROGRESS",
    label: "جاري العمل",
  },
  {
    value: "WAITING_PARTS",
    label: "بانتظار قطع",
  },
  {
    value: "PENDING_APPROVAL",
    label: "بانتظار الاعتماد",
  },
  {
    value: "CLOSED",
    label: "المهام المغلقة",
  },
];

/* ==================================================
   بيانات الوضع التجريبي
================================================== */

const DEMO_TICKETS = [
  {
    id: "technician-ticket-1",
    ticket_number: "MT-2026-00131",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-ac",
    asset_id: "demo-asset-ac-1",
    assigned_technician_id: "technician-1",

    title: "المكيف لا يبرد",
    description:
      "المكيف يعمل ولكن الهواء الخارج غير بارد.",

    priority: "EMERGENCY",
    status: "ASSIGNED",

    reporter_name: "ريم محمد",

    created_at:
      "2026-08-03T00:15:00+03:00",

    updated_at:
      "2026-08-03T01:10:00+03:00",

    due_at:
      "2026-08-03T04:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-ac",
      name: "تكييف وتبريد",
    },

    assets: {
      id: "demo-asset-ac-1",
      name: "مكيف غرفة الاجتماعات",
      asset_number: "AC-RYD-001",
    },
  },

  {
    id: "technician-ticket-2",
    ticket_number: "MT-2026-00130",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-general",
    asset_id: null,
    assigned_technician_id: "technician-1",

    title: "تسرب مياه بجوار المدخل",
    description:
      "يوجد تجمع مياه بالقرب من مدخل الموظفين.",

    priority: "HIGH",
    status: "IN_PROGRESS",

    reporter_name: "سارة عبدالله",

    created_at:
      "2026-08-02T18:20:00+03:00",

    updated_at:
      "2026-08-03T00:40:00+03:00",

    due_at:
      "2026-08-03T02:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-general",
      name: "صيانة عامة",
    },

    assets: null,
  },

  {
    id: "technician-ticket-3",
    ticket_number: "MT-2026-00129",
    organization_id: "demo-organization",
    location_id: "demo-location-north",
    category_id: "demo-category-elevator",
    asset_id: "demo-asset-elevator-1",
    assigned_technician_id: "technician-1",

    title: "حساس باب المصعد لا يعمل",
    description:
      "توقف حساس باب المصعد ويحتاج إلى قطعة بديلة.",

    priority: "HIGH",
    status: "WAITING_PARTS",

    reporter_name: "خالد سالم",

    created_at:
      "2026-08-02T10:30:00+03:00",

    updated_at:
      "2026-08-02T16:45:00+03:00",

    due_at:
      "2026-08-04T12:00:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },

    categories: {
      id: "demo-category-elevator",
      name: "مصاعد",
    },

    assets: {
      id: "demo-asset-elevator-1",
      name: "مصعد الموظفين",
      asset_number: "EV-NTH-002",
    },
  },

  {
    id: "technician-ticket-4",
    ticket_number: "MT-2026-00128",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-electric",
    asset_id: "demo-asset-light-1",
    assigned_technician_id: "technician-1",

    title: "إصلاح إنارة الممر",
    description:
      "تم استبدال وحدة الإنارة واختبارها بنجاح.",

    priority: "MEDIUM",
    status: "PENDING_APPROVAL",

    reporter_name: "نورة محمد",

    resolution_summary:
      "تم استبدال وحدة الإنارة التالفة وفحص التوصيلات.",

    created_at:
      "2026-08-01T13:20:00+03:00",

    updated_at:
      "2026-08-02T15:30:00+03:00",

    due_at:
      "2026-08-03T10:00:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },

    categories: {
      id: "demo-category-electric",
      name: "كهرباء وإنارة",
    },

    assets: {
      id: "demo-asset-light-1",
      name: "إنارة الممر A",
      asset_number: "EL-RYD-014",
    },
  },

  {
    id: "technician-ticket-5",
    ticket_number: "MT-2026-00120",
    organization_id: "demo-organization",
    location_id: "demo-location-north",
    category_id: "demo-category-electric",
    asset_id: "demo-asset-door-1",
    assigned_technician_id: "technician-1",

    title: "الباب الإلكتروني لا يفتح",
    description:
      "تمت إعادة برمجة وحدة التحكم واختبار الباب.",

    priority: "LOW",
    status: "CLOSED",

    reporter_name: "تركي عبدالله",

    resolution_summary:
      "تمت إعادة ضبط قارئ البطاقة ووحدة التحكم.",

    created_at:
      "2026-07-30T09:30:00+03:00",

    updated_at:
      "2026-08-01T11:00:00+03:00",

    closed_at:
      "2026-08-01T11:00:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },

    categories: {
      id: "demo-category-electric",
      name: "كهرباء وإنارة",
    },

    assets: {
      id: "demo-asset-door-1",
      name: "باب المدخل الرئيسي",
      asset_number: "DR-NTH-003",
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

function getTicketIdentifier(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
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

function getReporterName(ticket) {
  return (
    ticket?.reporter_name ||
    ticket?.reporterName ||
    ticket?.reporter_profile?.full_name ||
    "مبلّغ غير معروف"
  );
}

function isTicketOverdue(ticket) {
  if (!ticket) {
    return false;
  }

  if (
    TERMINAL_STATUSES.includes(
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
  const collectedTickets = [];

  STORAGE_KEYS.forEach(
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
          collectedTickets.push(
            ...parsedValue
          );
        }
      } catch {
        return;
      }
    }
  );

  return collectedTickets;
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

function matchesStatusFilter(
  ticket,
  statusFilter
) {
  if (
    !statusFilter ||
    statusFilter === "ALL"
  ) {
    return true;
  }

  if (
    statusFilter === "ACTIVE"
  ) {
    return ACTIVE_STATUSES.includes(
      ticket.status
    );
  }

  if (
    statusFilter === "ASSIGNED"
  ) {
    return [
      "ASSIGNED",
      "ACCEPTED",
    ].includes(ticket.status);
  }

  return (
    ticket.status === statusFilter
  );
}

function matchesSearch(
  ticket,
  searchValue
) {
  const search =
    normalizeText(searchValue);

  if (!search) {
    return true;
  }

  const searchableText =
    normalizeText(
      [
        getTicketIdentifier(ticket),
        ticket?.title,
        ticket?.description,
        getLocationName(ticket),
        getCategoryName(ticket),
        getAssetName(ticket),
        getReporterName(ticket),
      ].join(" ")
    );

  return searchableText.includes(
    search
  );
}

function getPriorityWeight(priority) {
  switch (priority) {
    case "EMERGENCY":
      return 4;

    case "HIGH":
      return 3;

    case "MEDIUM":
      return 2;

    case "LOW":
      return 1;

    default:
      return 0;
  }
}

function sortTickets(tickets) {
  return [...tickets].sort(
    (
      firstTicket,
      secondTicket
    ) => {
      const firstOverdue =
        isTicketOverdue(
          firstTicket
        )
          ? 1
          : 0;

      const secondOverdue =
        isTicketOverdue(
          secondTicket
        )
          ? 1
          : 0;

      if (
        firstOverdue !==
        secondOverdue
      ) {
        return (
          secondOverdue -
          firstOverdue
        );
      }

      const priorityDifference =
        getPriorityWeight(
          secondTicket.priority
        ) -
        getPriorityWeight(
          firstTicket.priority
        );

      if (
        priorityDifference !== 0
      ) {
        return priorityDifference;
      }

      const firstDate =
        new Date(
          firstTicket.updated_at ||
            firstTicket.created_at ||
            0
        ).getTime();

      const secondDate =
        new Date(
          secondTicket.updated_at ||
            secondTicket.created_at ||
            0
        ).getTime();

      return secondDate - firstDate;
    }
  );
}

function getTaskMessage(status) {
  switch (status) {
    case "ASSIGNED":
      return "مهمة جديدة بانتظار قبولك";

    case "ACCEPTED":
      return "تم قبول المهمة ويمكن بدء العمل";

    case "IN_PROGRESS":
      return "أعمال الصيانة جارية";

    case "WAITING_PARTS":
      return "المهمة متوقفة لحين توفر القطعة";

    case "PENDING_APPROVAL":
      return "تم إرسال المهمة للاعتماد";

    case "REOPENED":
      return "أعيد فتح المهمة وتحتاج إلى متابعة";

    case "CLOSED":
      return "تم إغلاق المهمة";

    case "CANCELLED":
      return "تم إلغاء المهمة";

    default:
      return "افتح المهمة لمشاهدة التفاصيل";
  }
}

function getTaskMessageColor(
  status
) {
  switch (status) {
    case "ASSIGNED":
    case "ACCEPTED":
      return "#176c62";

    case "IN_PROGRESS":
      return "#986716";

    case "WAITING_PARTS":
      return "#a05d13";

    case "PENDING_APPROVAL":
      return "#6951a3";

    case "REOPENED":
      return "#a84132";

    case "CLOSED":
      return "#4c7f68";

    default:
      return "#71817f";
  }
}

/* ==================================================
   الصفحة
================================================== */

export default function MyTicketsPage() {
  const {
    user,
    role: authRole,
    fullName,
    organizationId,
    isDemo,
  } = useAuth();

  const role = normalizeRole(
    authRole || user?.role
  );

  const [
    tickets,
    setTickets,
  ] = useState([]);

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

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ACTIVE");

  /* ==================================================
     تحميل مهام الفني
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
          if (!user?.id) {
            throw new Error(
              "تعذر قراءة حساب الفني الحالي."
            );
          }

          /*
           * الوضع التجريبي.
           */
          if (
            isDemo ||
            !isSupabaseConfigured
          ) {
            const storedTickets = readLocalTickets();

            const combinedTickets =
              removeDuplicateTickets(storedTickets);

            const technicianTickets =
              combinedTickets.filter(
                (ticket) =>
                  String(
                    ticket
                      ?.assigned_technician_id ||
                      ticket
                        ?.assignedTechnicianId ||
                      ""
                  ) ===
                  String(user.id)
              );

            setTickets(
              sortTickets(
                technicianTickets
              )
            );

            return;
          }

          /*
           * الوضع الحقيقي.
           */
          const filters = {
            technicianId: user.id,

            limit: 500,

            sortBy:
              "updated_at",

            sortDirection:
              "desc",
          };

          if (organizationId) {
            filters.organizationId =
              organizationId;
          }

          const result =
            await listTickets(
              filters
            );

          /*
           * فلترة إضافية داخل الواجهة
           * للتأكد من عدم عرض مهمة لفني آخر.
           */
          const technicianTickets =
            (result || []).filter(
              (ticket) =>
                String(
                  ticket
                    ?.assigned_technician_id ||
                    ticket
                      ?.assignedTechnicianId ||
                    ""
                ) ===
                String(user.id)
            );

          setTickets(
            sortTickets(
              technicianTickets
            )
          );
        } catch (loadError) {
          setTickets([]);

          setError(
            loadError instanceof Error
              ? loadError.message
              : "تعذر تحميل مهام الصيانة."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        user?.id,
        organizationId,
        isDemo,
      ]
    );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  /* ==================================================
     المهام المعروضة والإحصاءات
  ================================================== */

  const visibleTickets =
    useMemo(() => {
      return tickets.filter(
        (ticket) =>
          matchesStatusFilter(
            ticket,
            statusFilter
          ) &&
          matchesSearch(
            ticket,
            search
          )
      );
    }, [
      tickets,
      statusFilter,
      search,
    ]);

  const statistics =
    useMemo(() => {
      return {
        total:
          tickets.length,

        active:
          tickets.filter(
            (ticket) =>
              ACTIVE_STATUSES.includes(
                ticket.status
              )
          ).length,

        newTasks:
          tickets.filter(
            (ticket) =>
              [
                "ASSIGNED",
                "ACCEPTED",
              ].includes(
                ticket.status
              )
          ).length,

        inProgress:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              "IN_PROGRESS"
          ).length,

        waitingParts:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              "WAITING_PARTS"
          ).length,

        pendingApproval:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              "PENDING_APPROVAL"
          ).length,

        overdue:
          tickets.filter(
            isTicketOverdue
          ).length,
      };
    }, [tickets]);

  /* ==================================================
     أحداث الصفحة
  ================================================== */

  function openTicket(ticket) {
    const ticketId =
      ticket?.id ||
      ticket?.ticket_number ||
      ticket?.ticketNumber;

    if (!ticketId) {
      return;
    }

    navigate(
      `/tickets/${encodeURIComponent(
        ticketId
      )}`
    );
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("ACTIVE");
  }

  /* ==================================================
     التحقق من دور المستخدم
  ================================================== */

  if (
    !loading &&
    role &&
    role !== "TECHNICIAN"
  ) {
    return (
      <section className="panel">
        <EmptyState
          icon="!"
          title="هذه الصفحة مخصصة للفني"
          description="استخدم القائمة الرئيسية للوصول إلى الصفحة المناسبة لصلاحية حسابك."
          actionLabel="العودة إلى الصفحة الرئيسية"
          onAction={() =>
            navigate("/")
          }
        />
      </section>
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
            مهام فني الصيانة
          </small>

          <h1>
            مهامي
            {fullName
              ? ` — ${fullName}`
              : ""}
          </h1>

          <p>
            تابع المهام المسندة إليك
            وحدّث حالتها من صفحة تفاصيل
            كل طلب.
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
          disabled={
            loading ||
            refreshing
          }
        >
          {refreshing
            ? "جاري التحديث…"
            : "↻ تحديث المهام"}
        </button>
      </div>

      {isDemo ||
      !isSupabaseConfigured ? (
        <div
          className="demo-callout"
          style={{
            marginBottom: "16px",
          }}
        >
          <strong>
            الوضع التجريبي
          </strong>

          <span>
            تعرض الصفحة مهامًا تجريبية
            مسندة إلى حساب الفني الحالي.
          </span>
        </div>
      ) : null}

      {error ? (
        <div
          className="form-error"
          role="alert"
          style={{
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* الإحصاءات */}
      <section
        className="stats-grid"
        style={{
          marginBottom: "18px",
        }}
      >
        <article className="stat-card">
          <div>
            <small>
              المهام النشطة
            </small>

            <strong>
              {statistics.active}
            </strong>

            <p>
              مهام تحتاج إلى متابعة
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
              مهام جديدة
            </small>

            <strong>
              {statistics.newTasks}
            </strong>

            <p>
              بانتظار القبول أو البدء
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
              جاري العمل
            </small>

            <strong>
              {statistics.inProgress}
            </strong>

            <p>
              مهام قيد التنفيذ
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
              مهام متأخرة
            </small>

            <strong>
              {statistics.overdue}
            </strong>

            <p>
              تجاوزت موعد الاستحقاق
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

      {/* البحث والفلاتر */}
      <section
        className="panel"
        style={{
          display: "grid",
          gap: "14px",
          marginBottom: "16px",
          padding: "18px",
        }}
      >
        <div
          className="panel-head"
          style={{
            padding: 0,
          }}
        >
          <div>
            <h2>
              البحث في المهام
            </h2>

            <p>
              ابحث برقم الطلب أو عنوان
              المشكلة أو الموقع
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "minmax(220px, 1fr) minmax(170px, 240px) auto",

            gap: "10px",

            alignItems: "end",
          }}
        >
          <label
            style={{
              margin: 0,
            }}
          >
            البحث

            <input
              type="search"
              value={search}
              placeholder="رقم الطلب، العنوان، الجهاز، الموقع..."
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              disabled={
                loading ||
                refreshing
              }
            />
          </label>

          <label
            style={{
              margin: 0,
            }}
          >
            حالة المهمة

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              disabled={
                loading ||
                refreshing
              }
            >
              {STATUS_FILTERS.map(
                (filter) => (
                  <option
                    key={
                      filter.value
                    }
                    value={
                      filter.value
                    }
                  >
                    {filter.label}
                  </option>
                )
              )}
            </select>
          </label>

          <button
            type="button"
            className="secondary"
            onClick={resetFilters}
            disabled={
              loading ||
              refreshing ||
              (!search &&
                statusFilter ===
                  "ACTIVE")
            }
          >
            إعادة تعيين
          </button>
        </div>
      </section>

      {/* قائمة المهام */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>
              قائمة مهامي
            </h2>

            <p>
              {loading
                ? "جاري تحميل المهام…"
                : `${visibleTickets.length} مهمة مطابقة`}
            </p>
          </div>

          {!loading ? (
            <span className="badge green">
              الإجمالي:{" "}
              {statistics.total}
            </span>
          ) : null}
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
                    height: "82px",
                    borderRadius:
                      "10px",
                    background:
                      "#edf1f0",
                  }}
                />
              )
            )}
          </div>
        ) : visibleTickets.length ===
          0 ? (
          <EmptyState
            icon="⚒"
            title="لا توجد مهام مطابقة"
            description={
              tickets.length === 0
                ? "لا توجد مهام صيانة مسندة إليك حاليًا."
                : "غيّر البحث أو حالة المهمة لعرض نتائج أخرى."
            }
            actionLabel={
              tickets.length === 0
                ? "تحديث المهام"
                : "إعادة تعيين الفلاتر"
            }
            onAction={
              tickets.length === 0
                ? () =>
                    loadTickets()
                : resetFilters
            }
          />
        ) : (
          <div className="ticket-list">
            {visibleTickets.map(
              (ticket) => (
                <button
                  type="button"
                  className="ticket-row compact-row"
                  key={
                    ticket.id ||
                    ticket.ticket_number
                  }
                  onClick={() =>
                    openTicket(ticket)
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

                    <span
                      style={{
                        marginTop: "5px",
                        color:
                          getTaskMessageColor(
                            ticket.status
                          ),
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      {getTaskMessage(
                        ticket.status
                      )}
                    </span>
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

                      {getReporterName(
                        ticket
                      )}
                    </small>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
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

                    {isTicketOverdue(
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
                      display: "grid",
                      gap: "5px",
                      minWidth: "120px",
                    }}
                  >
                    <small>
                      موعد الاستحقاق
                    </small>

                    <strong
                      className={
                        isTicketOverdue(
                          ticket
                        )
                          ? "danger-text"
                          : ""
                      }
                      style={{
                        fontSize: "9px",
                      }}
                    >
                      {ticket.due_at
                        ? formatDate(
                            ticket.due_at,
                            {
                              withTime:
                                true,
                            }
                          )
                        : "غير محدد"}
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
