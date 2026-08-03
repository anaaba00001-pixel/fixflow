import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import TicketPriorityBadge from "../../components/tickets/TicketPriorityBadge";
import TicketStatusBadge from "../../components/tickets/TicketStatusBadge";

import { useAuth } from "../../hooks/useAuth";
import { isSupabaseConfigured } from "../../lib/supabase";
import { navigate } from "../../routes/AppRouter";
import { listTickets } from "../../services/ticketService";
import { formatDate } from "../../utils/formatDate";

/**
 * بيانات تجريبية تظهر عندما لا يكون Supabase متصلًا.
 */
const DEMO_REPORTER_TICKETS = [
  {
    id: "reporter-ticket-1",
    ticket_number: "MT-2026-00241",
    title: "تسرب مياه في دورة المياه",
    description:
      "يوجد تسرب مياه أسفل المغسلة ويحتاج إلى الفحص.",
    priority: "HIGH",
    status: "IN_PROGRESS",
    location_name: "فرع الرياض الرئيسي",
    asset_name: "مغسلة دورة المياه",
    created_at: "2026-08-01T09:30:00+03:00",
    reporter_email: "reporter@fixflow.demo",
  },
  {
    id: "reporter-ticket-2",
    ticket_number: "MT-2026-00235",
    title: "إضاءة الممر لا تعمل",
    description:
      "ثلاثة مصابيح في الممر الشرقي لا تعمل.",
    priority: "MEDIUM",
    status: "PENDING_APPROVAL",
    location_name: "فرع الرياض الرئيسي",
    asset_name: "إنارة الممر الشرقي",
    created_at: "2026-07-30T13:10:00+03:00",
    reporter_email: "reporter@fixflow.demo",
  },
  {
    id: "reporter-ticket-3",
    ticket_number: "MT-2026-00210",
    title: "مقبض الباب مكسور",
    description:
      "تم الإبلاغ عن مقبض باب غرفة الاجتماعات.",
    priority: "LOW",
    status: "CLOSED",
    location_name: "المبنى الإداري",
    asset_name: "باب غرفة الاجتماعات",
    created_at: "2026-07-25T08:40:00+03:00",
    reporter_email: "reporter@fixflow.demo",
  },
];

const OPEN_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "REOPENED",
];

const PROCESSING_STATUSES = [
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
];

const CLOSED_STATUSES = [
  "CLOSED",
  "CANCELLED",
];

const STATUS_FILTERS = [
  {
    value: "ALL",
    label: "جميع البلاغات",
  },
  {
    value: "OPEN",
    label: "مفتوحة",
  },
  {
    value: "PROCESSING",
    label: "قيد المعالجة",
  },
  {
    value: "CLOSED",
    label: "مكتملة",
  },
];

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getTicketNumber(ticket) {
  return (
    ticket.ticket_number ||
    ticket.ticketNumber ||
    ticket.code ||
    ticket.id ||
    "—"
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
    "بلاغ عام"
  );
}

function getReporterId(ticket) {
  return (
    ticket.reporter_user_id ||
    ticket.reporterUserId ||
    ticket.requester_id ||
    ticket.requesterId ||
    ticket.created_by ||
    ticket.createdBy ||
    ticket.user_id ||
    ticket.userId ||
    null
  );
}

/**
 * التحقق من أن البلاغ يعود للمستخدم الحالي.
 *
 * التحقق الأساسي يكون بمعرف المستخدم.
 * البريد ورقم الهاتف يستخدمان فقط لدعم البيانات القديمة.
 */
function isReporterTicket(ticket, user) {
  if (!ticket || !user) {
    return false;
  }

  const reporterId = getReporterId(ticket);

  if (
    reporterId &&
    user.id &&
    String(reporterId) === String(user.id)
  ) {
    return true;
  }

  const userEmail = normalizeValue(user.email);

  const ticketEmail = normalizeValue(
    ticket.reporter_email ||
      ticket.reporterEmail
  );

  const reporterContact = normalizeValue(
    ticket.reporter_contact ||
      ticket.reporterContact
  );

  if (
    userEmail &&
    (
      ticketEmail === userEmail ||
      reporterContact.includes(userEmail)
    )
  ) {
    return true;
  }

  const userPhone = normalizeValue(user.phone);

  if (
    userPhone &&
    reporterContact.includes(userPhone)
  ) {
    return true;
  }

  return false;
}

