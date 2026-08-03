import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import ReportCard from "../../components/reports/ReportCard";
import ReportFilters from "../../components/reports/ReportFilters";

import useAuth from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import {
  exportReport,
  getReports,
} from "../../services/reportService";

import { formatDate } from "../../utils/formatDate";

/* ==================================================
   بيانات الوضع التجريبي
================================================== */

const DEMO_LOCATIONS = [
  {
    id: "location-riyadh",
    name: "فرع الرياض",
    is_active: true,
  },
  {
    id: "location-jeddah",
    name: "فرع جدة",
    is_active: true,
  },
  {
    id: "location-hail",
    name: "فرع حائل",
    is_active: true,
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

const DEMO_REPORT = {
  generatedAt:
    "2026-08-03T03:00:00+03:00",

  summary: {
    totalTickets: 98,
    closedTickets: 68,
    openTickets: 30,
    overdueTickets: 7,
    reopenedTickets: 5,
    averageResponseMinutes: 42,
    averageRepairMinutes: 315,
    averageRating: 4.3,
  },

  ticketsByStatus: [
    {
      key: "CLOSED",
      label: "مغلقة",
      value: 68,
    },
    {
      key: "IN_PROGRESS",
      label: "جاري العمل",
      value: 12,
    },
    {
      key: "NEW",
      label: "جديدة",
      value: 8,
    },
    {
      key: "WAITING_PARTS",
      label: "بانتظار قطعة",
      value: 5,
    },
    {
      key: "PENDING_APPROVAL",
      label: "بانتظار الاعتماد",
      value: 3,
    },
    {
      key: "REOPENED",
      label: "معاد فتحها",
      value: 2,
    },
  ],

  ticketsByPriority: [
    {
      key: "EMERGENCY",
      label: "طارئة",
      value: 9,
    },
    {
      key: "HIGH",
      label: "مرتفعة",
      value: 26,
    },
    {
      key: "MEDIUM",
      label: "متوسطة",
      value: 43,
    },
    {
      key: "LOW",
      label: "منخفضة",
      value: 20,
    },
  ],

  locations: [
    {
      id: "location-riyadh",
      name: "فرع الرياض",
      totalTickets: 47,
      closedTickets: 33,
      overdueTickets: 4,
      topCategory: "تكييف وتبريد",
    },
    {
      id: "location-jeddah",
      name: "فرع جدة",
      totalTickets: 31,
      closedTickets: 23,
      overdueTickets: 2,
      topCategory: "كهرباء وإنارة",
    },
    {
      id: "location-hail",
      name: "فرع حائل",
      totalTickets: 20,
      closedTickets: 12,
      overdueTickets: 1,
      topCategory: "سباكة",
    },
  ],

  technicians: [
    {
      id: "technician-1",
      name: "محمد العتيبي",
      specialization: "تكييف وتبريد",
      totalTickets: 31,
      closedTickets: 25,
      overdueTickets: 1,
      averageResponseMinutes: 28,
      averageRepairMinutes: 240,
      averageRating: 4.7,
    },
    {
      id: "technician-2",
      name: "أحمد الشمري",
      specialization: "كهرباء",
      totalTickets: 27,
      closedTickets: 19,
      overdueTickets: 2,
      averageResponseMinutes: 39,
      averageRepairMinutes: 295,
      averageRating: 4.4,
    },
    {
      id: "technician-3",
      name: "سالم الحربي",
      specialization: "سباكة",
      totalTickets: 22,
      closedTickets: 15,
      overdueTickets: 2,
      averageResponseMinutes: 51,
      averageRepairMinutes: 370,
      averageRating: 4.1,
    },
  ],

  assets: [
    {
      id: "asset-1",
      name: "مكيف غرفة الاجتماعات",
      assetNumber: "AC-RYD-001",
      locationName: "فرع الرياض",
      breakdownsCount: 8,
      reopenedCount: 2,
      partsCost: 1250,
      lastMaintenanceAt:
        "2026-07-25T15:30:00+03:00",
    },
    {
      id: "asset-2",
      name: "لوحة الكهرباء الرئيسية",
      assetNumber: "EL-JED-002",
      locationName: "فرع جدة",
      breakdownsCount: 6,
      reopenedCount: 1,
      partsCost: 860,
      lastMaintenanceAt:
        "2026-07-22T11:20:00+03:00",
    },
    {
      id: "asset-3",
      name: "مضخة المياه",
      assetNumber: "PL-HAL-001",
      locationName: "فرع حائل",
      breakdownsCount: 5,
      reopenedCount: 1,
      partsCost: 730,
      lastMaintenanceAt:
        "2026-07-19T09:15:00+03:00",
    },
  ],

  satisfaction: {
    averageRating: 4.3,
    ratingsCount: 54,
    lowRatingsCount: 6,

    ratingDistribution: [
      {
        rating: 5,
        count: 28,
      },
      {
        rating: 4,
        count: 15,
      },
      {
        rating: 3,
        count: 5,
      },
      {
        rating: 2,
        count: 4,
      },
      {
        rating: 1,
        count: 2,
      },
    ],

    comments: [
      {
        id: "comment-1",
        rating: 5,
        comment:
          "استجابة سريعة وتم حل المشكلة من الزيارة الأولى.",
        createdAt:
          "2026-07-24T17:20:00+03:00",
      },
      {
        id: "comment-2",
        rating: 4,
        comment:
          "الخدمة جيدة، لكن وصول الفني استغرق وقتًا أطول من المتوقع.",
        createdAt:
          "2026-07-23T14:10:00+03:00",
      },
      {
        id: "comment-3",
        rating: 2,
        comment:
          "عاد العطل بعد يوم وتمت إعادة فتح الطلب.",
        createdAt:
          "2026-07-21T10:45:00+03:00",
      },
    ],
  },

  tickets: [],
};

/* ==================================================
   تبويبات التقارير
================================================== */

const TABS = [
  {
    key: "tickets",
    label: "الطلبات",
  },
  {
    key: "technicians",
    label: "أداء الفنيين",
  },
  {
    key: "assets",
    label: "الأجهزة",
  },
  {
    key: "locations",
    label: "المواقع",
  },
  {
    key: "satisfaction",
    label: "رضا المستخدمين",
  },
];

/* ==================================================
   دوال مساعدة
================================================== */

function formatDateInput(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultFilters() {
  const today =
    new Date();

  const firstDay =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

  return {
    dateFrom:
      formatDateInput(
        firstDay
      ),

    dateTo:
      formatDateInput(
        today
      ),

    locationId: null,
    technicianId: null,
    status: null,
    priority: null,
  };
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function formatMinutes(value) {
  const minutes =
    Number(value);

  if (
    !Number.isFinite(minutes) ||
    minutes < 0
  ) {
    return "—";
  }

  if (minutes < 60) {
    return `${Math.round(
      minutes
    )} دقيقة`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    Math.round(
      minutes % 60
    );

  return remaining
    ? `${hours} س ${remaining} د`
    : `${hours} ساعة`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "ar-SA",
    {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value) || 0
  );
}

function getPercentage(
  value,
  total
) {
  const normalizedValue =
    Number(value) || 0;

  const normalizedTotal =
    Number(total) || 0;

  if (
    normalizedTotal <= 0
  ) {
    return 0;
  }

  return Math.round(
    (
      normalizedValue /
      normalizedTotal
    ) * 100
  );
}

/* ==================================================
   رسم الأعمدة
================================================== */

function ReportBars({
  title,
  description,
  items = [],
}) {
  const maximum =
    Math.max(
      1,
      ...items.map(
        (item) =>
          Number(
            item.value
          ) || 0
      )
    );

  return (
    <article
      className="panel"
      style={{
        display: "grid",
        gap: "18px",
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
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          لا توجد بيانات متاحة.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "14px",
          }}
        >
          {items.map(
            (item) => {
              const value =
                Number(
                  item.value
                ) || 0;

              const width =
                Math.max(
                  3,
                  Math.round(
                    (
                      value /
                      maximum
                    ) * 100
                  )
                );

              return (
                <div
                  key={
                    item.key ||
                    item.label
                  }
                  style={{
                    display:
                      "grid",

                    gap: "7px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      gap:
                        "12px",

                      fontSize:
                        "10px",
                    }}
                  >
                    <span>
                      {item.label ||
                        item.key}
                    </span>

                    <strong>
                      {value}
                    </strong>
                  </div>

                  <div
                    style={{
                      height:
                        "9px",

                      overflow:
                        "hidden",

                      borderRadius:
                        "10px",

                      background:
                        "#edf1f0",
                    }}
                  >
                    <span
                      style={{
                        display:
                          "block",

                        width:
                          `${width}%`,

                        height:
                          "100%",

                        borderRadius:
                          "10px",

                        background:
                          "#2a8b79",
                      }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </article>
  );
}

/* ==================================================
   جدول التقارير
================================================== */

function DataTable({
  columns = [],
  rows = [],
  emptyTitle =
    "لا توجد بيانات",
}) {
  if (rows.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          icon="▥"
          title={emptyTitle}
          description="لا توجد نتائج مطابقة للفلاتر المحددة."
        />
      </section>
    );
  }

  return (
    <section
      className="panel"
      style={{
        overflow:
          "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          overflowX:
            "auto",
        }}
      >
        <table
          style={{
            width: "100%",

            minWidth:
              "820px",

            borderCollapse:
              "collapse",

            textAlign:
              "right",
          }}
        >
          <thead>
            <tr>
              {columns.map(
                (column) => (
                  <th
                    key={
                      column.key
                    }
                    style={{
                      padding:
                        "13px",

                      borderBottom:
                        "1px solid #e4ebe8",

                      background:
                        "#f4f8f7",

                      color:
                        "#536663",

                      fontSize:
                        "9px",
                    }}
                  >
                    {
                      column.label
                    }
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (
                row,
                rowIndex
              ) => (
                <tr
                  key={
                    row.id ||
                    row.key ||
                    rowIndex
                  }
                >
                  {columns.map(
                    (
                      column
                    ) => (
                      <td
                        key={
                          column.key
                        }
                        style={{
                          padding:
                            "13px",

                          borderBottom:
                            "1px solid #edf0ef",

                          color:
                            "#344b47",

                          fontSize:
                            "9px",

                          verticalAlign:
                            "top",
                        }}
                      >
                        {typeof column.render ===
                        "function"
                          ? column.render(
                              row
                            )
                          : row[
                              column
                                .key
                            ] ??
                            "—"}
                      </td>
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ==================================================
   صفحة التقارير
================================================== */

export default function ReportsPage() {
  const {
    user,
    role: authRole,
    organizationId,
    isPlatformAdmin,
    isOrganizationAdmin,
    isDemo,
    can,
  } = useAuth();

  const role =
    normalizeRole(
      authRole ||
        user?.role
    );

  const canViewReports =
    isPlatformAdmin ||
    isOrganizationAdmin ||
    can("reports:read") ||
    [
      "BRANCH_MANAGER",
      "SUPERVISOR",
    ].includes(role);

  const [
    locations,
    setLocations,
  ] = useState([]);

  const [
    technicians,
    setTechnicians,
  ] = useState([]);

  const [
    report,
    setReport,
  ] = useState(null);

  const [
    filters,
    setFilters,
  ] = useState(
    getDefaultFilters
  );

  const [
    filterKey,
    setFilterKey,
  ] = useState(0);

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "tickets"
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
    exporting,
    setExporting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* ==================================================
     تحميل المواقع والفنيين
  ================================================== */

  const loadReferenceData =
    useCallback(
      async () => {
        if (
          isDemo ||
          !isSupabaseConfigured
        ) {
          setLocations(
            DEMO_LOCATIONS
          );

          setTechnicians(
            DEMO_TECHNICIANS
          );

          return;
        }

        let locationsQuery =
          requireSupabase()
            .from(
              "locations"
            )
            .select(
              `
                id,
                organization_id,
                name,
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
            .from(
              "profiles"
            )
            .select(
              `
                id,
                organization_id,
                full_name,
                specialization,
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
            .order(
              "full_name"
            );

        if (
          !isPlatformAdmin &&
          organizationId
        ) {
          locationsQuery =
            locationsQuery.eq(
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
          techniciansResult,
        ] =
          await Promise.all([
            locationsQuery,
            techniciansQuery,
          ]);

        if (
          locationsResult.error
        ) {
          throw locationsResult.error;
        }

        if (
          techniciansResult.error
        ) {
          throw techniciansResult.error;
        }

        setLocations(
          locationsResult.data ||
            []
        );

        setTechnicians(
          techniciansResult.data ||
            []
        );
      },
      [
        isDemo,
        isPlatformAdmin,
        organizationId,
      ]
    );

  /* ==================================================
     تحميل التقرير
  ================================================== */

  const loadReport =
    useCallback(
      async (
        nextFilters =
          filters,

        {
          silent = false,
        } = {}
      ) => {
        if (
          !canViewReports
        ) {
          setLoading(false);
          return;
        }

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
        setSuccessMessage("");

        try {
          const scopedFilters = {
            ...nextFilters,

            organizationId:
              isPlatformAdmin
                ? null
                : organizationId ||
                  null,
          };

          if (
            isDemo ||
            !isSupabaseConfigured
          ) {
            setReport(
              DEMO_REPORT
            );

            return;
          }

          const result =
            await getReports(
              scopedFilters
            );

          setReport(result);
        } catch (loadError) {
          setReport(null);

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "تعذر تحميل التقارير."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        canViewReports,
        filters,
        isDemo,
        isPlatformAdmin,
        organizationId,
      ]
    );

  /* ==================================================
     تشغيل الصفحة
  ================================================== */

  useEffect(() => {
    if (
      !canViewReports
    ) {
      setLoading(false);
      return;
    }

    let cancelled =
      false;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        await loadReferenceData();

        if (!cancelled) {
          await loadReport(
            filters
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "تعذر تجهيز صفحة التقارير."
          );

          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [
    canViewReports,
    loadReferenceData,
  ]);

  /* ==================================================
     ملخص التقرير
  ================================================== */

  const summary =
    report?.summary || {};

  const completionRate =
    useMemo(
      () =>
        getPercentage(
          summary.closedTickets,
          summary.totalTickets
        ),
      [
        summary.closedTickets,
        summary.totalTickets,
      ]
    );

  /* ==================================================
     تطبيق الفلاتر
  ================================================== */

  const handleApplyFilters =
    useCallback(
      async (
        nextFilters
      ) => {
        setFilters(
          nextFilters
        );

        await loadReport(
          nextFilters
        );
      },
      [loadReport]
    );

  const handleResetFilters =
    useCallback(
      async (
        nextFilters
      ) => {
        setFilters(
          nextFilters
        );

        setFilterKey(
          (current) =>
            current + 1
        );

        await loadReport(
          nextFilters
        );
      },
      [loadReport]
    );

  /* ==================================================
     تصدير التقرير
  ================================================== */

  const handleExport =
    useCallback(
      async (
        exportFilters,
        format
      ) => {
        if (exporting) {
          return;
        }

        setExporting(true);
        setError("");
        setSuccessMessage("");

        try {
          await exportReport({
            ...exportFilters,

            organizationId:
              isPlatformAdmin
                ? null
                : organizationId ||
                  null,

            section:
              activeTab,

            format,

            demoData:
              isDemo ||
              !isSupabaseConfigured
                ? report ||
                  DEMO_REPORT
                : undefined,
          });

          setSuccessMessage(
            format === "pdf"
              ? "تم فتح نسخة التقرير الجاهزة للطباعة أو الحفظ بصيغة PDF."
              : "تم تنزيل التقرير بنجاح."
          );
        } catch (exportError) {
          setError(
            exportError instanceof
            Error
              ? exportError.message
              : "تعذر تصدير التقرير."
          );
        } finally {
          setExporting(false);
        }
      },
      [
        activeTab,
        exporting,
        isDemo,
        isPlatformAdmin,
        organizationId,
        report,
      ]
    );

  /* ==================================================
     منع الوصول
  ================================================== */

  if (!canViewReports) {
    return (
      <section className="panel">
        <EmptyState
          icon="!"
          title="لا تملك صلاحية عرض التقارير"
          description="هذه الصفحة متاحة فقط للحسابات المخولة بمتابعة مؤشرات الصيانة."
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
            التحليلات ومؤشرات الأداء
          </small>

          <h1>
            التقارير
          </h1>

          <p>
            تابعي أداء الصيانة والفنيين والأجهزة والمواقع
            خلال الفترة المحددة.
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            loadReport(
              filters,
              {
                silent:
                  true,
              }
            )
          }
          disabled={
            loading ||
            refreshing ||
            exporting
          }
        >
          {refreshing
            ? "جاري التحديث…"
            : "↻ تحديث التقرير"}
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
            تعرض الصفحة بيانات توضيحية لتجربة واجهة
            التقارير.
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="demo-callout"
          role="status"
          style={{
            marginBottom:
              "16px",
          }}
        >
          <strong>
            تمت العملية بنجاح
          </strong>

          <span>
            {successMessage}
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

      {/* فلاتر التقارير */}
      <ReportFilters
        key={filterKey}
        locations={locations}
        technicians={
          technicians
        }
        initialValues={
          filters
        }
        busy={
          loading ||
          refreshing
        }
        exporting={
          exporting
        }
        error=""
        showTechnicianFilter
        showExportButtons
        onApply={
          handleApplyFilters
        }
        onReset={
          handleResetFilters
        }
        onExport={
          handleExport
        }
      />

      {/* بطاقات الملخص */}
      <section
        className="stats-grid"
        style={{
          marginTop: "18px",
          marginBottom:
            "18px",
        }}
      >
        <ReportCard
          title="إجمالي الطلبات"
          value={
            summary.totalTickets ||
            0
          }
          description="جميع الطلبات خلال الفترة المحددة"
          icon="▥"
          colorClass="blue-bg"
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />

        <ReportCard
          title="الطلبات المغلقة"
          value={
            summary.closedTickets ||
            0
          }
          description="الطلبات التي اكتمل إصلاحها واعتمادها"
          icon="✓"
          colorClass="green-bg"
          progress={
            completionRate
          }
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />

        <ReportCard
          title="الطلبات المتأخرة"
          value={
            summary.overdueTickets ||
            0
          }
          description="طلبات تجاوزت موعد الاستحقاق"
          icon="!"
          colorClass="red-bg"
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />

        <ReportCard
          title="متوسط الاستجابة"
          value={formatMinutes(
            summary.averageResponseMinutes
          )}
          description="من إنشاء الطلب حتى تعيينه أو بدء العمل"
          icon="◷"
          colorClass="amber-bg"
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />

        <ReportCard
          title="متوسط الإصلاح"
          value={formatMinutes(
            summary.averageRepairMinutes
          )}
          description="من بدء العمل حتى اكتمال الصيانة"
          icon="⚒"
          colorClass="violet-bg"
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />

        <ReportCard
          title="متوسط التقييم"
          value={Number(
            summary.averageRating ||
              0
          ).toFixed(1)}
          valueSuffix="من 5"
          description="متوسط تقييمات المبلّغين للخدمة"
          icon="★"
          colorClass="green-bg"
          updatedAt={
            report?.generatedAt
          }
          loading={loading}
        />
      </section>

      {/* تبويبات التقارير */}
      <nav
        className="panel"
        aria-label="أقسام التقارير"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom:
            "18px",
          padding: "12px",
        }}
      >
        {TABS.map(
          (tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                activeTab ===
                tab.key
                  ? "primary"
                  : "secondary"
              }
              onClick={() =>
                setActiveTab(
                  tab.key
                )
              }
              disabled={loading}
            >
              {tab.label}
            </button>
          )
        )}
      </nav>

      {/* محتوى التقرير */}
      {loading ? (
        <section
          className="panel"
          role="status"
          aria-live="polite"
          style={{
            display: "grid",
            gap: "12px",
            padding: "22px",
          }}
        >
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                style={{
                  height:
                    item === 1
                      ? "70px"
                      : "52px",

                  borderRadius:
                    "10px",

                  background:
                    "#edf1f0",
                }}
              />
            )
          )}

          <span className="empty">
            جاري إعداد التقرير…
          </span>
        </section>
      ) : !report ? (
        <section className="panel">
          <EmptyState
            icon="▥"
            title="لا توجد بيانات تقرير"
            description="طبّقي الفلاتر أو حدّثي الصفحة لإعادة المحاولة."
            actionLabel="إعادة المحاولة"
            onAction={() =>
              loadReport(
                filters
              )
            }
          />
        </section>
      ) : activeTab ===
        "tickets" ? (
        <section
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(290px, 1fr))",

            gap: "16px",
          }}
        >
          <ReportBars
            title="الطلبات حسب الحالة"
            description="توزيع طلبات الصيانة على حالات سير العمل"
            items={
              report.ticketsByStatus ||
              []
            }
          />

          <ReportBars
            title="الطلبات حسب الأولوية"
            description="توزيع الطلبات حسب مستوى الأولوية"
            items={
              report.ticketsByPriority ||
              []
            }
          />
        </section>
      ) : activeTab ===
        "technicians" ? (
        <DataTable
          emptyTitle="لا توجد بيانات للفنيين"
          rows={
            report.technicians ||
            []
          }
          columns={[
            {
              key: "name",
              label: "الفني",

              render: (
                row
              ) => (
                <div
                  style={{
                    display:
                      "grid",

                    gap: "4px",
                  }}
                >
                  <strong>
                    {row.name}
                  </strong>

                  <small>
                    {row.specialization ||
                      "فني صيانة"}
                  </small>
                </div>
              ),
            },
            {
              key:
                "totalTickets",

              label:
                "إجمالي المهام",
            },
            {
              key:
                "closedTickets",

              label:
                "المغلقة",
            },
            {
              key:
                "overdueTickets",

              label:
                "المتأخرة",
            },
            {
              key:
                "averageResponseMinutes",

              label:
                "متوسط الاستجابة",

              render: (
                row
              ) =>
                formatMinutes(
                  row.averageResponseMinutes
                ),
            },
            {
              key:
                "averageRepairMinutes",

              label:
                "متوسط الإصلاح",

              render: (
                row
              ) =>
                formatMinutes(
                  row.averageRepairMinutes
                ),
            },
            {
              key:
                "averageRating",

              label:
                "التقييم",

              render: (
                row
              ) =>
                row.averageRating
                  ? `${row.averageRating} / 5`
                  : "—",
            },
          ]}
        />
      ) : activeTab ===
        "assets" ? (
        <DataTable
          emptyTitle="لا توجد بيانات للأجهزة"
          rows={
            report.assets ||
            []
          }
          columns={[
            {
              key: "name",
              label: "الجهاز",

              render: (
                row
              ) => (
                <div
                  style={{
                    display:
                      "grid",

                    gap: "4px",
                  }}
                >
                  <strong>
                    {row.name}
                  </strong>

                  <small>
                    {row.assetNumber ||
                      "دون رقم داخلي"}
                  </small>
                </div>
              ),
            },
            {
              key:
                "locationName",

              label:
                "الموقع",
            },
            {
              key:
                "breakdownsCount",

              label:
                "عدد الأعطال",
            },
            {
              key:
                "reopenedCount",

              label:
                "مرات إعادة الفتح",
            },
            {
              key:
                "partsCost",

              label:
                "تكلفة القطع",

              render: (
                row
              ) =>
                formatCurrency(
                  row.partsCost
                ),
            },
            {
              key:
                "lastMaintenanceAt",

              label:
                "آخر صيانة",

              render: (
                row
              ) =>
                row.lastMaintenanceAt
                  ? formatDate(
                      row.lastMaintenanceAt,
                      {
                        withTime:
                          true,
                      }
                    )
                  : "—",
            },
          ]}
        />
      ) : activeTab ===
        "locations" ? (
        <DataTable
          emptyTitle="لا توجد بيانات للمواقع"
          rows={
            report.locations ||
            []
          }
          columns={[
            {
              key: "name",
              label: "الموقع",
            },
            {
              key:
                "totalTickets",

              label:
                "إجمالي الطلبات",
            },
            {
              key:
                "closedTickets",

              label:
                "المغلقة",
            },
            {
              key:
                "overdueTickets",

              label:
                "المتأخرة",
            },
            {
              key:
                "topCategory",

              label:
                "أكثر تصنيف تكرارًا",
            },
            {
              key:
                "completion",

              label:
                "نسبة الإغلاق",

              render: (
                row
              ) =>
                `${getPercentage(
                  row.closedTickets,
                  row.totalTickets
                )}%`,
            },
          ]}
        />
      ) : (
        <section
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <section className="stats-grid">
            <ReportCard
              title="متوسط رضا المستخدمين"
              value={Number(
                report.satisfaction
                  ?.averageRating ||
                  0
              ).toFixed(1)}
              valueSuffix="من 5"
              description="متوسط جميع التقييمات المسجلة"
              icon="★"
              colorClass="green-bg"
            />

            <ReportCard
              title="عدد التقييمات"
              value={
                report.satisfaction
                  ?.ratingsCount ||
                0
              }
              description="إجمالي الطلبات التي حصلت على تقييم"
              icon="▥"
              colorClass="blue-bg"
            />

            <ReportCard
              title="التقييمات المنخفضة"
              value={
                report.satisfaction
                  ?.lowRatingsCount ||
                0
              }
              description="التقييمات بدرجتين أو أقل"
              icon="!"
              colorClass="red-bg"
            />
          </section>

          <ReportBars
            title="توزيع التقييمات"
            description="عدد التقييمات لكل درجة"
            items={(
              report.satisfaction
                ?.ratingDistribution ||
              []
            ).map(
              (item) => ({
                key: String(
                  item.rating
                ),

                label:
                  `${item.rating} نجوم`,

                value:
                  item.count,
              })
            )}
          />

          <article
            className="panel"
            style={{
              display: "grid",
              gap: "14px",
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
                  أحدث التعليقات
                </h2>

                <p>
                  آراء المبلّغين بعد إغلاق طلبات الصيانة
                </p>
              </div>
            </div>

            {(report.satisfaction
              ?.comments || [])
              .length === 0 ? (
              <div className="empty">
                لا توجد تعليقات مسجلة.
              </div>
            ) : (
              <div
                style={{
                  display:
                    "grid",

                  gap: "10px",
                }}
              >
                {report.satisfaction.comments.map(
                  (
                    comment
                  ) => (
                    <div
                      key={
                        comment.id
                      }
                      style={{
                        display:
                          "grid",

                        gap:
                          "7px",

                        padding:
                          "14px",

                        border:
                          "1px solid #e4ebe8",

                        borderRadius:
                          "10px",

                        background:
                          "#f8faf9",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            "10px",
                        }}
                      >
                        <strong>
                          {"★".repeat(
                            Number(
                              comment.rating
                            ) ||
                              0
                          )}
                        </strong>

                        <small>
                          {comment.createdAt
                            ? formatDate(
                                comment.createdAt,
                                {
                                  withTime:
                                    true,
                                }
                              )
                            : "—"}
                        </small>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          lineHeight:
                            1.8,
                        }}
                      >
                        {
                          comment.comment
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </article>
        </section>
      )}
    </>
  );
}