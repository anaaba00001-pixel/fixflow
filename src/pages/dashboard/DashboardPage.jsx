import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";

import {
  PRIORITY_LABELS,
} from "../../constants/priorities";

import {
  STATUS_LABELS,
} from "../../constants/ticketStatuses";

import useAuth from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
} from "../../lib/supabase";

import {
  navigate,
} from "../../routes/AppRouter";

import {
  getDashboardData,
} from "../../services/dashboardService";

/* ==================================================
   القيم الفارغة
================================================== */

const EMPTY_STATS = {
  totalTickets: 0,
  openTickets: 0,
  newTickets: 0,
  assignedTickets: 0,
  inProgressTickets: 0,
  pendingApprovalTickets: 0,
  closedTickets: 0,
  cancelledTickets: 0,
  overdueTickets: 0,
  emergencyTickets: 0,
  unassignedTickets: 0,
  completionRate: 0,
  overdueRate: 0,
  averageResponseMinutes: 0,
  averageRepairMinutes: 0,
};

const EMPTY_DASHBOARD = {
  stats: EMPTY_STATS,

  recentTickets: [],
  overdueTickets: [],
  emergencyTickets: [],

  ticketsByStatus: [],
  ticketsByPriority: [],

  technicianWorkload: [],
  locationWorkload: [],
};

/* ==================================================
   بيانات الوضع التجريبي
================================================== */

const DEMO_RECENT_TICKETS = [
  {
    id: "demo-ticket-1",
    ticket_number: "MT-2026-00125",
    title: "المكيف لا يبرد",
    priority: "EMERGENCY",
    status: "PENDING_APPROVAL",
    location_id: "demo-location-riyadh",
    created_at:
      "2026-08-03T00:30:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },
  },

  {
    id: "demo-ticket-2",
    ticket_number: "MT-2026-00124",
    title: "تسرب مياه في دورة المياه",
    priority: "HIGH",
    status: "IN_PROGRESS",
    location_id: "demo-location-riyadh",
    created_at:
      "2026-08-02T22:20:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },
  },

  {
    id: "demo-ticket-3",
    ticket_number: "MT-2026-00123",
    title: "عطل في إنارة الممر",
    priority: "MEDIUM",
    status: "ASSIGNED",
    location_id: "demo-location-north",
    created_at:
      "2026-08-02T17:40:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },
  },

  {
    id: "demo-ticket-4",
    ticket_number: "MT-2026-00122",
    title: "صوت مرتفع من المصعد",
    priority: "HIGH",
    status: "WAITING_PARTS",
    location_id: "demo-location-riyadh",
    created_at:
      "2026-08-02T12:10:00+03:00",

    locations: {
      id: "demo-location-riyadh",
      name: "فرع الرياض",
    },
  },

  {
    id: "demo-ticket-5",
    ticket_number: "MT-2026-00121",
    title: "الباب الإلكتروني لا يفتح",
    priority: "MEDIUM",
    status: "CLOSED",
    location_id: "demo-location-north",
    created_at:
      "2026-08-01T19:45:00+03:00",

    locations: {
      id: "demo-location-north",
      name: "الفرع الشمالي",
    },
  },
];

const DEMO_TECHNICIAN_WORKLOAD = [
  {
    id: "technician-1",
    name: "محمد العتيبي",
    specialization: "تكييف وتبريد",
    openTickets: 3,
    closedTickets: 8,
    overdueTickets: 1,
  },

  {
    id: "technician-2",
    name: "أحمد الشمري",
    specialization: "كهرباء",
    openTickets: 2,
    closedTickets: 6,
    overdueTickets: 0,
  },

  {
    id: "technician-3",
    name: "سالم الحربي",
    specialization: "سباكة",
    openTickets: 4,
    closedTickets: 5,
    overdueTickets: 2,
  },
];

const DEMO_LOCATION_WORKLOAD = [
  {
    id: "demo-location-riyadh",
    name: "فرع الرياض",
    totalTickets: 30,
    openTickets: 9,
    closedTickets: 21,
    overdueTickets: 2,
  },

  {
    id: "demo-location-north",
    name: "الفرع الشمالي",
    totalTickets: 18,
    openTickets: 5,
    closedTickets: 13,
    overdueTickets: 1,
  },
];