function readStoredReporterTickets(user) {
  const storageKeys = [
    "fixflow_reporter_tickets",
    "fixflow_public_tickets",
  ];

  const storedTickets = [];

  storageKeys.forEach((storageKey) => {
    try {
      const value =
        localStorage.getItem(storageKey);

      if (!value) {
        return;
      }

      const parsedValue = JSON.parse(value);

      if (Array.isArray(parsedValue)) {
        storedTickets.push(...parsedValue);
      }
    } catch {
      return;
    }
  });

  const ownedTickets = storedTickets.filter(
    (ticket) => isReporterTicket(ticket, user)
  );

  const uniqueTickets = new Map();

  ownedTickets.forEach((ticket) => {
    const key = String(
      ticket.id ||
        ticket.ticket_number ||
        ticket.ticketNumber
    );

    uniqueTickets.set(key, ticket);
  });

  return [...uniqueTickets.values()];
}

function matchesStatusFilter(ticket, filter) {
  const status = String(
    ticket.status || ""
  ).toUpperCase();

  if (filter === "ALL") {
    return true;
  }

  if (filter === "OPEN") {
    return OPEN_STATUSES.includes(status);
  }

  if (filter === "PROCESSING") {
    return PROCESSING_STATUSES.includes(
      status
    );
  }

  if (filter === "CLOSED") {
    return CLOSED_STATUSES.includes(status);
  }

  return true;
}

function getPriorityColor(priority) {
  const colors = {
    LOW: "#578db8",
    MEDIUM: "#d5a333",
    HIGH: "#e58b47",
    EMERGENCY: "#d84f4f",
  };

  return colors[priority] || colors.MEDIUM;
}