function createDemoDashboard(role) {
  const platformStats = {
    ...EMPTY_STATS,

    totalTickets: 142,
    openTickets: 34,
    newTickets: 9,
    assignedTickets: 7,
    inProgressTickets: 13,
    pendingApprovalTickets: 5,
    closedTickets: 101,
    cancelledTickets: 7,
    overdueTickets: 8,
    emergencyTickets: 4,
    unassignedTickets: 6,
    completionRate: 71,
    overdueRate: 24,
    averageResponseMinutes: 18,
    averageRepairMinutes: 145,
  };

  const organizationStats = {
    ...EMPTY_STATS,

    totalTickets: 48,
    openTickets: 14,
    newTickets: 4,
    assignedTickets: 3,
    inProgressTickets: 5,
    pendingApprovalTickets: 2,
    closedTickets: 31,
    cancelledTickets: 3,
    overdueTickets: 3,
    emergencyTickets: 2,
    unassignedTickets: 2,
    completionRate: 65,
    overdueRate: 21,
    averageResponseMinutes: 15,
    averageRepairMinutes: 125,
  };

  const branchStats = {
    ...EMPTY_STATS,

    totalTickets: 30,
    openTickets: 9,
    newTickets: 3,
    assignedTickets: 2,
    inProgressTickets: 3,
    pendingApprovalTickets: 1,
    closedTickets: 21,
    cancelledTickets: 0,
    overdueTickets: 2,
    emergencyTickets: 1,
    unassignedTickets: 1,
    completionRate: 70,
    overdueRate: 22,
    averageResponseMinutes: 12,
    averageRepairMinutes: 110,
  };

  const inventoryStats = {
    ...organizationStats,

    totalTickets: 48,
    openTickets: 14,
    inProgressTickets: 5,
    closedTickets: 31,
    overdueTickets: 3,
  };

  let stats = organizationStats;

  if (role === "PLATFORM_ADMIN") {
    stats = platformStats;
  }

  if (role === "BRANCH_MANAGER") {
    stats = branchStats;
  }

  if (role === "INVENTORY_MANAGER") {
    stats = inventoryStats;
  }

  return {
    stats,

    recentTickets:
      DEMO_RECENT_TICKETS,

    emergencyTickets:
      DEMO_RECENT_TICKETS.filter(
        (ticket) =>
          ticket.priority ===
          "EMERGENCY"
      ),

    overdueTickets: [
      DEMO_RECENT_TICKETS[1],
      DEMO_RECENT_TICKETS[3],
    ],

    ticketsByStatus: [
      {
        key: "NEW",
        label: "جديد",
        value: stats.newTickets,
      },
      {
        key: "ASSIGNED",
        label: "تم التعيين",
        value: stats.assignedTickets,
      },
      {
        key: "IN_PROGRESS",
        label: "جاري العمل",
        value: stats.inProgressTickets,
      },
      {
        key: "PENDING_APPROVAL",
        label: "بانتظار الاعتماد",
        value:
          stats.pendingApprovalTickets,
      },
      {
        key: "CLOSED",
        label: "مغلق",
        value: stats.closedTickets,
      },
    ],

    ticketsByPriority: [
      {
        key: "EMERGENCY",
        label: "طارئة",
        value: stats.emergencyTickets,
      },
      {
        key: "HIGH",
        label: "مرتفعة",
        value: 8,
      },
      {
        key: "MEDIUM",
        label: "متوسطة",
        value: 19,
      },
      {
        key: "LOW",
        label: "منخفضة",
        value: 17,
      },
    ],

    technicianWorkload:
      DEMO_TECHNICIAN_WORKLOAD,

    locationWorkload:
      DEMO_LOCATION_WORKLOAD,
  };
}