export default function ReporterDashboardPage() {
  const {
    user,
    fullName,
    organizationId,
    isRegisteredReporter,
  } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const loadReporterTickets =
    useCallback(async () => {
      if (!user) {
        setTickets([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setPageError("");

      try {
        /**
         * وضع العرض التجريبي.
         */
        if (!isSupabaseConfigured) {
          const storedTickets =
            readStoredReporterTickets(user);

          const demoTickets = [
            ...storedTickets,
            ...DEMO_REPORTER_TICKETS,
          ];

          const uniqueTickets = new Map();

          demoTickets.forEach((ticket) => {
            const key = String(
              ticket.id ||
                ticket.ticket_number ||
                ticket.ticketNumber
            );

            uniqueTickets.set(key, ticket);
          });

          setTickets(
            [...uniqueTickets.values()].sort(
              (firstTicket, secondTicket) =>
                new Date(
                  secondTicket.created_at || 0
                ).getTime() -
                new Date(
                  firstTicket.created_at || 0
                ).getTime()
            )
          );

          return;
        }

        /**
         * في وضع Supabase تعتمد الحماية الأساسية
         * على سياسات RLS في قاعدة البيانات.
         */
        const result = await listTickets({
          organizationId,
          limit: 100,
          sortBy: "created_at",
          sortDirection: "desc",
        });

        const ownedTickets = result.filter(
          (ticket) =>
            isReporterTicket(ticket, user)
        );

        setTickets(ownedTickets);
      } catch (error) {
        setPageError(
          error?.message ||
            "تعذر تحميل بلاغاتك حاليًا."
        );
      } finally {
        setLoading(false);
      }
    }, [user, organizationId]);

  useEffect(() => {
    loadReporterTickets();
  }, [loadReporterTickets]);

  const statistics = useMemo(() => {
    return tickets.reduce(
      (result, ticket) => {
        const status = String(
          ticket.status || ""
        ).toUpperCase();

        result.total += 1;

        if (OPEN_STATUSES.includes(status)) {
          result.open += 1;
        }

        if (
          PROCESSING_STATUSES.includes(status)
        ) {
          result.processing += 1;
        }

        if (status === "CLOSED") {
          result.closed += 1;
        }

        return result;
      },
      {
        total: 0,
        open: 0,
        processing: 0,
        closed: 0,
      }
    );
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch =
      normalizeValue(search);

    return tickets.filter((ticket) => {
      const matchesStatus =
        matchesStatusFilter(
          ticket,
          statusFilter
        );

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValue = normalizeValue(
        [
          getTicketNumber(ticket),
          ticket.title,
          ticket.description,
          getLocationName(ticket),
          getAssetName(ticket),
        ].join(" ")
      );

      return searchableValue.includes(
        normalizedSearch
      );
    });
  }, [tickets, search, statusFilter]);

  function openTicket(ticket) {
    const ticketId =
      ticket.id ||
      ticket.ticket_number ||
      ticket.ticketNumber;

    if (ticketId) {
      navigate(
        `/tickets/${encodeURIComponent(
          ticketId
        )}`
      );
    }
  }

  function createNewTicket() {
    navigate("/reporter/new");
  }

  if (!isRegisteredReporter) {
    return (
      <EmptyState
        icon="!"
        title="لا يمكن فتح الصفحة"
        description="هذه الصفحة مخصصة للمبلّغ المسجّل فقط."
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <small>حساب المبلّغ المسجّل</small>

          <h1>
            مرحبًا
            {fullName ? `، ${fullName}` : ""}
          </h1>

          <p>
            أبلغ عن الأعطال وتابع جميع بلاغاتك
            من مكان واحد.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={createNewTicket}
        >
          <span aria-hidden="true">＋</span>
          {" "}
          إنشاء بلاغ
        </button>
      </div>

      {pageError && (
        <div
          className="alert-banner"
          role="alert"
        >
          <span className="alert-icon">
            !
          </span>

          <div>
            <strong>
              تعذر تحميل البلاغات
            </strong>

            <p>{pageError}</p>
          </div>

          <button
            type="button"
            onClick={loadReporterTickets}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <div>
            <small>جميع بلاغاتي</small>
            <strong>
              {statistics.total}
            </strong>
            <p>إجمالي البلاغات المسجلة</p>
          </div>

          <span className="stat-icon blue-bg">
            ▤
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>البلاغات المفتوحة</small>
            <strong>
              {statistics.open}
            </strong>
            <p>بانتظار الفرز أو التعيين</p>
          </div>

          <span className="stat-icon amber-bg">
            ◷
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>قيد المعالجة</small>
            <strong>
              {statistics.processing}
            </strong>
            <p>يعمل فريق الصيانة عليها</p>
          </div>

          <span className="stat-icon red-bg">
            ⚙
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>مكتملة</small>
            <strong>
              {statistics.closed}
            </strong>
            <p>تم إصلاحها وإغلاقها</p>
          </div>

          <span className="stat-icon green-bg">
            ✓
          </span>
        </article>
      </section>

      <article className="panel tickets-panel">
        <div className="panel-head">
          <div>
            <h2>بلاغاتي الأخيرة</h2>

            <p>
              يمكنك فتح أي بلاغ لمشاهدة التفاصيل
              وآخر التحديثات.
            </p>
          </div>

          <button
            type="button"
            className="link-button"
            onClick={loadReporterTickets}
            disabled={loading}
          >
            {loading ? "جاري التحديث…" : "تحديث"}
          </button>
        </div>

        <div className="toolbar">
          <label className="search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث برقم البلاغ أو عنوانه..."
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            aria-label="تصفية البلاغات حسب الحالة"
          >
            {STATUS_FILTERS.map((filter) => (
              <option
                key={filter.value}
                value={filter.value}
              >
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty">
            جاري تحميل بلاغاتك…
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon="▤"
            title={
              tickets.length === 0
                ? "لا توجد بلاغات حتى الآن"
                : "لا توجد نتائج مطابقة"
            }
            description={
              tickets.length === 0
                ? "أنشئ أول بلاغ صيانة وسيظهر هنا مباشرة."
                : "غيّر كلمات البحث أو حالة البلاغ."
            }
            actionLabel={
              tickets.length === 0
                ? "إنشاء بلاغ جديد"
                : ""
            }
            onAction={createNewTicket}
          />
        ) : (
          <div className="ticket-list">
            {filteredTickets.map((ticket) => (
              <button
                type="button"
                className="ticket-row compact-row"
                key={
                  ticket.id ||
                  getTicketNumber(ticket)
                }
                onClick={() =>
                  openTicket(ticket)
                }
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background:
                      getPriorityColor(
                        ticket.priority
                      ),
                  }}
                />

                <div className="ticket-main">
                  <strong>
                    {ticket.title ||
                      "بلاغ صيانة"}
                  </strong>

                  <small>
                    {getTicketNumber(ticket)}
                    {" · "}
                    {getAssetName(ticket)}
                  </small>
                </div>

                <div className="ticket-location">
                  <strong>
                    {getLocationName(ticket)}
                  </strong>

                  <small>
                    {formatDate(
                      ticket.created_at,
                      {
                        withTime: false,
                      }
                    )}
                  </small>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: "6px",
                  }}
                >
                  <TicketPriorityBadge
                    priority={ticket.priority}
                    showIcon={false}
                  />

                  <TicketStatusBadge
                    status={ticket.status}
                    showIcon={false}
                  />
                </div>

                <span
                  className="chevron"
                  aria-hidden="true"
                >
                  ‹
                </span>
              </button>
            ))}
          </div>
        )}
      </article>
    </>
  );
}