/* ==================================================
   دوال مساعدة
================================================== */

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function getGreeting() {
  const currentHour =
    new Date().getHours();

  if (currentHour < 12) {
    return "صباح الخير";
  }

  return "مساء الخير";
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat(
    "ar-SA",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(new Date());
}

function formatRelativeTime(value) {
  if (!value) {
    return "منذ وقت قصير";
  }

  const timestamp =
    new Date(value).getTime();

  if (
    Number.isNaN(timestamp)
  ) {
    return "منذ وقت قصير";
  }

  const seconds = Math.max(
    Math.floor(
      (Date.now() - timestamp) /
        1000
    ),
    0
  );

  if (seconds < 60) {
    return "الآن";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `منذ ${minutes} دقيقة`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `منذ ${hours} ساعة`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 30) {
    return `منذ ${days} يوم`;
  }

  return new Intl.DateTimeFormat(
    "ar-SA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function getLocationName(ticket) {
  return (
    ticket?.location_name ||
    ticket?.location?.name ||
    ticket?.locations?.name ||
    "موقع غير محدد"
  );
}

function getStatusLabel(status) {
  return (
    STATUS_LABELS[status] ||
    status ||
    "غير محدد"
  );
}

function getPriorityLabel(priority) {
  return (
    PRIORITY_LABELS[priority] ||
    priority ||
    "غير محددة"
  );
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "CLOSED":
      return "green";

    case "IN_PROGRESS":
    case "WAITING_PARTS":
      return "amber";

    case "PENDING_APPROVAL":
    case "REOPENED":
      return "violet";

    case "CANCELLED":
      return "slate";

    default:
      return "blue";
  }
}

function getPriorityClass(priority) {
  return String(
    priority || "MEDIUM"
  )
    .trim()
    .toLowerCase();
}

function calculatePercentage(
  value,
  total
) {
  if (!total) {
    return 0;
  }

  return Math.min(
    Math.max(
      Math.round(
        (Number(value || 0) /
          Number(total)) *
          100
      ),
      0
    ),
    100
  );
}

function getDistributionValue(
  distribution,
  key
) {
  const item =
    distribution?.find(
      (entry) =>
        entry.key === key
    );

  return Number(
    item?.value || 0
  );
}

function getPrimaryLocationId(user) {
  const directLocationId =
    user?.location_id ||
    user?.locationId;

  if (directLocationId) {
    return directLocationId;
  }

  const locationIds =
    user?.location_ids ||
    user?.locationIds ||
    [];

  if (
    Array.isArray(locationIds)
  ) {
    return locationIds[0] || null;
  }

  return null;
}

function getRoleInformation(role) {
  switch (role) {
    case "PLATFORM_ADMIN":
      return {
        label: "مدير المنصة",

        description:
          "نظرة شاملة على أداء المنشآت وطلبات الصيانة في المنصة.",
      };

    case "ORGANIZATION_ADMIN":
      return {
        label: "مدير المنشأة",

        description:
          "تابع أداء المنشأة والفروع وفرق الصيانة.",
      };

    case "BRANCH_MANAGER":
      return {
        label: "مدير الفرع",

        description:
          "تابع طلبات الصيانة والأجهزة داخل فرعك.",
      };

    case "SUPERVISOR":
      return {
        label: "مشرف الصيانة",

        description:
          "تابع الطلبات ووزّع المهام على الفنيين.",
      };

    case "INVENTORY_MANAGER":
      return {
        label: "مسؤول المخزون",

        description:
          "تابع الطلبات التي تحتاج قطع غيار وحالة الأصول.",
      };

    default:
      return {
        label: "لوحة التحكم",

        description:
          "تابع أهم بيانات الصيانة.",
      };
  }
}

function getQuickActions(role) {
  switch (role) {
    case "PLATFORM_ADMIN":
      return [
        {
          label: "إدارة المستخدمين",
          description:
            "عرض حسابات مستخدمي المنصة",
          icon: "♙",
          path: "/users",
        },
        {
          label: "عرض التقارير",
          description:
            "متابعة أداء المنشآت",
          icon: "▥",
          path: "/reports",
        },
        {
          label: "طلبات الصيانة",
          description:
            "عرض جميع الطلبات",
          icon: "▤",
          path: "/tickets",
        },
      ];

    case "ORGANIZATION_ADMIN":
      return [
        {
          label: "طلبات الصيانة",
          description:
            "إدارة طلبات المنشأة",
          icon: "▤",
          path: "/tickets",
        },
        {
          label: "إدارة الأصول",
          description:
            "عرض الأجهزة والمعدات",
          icon: "⌁",
          path: "/assets",
        },
        {
          label: "إدارة المستخدمين",
          description:
            "إدارة فريق المنشأة",
          icon: "♙",
          path: "/users",
        },
      ];

    case "BRANCH_MANAGER":
      return [
        {
          label: "طلبات الفرع",
          description:
            "متابعة طلبات فرعك",
          icon: "▤",
          path: "/tickets",
        },
        {
          label: "أصول الفرع",
          description:
            "عرض أجهزة ومعدات الفرع",
          icon: "⌁",
          path: "/assets",
        },
        {
          label: "تقارير الفرع",
          description:
            "عرض مؤشرات أداء الفرع",
          icon: "▥",
          path: "/reports",
        },
      ];

    case "SUPERVISOR":
      return [
        {
          label: "الطلبات الجديدة",
          description:
            "مراجعة وتعيين الطلبات",
          icon: "▤",
          path: "/tickets",
        },
        {
          label: "الفنيون",
          description:
            "متابعة فريق الصيانة",
          icon: "⚒",
          path: "/users",
        },
        {
          label: "تقارير الصيانة",
          description:
            "عرض مؤشرات الأداء",
          icon: "▥",
          path: "/reports",
        },
      ];

    case "INVENTORY_MANAGER":
      return [
        {
          label: "الأصول والأجهزة",
          description:
            "عرض الأصول المسجلة",
          icon: "⌁",
          path: "/assets",
        },
        {
          label: "بانتظار قطع الغيار",
          description:
            "متابعة الطلبات المتوقفة",
          icon: "▣",
          path: "/tickets",
        },
        {
          label: "تقارير المخزون",
          description:
            "عرض بيانات الاستخدام",
          icon: "▥",
          path: "/reports",
        },
      ];

    default:
      return [
        {
          label: "طلبات الصيانة",
          description:
            "عرض جميع الطلبات",
          icon: "▤",
          path: "/tickets",
        },
      ];
  }
}

/* ==================================================
   المكونات الصغيرة
================================================== */

function StatCard({
  label,
  value,
  icon,
  color,
  description = "محدّث الآن",
  onClick,
}) {
  const content = (
    <>
      <div>
        <small>{label}</small>

        <strong>
          {Number(value || 0)}
        </strong>

        <p>{description}</p>
      </div>

      <span
        className={`stat-icon ${color}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    </>
  );

  if (
    typeof onClick === "function"
  ) {
    return (
      <button
        type="button"
        className="stat-card"
        onClick={onClick}
        style={{
          width: "100%",
          border: 0,
          textAlign: "right",
          cursor: "pointer",
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <article className="stat-card">
      {content}
    </article>
  );
}

function QuickActionCard({
  action,
}) {
  return (
    <button
      type="button"
      onClick={() =>
        navigate(action.path)
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: "14px",
        border:
          "1px solid #e5eae8",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#173231",
        textAlign: "right",
        cursor: "pointer",
      }}
    >
      <span
        className="stat-icon green-bg"
        aria-hidden="true"
      >
        {action.icon}
      </span>

      <span
        style={{
          display: "grid",
          gap: "4px",
        }}
      >
        <strong>
          {action.label}
        </strong>

        <small
          style={{
            color: "#71817f",
          }}
        >
          {action.description}
        </small>
      </span>
    </button>
  );
}

/* ==================================================
   الصفحة
================================================== */

export default function DashboardPage() {
  const {
    user,
    role: authRole,
    fullName,
    organizationId,
    isPlatformAdmin,
    isDemo,
  } = useAuth();

  const role = normalizeRole(
    authRole || user?.role
  );

  const roleInformation =
    getRoleInformation(role);

  const quickActions =
    getQuickActions(role);

  const primaryLocationId =
    getPrimaryLocationId(user);

  const [dashboard, setDashboard] =
    useState(EMPTY_DASHBOARD);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const loadDashboard =
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
          /*
           * الوضع التجريبي.
           */
          if (
            isDemo ||
            !isSupabaseConfigured
          ) {
            await new Promise(
              (resolve) =>
                window.setTimeout(
                  resolve,
                  250
                )
            );

            setDashboard(
              createDemoDashboard(
                role
              )
            );

            return;
          }

          /*
           * جميع المستخدمين ما عدا
           * مدير المنصة يجب أن يرتبطوا
           * بمنشأة.
           */
          if (
            !isPlatformAdmin &&
            !organizationId
          ) {
            throw new Error(
              "لا توجد منشأة مرتبطة بالحساب الحالي."
            );
          }

          const filters = {
            recentLimit: 6,
            overdueLimit: 6,
          };

          if (organizationId) {
            filters.organizationId =
              organizationId;
          }

          /*
           * مدير الفرع يشاهد بيانات
           * فرعه فقط.
           */
          if (
            role ===
              "BRANCH_MANAGER" &&
            primaryLocationId
          ) {
            filters.locationId =
              primaryLocationId;
          }

          const result =
            await getDashboardData(
              filters
            );

          setDashboard({
            ...EMPTY_DASHBOARD,
            ...result,

            stats: {
              ...EMPTY_STATS,
              ...(result?.stats ||
                {}),
            },

            recentTickets:
              result?.recentTickets ||
              [],

            overdueTickets:
              result?.overdueTickets ||
              [],

            emergencyTickets:
              result?.emergencyTickets ||
              [],

            ticketsByStatus:
              result?.ticketsByStatus ||
              [],

            ticketsByPriority:
              result?.ticketsByPriority ||
              [],

            technicianWorkload:
              result?.technicianWorkload ||
              [],

            locationWorkload:
              result?.locationWorkload ||
              [],
          });
        } catch (loadError) {
          setDashboard(
            EMPTY_DASHBOARD
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "تعذر تحميل بيانات لوحة التحكم."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        role,
        organizationId,
        primaryLocationId,
        isPlatformAdmin,
        isDemo,
      ]
    );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats =
    dashboard.stats ||
    EMPTY_STATS;

  const totalTickets =
    Number(
      stats.totalTickets || 0
    );

  const waitingPartsTickets =
    getDistributionValue(
      dashboard.ticketsByStatus,
      "WAITING_PARTS"
    );

  const firstEmergencyTicket =
    dashboard
      .emergencyTickets?.[0] ||
    null;

  const closedPercentage =
    calculatePercentage(
      stats.closedTickets,
      totalTickets
    );

  const inProgressPercentage =
    calculatePercentage(
      stats.inProgressTickets,
      totalTickets
    );

  const newPercentage =
    calculatePercentage(
      stats.newTickets,
      totalTickets
    );

  const usedPercentage =
    Math.min(
      closedPercentage +
        inProgressPercentage +
        newPercentage,
      100
    );

  const otherTickets =
    Math.max(
      totalTickets -
        Number(
          stats.closedTickets || 0
        ) -
        Number(
          stats.inProgressTickets ||
            0
        ) -
        Number(
          stats.newTickets || 0
        ),
      0
    );

  const donutBackground =
    useMemo(() => {
      const closedEnd =
        closedPercentage;

      const inProgressEnd =
        closedPercentage +
        inProgressPercentage;

      const newEnd =
        usedPercentage;

      return `conic-gradient(
        #4c9a76 0 ${closedEnd}%,
        #e6aa48 ${closedEnd}% ${inProgressEnd}%,
        #578db8 ${inProgressEnd}% ${newEnd}%,
        #d9e0de ${newEnd}% 100%
      )`;
    }, [
      closedPercentage,
      inProgressPercentage,
      usedPercentage,
    ]);

  const statCards =
    useMemo(() => {
      if (
        role ===
        "INVENTORY_MANAGER"
      ) {
        return [
          {
            label:
              "بانتظار قطع الغيار",
            value:
              waitingPartsTickets,
            icon: "▣",
            color: "amber-bg",
            description:
              "طلبات تحتاج إلى قطع",
          },
          {
            label:
              "الطلبات المفتوحة",
            value:
              stats.openTickets,
            icon: "▤",
            color: "blue-bg",
          },
          {
            label:
              "الطلبات الطارئة",
            value:
              stats.emergencyTickets,
            icon: "!",
            color: "red-bg",
          },
          {
            label:
              "الطلبات المكتملة",
            value:
              stats.closedTickets,
            icon: "✓",
            color: "green-bg",
          },
        ];
      }

      if (
        role ===
        "PLATFORM_ADMIN"
      ) {
        return [
          {
            label:
              "إجمالي الطلبات",
            value:
              stats.totalTickets,
            icon: "▤",
            color: "blue-bg",
          },
          {
            label:
              "الطلبات المفتوحة",
            value:
              stats.openTickets,
            icon: "⚒",
            color: "amber-bg",
          },
          {
            label:
              "الطلبات المتأخرة",
            value:
              stats.overdueTickets,
            icon: "◷",
            color: "red-bg",
          },
          {
            label:
              "الطلبات المغلقة",
            value:
              stats.closedTickets,
            icon: "✓",
            color: "green-bg",
          },
        ];
      }

      return [
        {
          label:
            "طلبات جديدة",
          value:
            stats.newTickets,
          icon: "▤",
          color: "blue-bg",
        },
        {
          label:
            "جاري العمل",
          value:
            stats.inProgressTickets,
          icon: "⚒",
          color: "amber-bg",
        },
        {
          label:
            "طلبات متأخرة",
          value:
            stats.overdueTickets,
          icon: "◷",
          color: "red-bg",
        },
        {
          label:
            "طلبات مغلقة",
          value:
            stats.closedTickets,
          icon: "✓",
          color: "green-bg",

          description:
            totalTickets > 0
              ? `${stats.completionRate}% من إجمالي الطلبات`
              : "لا توجد طلبات بعد",
        },
      ];
    }, [
      role,
      stats,
      waitingPartsTickets,
      totalTickets,
    ]);

  if (loading) {
    return (
      <Loader message="جاري تحميل لوحة التحكم…" />
    );
  }

  return (
    <>
      {/* عنوان الصفحة */}
      <div className="page-header">
        <div>
          <small>
            {formatCurrentDate()}
          </small>

          <h1>
            {getGreeting()}

            {fullName
              ? `، ${fullName}`
              : ""}
          </h1>

          <p>
            {roleInformation.description}
          </p>

          <span
            className="badge green"
            style={{
              marginTop: "8px",
            }}
          >
            {roleInformation.label}
          </span>
        </div>

        <button
          type="button"
          className="primary"
          onClick={() =>
            loadDashboard({
              silent: true,
            })
          }
          disabled={refreshing}
        >
          {refreshing
            ? "جاري التحديث…"
            : "↻ تحديث البيانات"}
        </button>
      </div>

      {/* رسالة الوضع التجريبي */}
      {isDemo ||
      !isSupabaseConfigured ? (
        <div
          className="demo-callout"
          style={{
            marginBottom: "18px",
          }}
        >
          <strong>
            الوضع التجريبي
          </strong>

          <p>
            البيانات المعروضة حاليًا
            تجريبية، وستظهر البيانات
            الحقيقية بعد ربط Supabase.
          </p>
        </div>
      ) : null}

      {/* رسالة الخطأ */}
      {error ? (
        <section
          className="alert-banner"
          role="alert"
        >
          <span
            className="alert-icon"
            aria-hidden="true"
          >
            !
          </span>

          <div>
            <strong>
              تعذر تحميل بيانات لوحة
              التحكم
            </strong>

            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadDashboard()
            }
          >
            إعادة المحاولة ←
          </button>
        </section>
      ) : null}

      {/* تنبيه الطلب الطارئ */}
      {firstEmergencyTicket ? (
        <section className="alert-banner">
          <span
            className="alert-icon"
            aria-hidden="true"
          >
            !
          </span>

          <div>
            <strong>
              طلب طارئ يحتاج إلى انتباه
            </strong>

            <p>
              {firstEmergencyTicket.title}

              {" · "}

              {getLocationName(
                firstEmergencyTicket
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/tickets/${encodeURIComponent(
                  firstEmergencyTicket.id
                )}`
              )
            }
          >
            عرض الطلب ←
          </button>
        </section>
      ) : null}

      {/* بطاقات الإحصاءات */}
      <section className="stats-grid">
        {statCards.map(
          (card) => (
            <StatCard
              key={card.label}
              {...card}
              onClick={() =>
                navigate(
                  "/tickets"
                )
              }
            />
          )
        )}
      </section>

      {/* الإجراءات السريعة */}
      <section
        className="panel"
        style={{
          display: "grid",
          gap: "16px",
          marginBottom: "18px",
          padding: "20px",
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
              إجراءات سريعة
            </h2>

            <p>
              الوصول إلى أهم أقسام
              النظام حسب صلاحية حسابك
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",

            gap: "12px",
          }}
        >
          {quickActions.map(
            (action) => (
              <QuickActionCard
                key={
                  action.label
                }
                action={action}
              />
            )
          )}
        </div>
      </section>

      <section className="content-grid">
        {/* أحدث الطلبات */}
        <article className="panel tickets-panel">
          <div className="panel-head">
            <div>
              <h2>
                أحدث طلبات الصيانة
              </h2>

              <p>
                آخر الطلبات المسجلة
                ضمن نطاق حسابك
              </p>
            </div>

            <button
              type="button"
              className="link-button"
              onClick={() =>
                navigate(
                  "/tickets"
                )
              }
            >
              عرض الكل ←
            </button>
          </div>

          <div className="ticket-list">
            {dashboard
              .recentTickets
              .length > 0 ? (
              dashboard.recentTickets.map(
                (ticket) => {
                  const priorityLabel =
                    getPriorityLabel(
                      ticket.priority
                    );

                  const statusLabel =
                    getStatusLabel(
                      ticket.status
                    );

                  return (
                    <button
                      type="button"
                      className="ticket-row compact-row"
                      key={ticket.id}
                      onClick={() =>
                        navigate(
                          `/tickets/${encodeURIComponent(
                            ticket.id
                          )}`
                        )
                      }
                    >
                      <span
                        className={`priority-dot priority-${getPriorityClass(
                          ticket.priority
                        )}`}
                        title={
                          priorityLabel
                        }
                        aria-label={
                          priorityLabel
                        }
                      />

                      <div className="ticket-main">
                        <strong>
                          {ticket.title ||
                            "طلب صيانة"}
                        </strong>

                        <small>
                          {ticket.ticket_number ||
                            ticket.id}
                        </small>
                      </div>

                      <div className="ticket-location">
                        <strong>
                          {getLocationName(
                            ticket
                          )}
                        </strong>

                        <small>
                          {formatRelativeTime(
                            ticket.created_at
                          )}
                        </small>
                      </div>

                      <span
                        className={`badge ${getStatusBadgeClass(
                          ticket.status
                        )}`}
                      >
                        {statusLabel}
                      </span>

                      <span
                        className="chevron"
                        aria-hidden="true"
                      >
                        ‹
                      </span>
                    </button>
                  );
                }
              )
            ) : (
              <EmptyState
                icon="▤"
                title="لا توجد طلبات صيانة"
                description="ستظهر أحدث الطلبات هنا بعد إضافتها إلى النظام."
                actionLabel="عرض صفحة الطلبات"
                onAction={() =>
                  navigate(
                    "/tickets"
                  )
                }
              />
            )}
          </div>
        </article>

        <aside className="side-column">
          {/* حالة الطلبات */}
          <article className="panel progress-panel">
            <div className="panel-head">
              <div>
                <h2>
                  حالة الطلبات
                </h2>

                <p>
                  توزيع جميع الطلبات
                  الحالية
                </p>
              </div>
            </div>

            <div className="donut-wrap">
              <div
                className="donut"
                style={{
                  background:
                    donutBackground,
                }}
              >
                <div>
                  <strong>
                    {totalTickets}
                  </strong>

                  <small>
                    إجمالي الطلبات
                  </small>
                </div>
              </div>
            </div>

            <div className="legend">
              <p>
                <span className="legend-dot green-dot" />

                مغلقة

                <b>
                  {stats.closedTickets}
                </b>

                <em>
                  {closedPercentage}%
                </em>
              </p>

              <p>
                <span className="legend-dot amber-dot" />

                جاري العمل

                <b>
                  {stats.inProgressTickets}
                </b>

                <em>
                  {inProgressPercentage}%
                </em>
              </p>

              <p>
                <span className="legend-dot blue-dot" />

                جديدة

                <b>
                  {stats.newTickets}
                </b>

                <em>
                  {newPercentage}%
                </em>
              </p>

              <p>
                <span className="legend-dot slate-dot" />

                حالات أخرى

                <b>
                  {otherTickets}
                </b>

                <em>
                  {Math.max(
                    100 -
                      usedPercentage,
                    0
                  )}
                  %
                </em>
              </p>
            </div>
          </article>

          {/* ملخص الأداء */}
          <article className="panel activity-panel">
            <div className="panel-head">
              <div>
                <h2>
                  ملخص الأداء
                </h2>

                <p>
                  مؤشرات عمليات الصيانة
                </p>
              </div>
            </div>

            <div className="activity">
              <span className="mini-avatar mint">
                ✓
              </span>

              <p>
                نسبة إكمال الطلبات

                <b>
                  {" "}
                  {stats.completionRate}
                  %
                </b>

                <small>
                  من إجمالي الطلبات
                  المسجلة
                </small>
              </p>
            </div>

            <div className="activity">
              <span className="mini-avatar orange">
                ◷
              </span>

              <p>
                متوسط وقت الاستجابة

                <b>
                  {" "}
                  {
                    stats.averageResponseMinutes
                  }
                  {" "}
                  دقيقة
                </b>

                <small>
                  من إنشاء الطلب حتى
                  بدء التعامل معه
                </small>
              </p>
            </div>

            <div className="activity">
              <span className="mini-avatar purple">
                ⚒
              </span>

              <p>
                متوسط مدة الإصلاح

                <b>
                  {" "}
                  {
                    stats.averageRepairMinutes
                  }
                  {" "}
                  دقيقة
                </b>

                <small>
                  من بدء العمل حتى
                  إكمال الصيانة
                </small>
              </p>
            </div>
          </article>
        </aside>
      </section>

      {/* أحمال الفنيين */}
      {role !==
        "INVENTORY_MANAGER" &&
      dashboard
        .technicianWorkload
        .length > 0 ? (
        <section
          className="panel"
          style={{
            display: "grid",
            gap: "16px",
            marginTop: "18px",
            padding: "20px",
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
                أحمال الفنيين
              </h2>

              <p>
                عدد الطلبات المفتوحة
                لكل فني
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            {dashboard
              .technicianWorkload
              .slice(0, 5)
              .map(
                (technician) => (
                  <div
                    key={
                      technician.id
                    }
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "space-between",

                      gap: "12px",

                      padding:
                        "13px",

                      border:
                        "1px solid #e5eae8",

                      borderRadius:
                        "10px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap: "10px",
                      }}
                    >
                      <span className="mini-avatar mint">
                        {String(
                          technician.name ||
                            "ف"
                        )
                          .trim()
                          .charAt(0)}
                      </span>

                      <div
                        style={{
                          display:
                            "grid",

                          gap: "3px",
                        }}
                      >
                        <strong>
                          {
                            technician.name
                          }
                        </strong>

                        <small
                          style={{
                            color:
                              "#71817f",
                          }}
                        >
                          {technician.specialization ||
                            "فني صيانة"}
                        </small>
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "flex",

                        flexWrap:
                          "wrap",

                        justifyContent:
                          "flex-end",

                        gap: "7px",
                      }}
                    >
                      <span className="badge blue">
                        مفتوحة:{" "}
                        {Number(
                          technician.openTickets ||
                            0
                        )}
                      </span>

                      <span className="badge green">
                        مغلقة:{" "}
                        {Number(
                          technician.closedTickets ||
                            0
                        )}
                      </span>

                      {Number(
                        technician.overdueTickets ||
                          0
                      ) > 0 ? (
                        <span className="badge red">
                          متأخرة:{" "}
                          {Number(
                            technician.overdueTickets
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              )}
          </div>
        </section>
      ) : null}
    </>
  );
}