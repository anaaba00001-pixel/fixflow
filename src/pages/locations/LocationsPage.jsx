import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";
import LocationCard from "../../components/locations/LocationCard";
import LocationForm from "../../components/locations/LocationForm";

import useAuth from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import {
  createLocation,
  listLocations,
  toggleLocationStatus,
  updateLocation,
} from "../../services/locationService";

/* ==================================================
   إعدادات الوضع التجريبي
================================================== */

const STORAGE_KEY = "fixflow_locations";

const DEMO_ORGANIZATIONS = [
  {
    id: "demo-organization",
    name: "منشأة FixFlow التجريبية",
    status: "ACTIVE",
  },
  {
    id: "demo-organization-2",
    name: "المنشأة الثانية",
    status: "ACTIVE",
  },
];

const DEFAULT_LOCATIONS = [
  {
    id: "location-riyadh",
    organization_id: "demo-organization",
    name: "فرع الرياض",
    address: "الرياض، حي العليا",
    description:
      "المقر الرئيسي ويشمل المكاتب الإدارية وغرف الاجتماعات.",
    is_active: true,
    assets_count: 18,
    open_tickets_count: 5,
    users_count: 7,
    tickets_count: 24,
    created_at: "2026-07-05T09:00:00+03:00",
  },
  {
    id: "location-jeddah",
    organization_id: "demo-organization",
    name: "فرع جدة",
    address: "جدة، حي الروضة",
    description:
      "فرع المنطقة الغربية ويشمل المستودع ومكاتب خدمة العملاء.",
    is_active: true,
    assets_count: 12,
    open_tickets_count: 2,
    users_count: 4,
    tickets_count: 16,
    created_at: "2026-07-08T11:30:00+03:00",
  },
  {
    id: "location-hail",
    organization_id: "demo-organization",
    name: "فرع حائل",
    address: "حائل، حي النقرة",
    description:
      "فرع المنطقة الشمالية ومركز الدعم الفني.",
    is_active: true,
    assets_count: 8,
    open_tickets_count: 1,
    users_count: 3,
    tickets_count: 9,
    created_at: "2026-07-12T08:45:00+03:00",
  },
  {
    id: "location-old-warehouse",
    organization_id: "demo-organization",
    name: "المستودع القديم",
    address: "الرياض، المنطقة الصناعية",
    description:
      "موقع متوقف حاليًا ولا يستقبل طلبات صيانة جديدة.",
    is_active: false,
    assets_count: 3,
    open_tickets_count: 0,
    users_count: 0,
    tickets_count: 4,
    created_at: "2026-06-20T13:15:00+03:00",
  },
];

/* ==================================================
   دوال مساعدة
================================================== */

function createId(prefix = "location") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

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
  const directIds =
    user?.location_ids ||
    user?.locationIds;

  if (Array.isArray(directIds)) {
    return directIds
      .filter(Boolean)
      .map(String);
  }

  const relations =
    user?.user_locations ||
    user?.locations;

  if (!Array.isArray(relations)) {
    return [];
  }

  return relations
    .map((relation) => {
      return (
        relation?.location_id ||
        relation?.locationId ||
        relation?.locations?.id ||
        relation?.location?.id ||
        relation?.id ||
        null
      );
    })
    .filter(Boolean)
    .map(String);
}

function normalizeLocation(location) {
  return {
    ...location,

    id:
      location?.id ||
      "",

    organization_id:
      location?.organization_id ||
      location?.organizationId ||
      null,

    name:
      location?.name ||
      "موقع دون اسم",

    address:
      location?.address ||
      "",

    description:
      location?.description ||
      "",

    is_active:
      location?.is_active ??
      location?.isActive ??
      true,

    assets_count:
      Number(
        location?.assets_count ??
          location?.assetsCount ??
          0
      ),

    open_tickets_count:
      Number(
        location?.open_tickets_count ??
          location?.openTicketsCount ??
          0
      ),

    users_count:
      Number(
        location?.users_count ??
          location?.usersCount ??
          0
      ),

    tickets_count:
      Number(
        location?.tickets_count ??
          location?.ticketsCount ??
          0
      ),
  };
}

function readStoredLocations() {
  try {
    const storedValue =
      localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(DEFAULT_LOCATIONS)
      );

      return DEFAULT_LOCATIONS;
    }

    const parsedValue =
      JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : DEFAULT_LOCATIONS;
  } catch {
    return DEFAULT_LOCATIONS;
  }
}

function saveStoredLocations(locations) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(locations)
    );

    return true;
  } catch {
    return false;
  }
}

/* ==================================================
   الصفحة
================================================== */

export default function LocationsPage() {
  const {
    user,
    role: authRole,
    organizationId,
    isPlatformAdmin,
    isOrganizationAdmin,
    isDemo,
    can,
  } = useAuth();

  const role = normalizeRole(
    authRole || user?.role
  );

  const canManageLocations =
    isPlatformAdmin ||
    isOrganizationAdmin ||
    can("locations:manage") ||
    [
      "ORGANIZATION_ADMIN",
      "BRANCH_MANAGER",
    ].includes(role);

  const allowedLocationIds = useMemo(
    () => getUserLocationIds(user),
    [user]
  );

  const [locations, setLocations] =
    useState([]);

  const [
    organizations,
    setOrganizations,
  ] = useState([]);

  const [
    organizationFilter,
    setOrganizationFilter,
  ] = useState(
    isPlatformAdmin
      ? ""
      : organizationId || ""
  );

  const [
    formOrganizationId,
    setFormOrganizationId,
  ] = useState(
    organizationId || ""
  );

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [formMode, setFormMode] =
    useState(null);

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* ==================================================
     تحميل المواقع والمنشآت
  ================================================== */

  const loadPageData = useCallback(
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
          const storedLocations =
            readStoredLocations()
              .map(normalizeLocation);

          setOrganizations(
            DEMO_ORGANIZATIONS
          );

          let scopedLocations =
            storedLocations;

          if (
            !isPlatformAdmin &&
            organizationId
          ) {
            scopedLocations =
              scopedLocations.filter(
                (location) =>
                  String(
                    location.organization_id ||
                      ""
                  ) ===
                  String(
                    organizationId
                  )
              );
          }

          if (
            allowedLocationIds.length > 0
          ) {
            scopedLocations =
              scopedLocations.filter(
                (location) =>
                  allowedLocationIds.includes(
                    String(location.id)
                  )
              );
          }

          setLocations(
            scopedLocations
          );

          return;
        }

        const organizationPromise =
          isPlatformAdmin
            ? requireSupabase()
                .from("organizations")
                .select(
                  `
                    id,
                    name,
                    status
                  `
                )
                .order("name")
            : Promise.resolve({
                data: [],
                error: null,
              });

        const targetOrganizationId =
          isPlatformAdmin
            ? organizationFilter ||
              null
            : organizationId ||
              null;

        const [
          loadedLocations,
          organizationsResult,
        ] = await Promise.all([
          listLocations({
            organizationId:
              targetOrganizationId,

            includeCounts: true,
          }),

          organizationPromise,
        ]);

        if (
          organizationsResult.error
        ) {
          throw organizationsResult.error;
        }

        let scopedLocations =
          (loadedLocations || [])
            .map(normalizeLocation);

        if (
          allowedLocationIds.length > 0
        ) {
          scopedLocations =
            scopedLocations.filter(
              (location) =>
                allowedLocationIds.includes(
                  String(location.id)
                )
            );
        }

        setLocations(
          scopedLocations
        );

        setOrganizations(
          organizationsResult.data ||
            []
        );
      } catch (loadError) {
        setLocations([]);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "تعذر تحميل المواقع."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      isDemo,
      isPlatformAdmin,
      organizationId,
      organizationFilter,
      allowedLocationIds,
    ]
  );

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  /* ==================================================
     تصفية المواقع
  ================================================== */

  const filteredLocations =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(search);

      return locations.filter(
        (location) => {
          const matchesSearch =
            !normalizedSearch ||
            [
              location.name,
              location.address,
              location.description,
            ].some((value) =>
              normalizeText(
                value
              ).includes(
                normalizedSearch
              )
            );

          const isActive =
            location.is_active ??
            true;

          const matchesStatus =
            !statusFilter ||
            (statusFilter ===
              "ACTIVE" &&
              isActive) ||
            (statusFilter ===
              "INACTIVE" &&
              !isActive);

          const matchesOrganization =
            !organizationFilter ||
            String(
              location.organization_id ||
                ""
            ) ===
              String(
                organizationFilter
              );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesOrganization
          );
        }
      );
    }, [
      locations,
      search,
      statusFilter,
      organizationFilter,
    ]);

  /* ==================================================
     الإحصاءات
  ================================================== */

  const statistics = useMemo(
    () => ({
      total:
        locations.length,

      active:
        locations.filter(
          (location) =>
            location.is_active ===
            true
        ).length,

      inactive:
        locations.filter(
          (location) =>
            location.is_active ===
            false
        ).length,

      assets:
        locations.reduce(
          (total, location) =>
            total +
            Number(
              location.assets_count ||
                0
            ),
          0
        ),

      openTickets:
        locations.reduce(
          (total, location) =>
            total +
            Number(
              location.open_tickets_count ||
                0
            ),
          0
        ),

      users:
        locations.reduce(
          (total, location) =>
            total +
            Number(
              location.users_count ||
                0
            ),
          0
        ),
    }),
    [locations]
  );

  const hasFilters = Boolean(
    search ||
      statusFilter ||
      (isPlatformAdmin &&
        organizationFilter)
  );

  /* ==================================================
     فتح وإغلاق النموذج
  ================================================== */

  function openCreateForm() {
    if (!canManageLocations) {
      setError(
        "لا تملكين صلاحية إضافة المواقع."
      );

      return;
    }

    const defaultOrganizationId =
      isPlatformAdmin
        ? organizationFilter ||
          organizations[0]?.id ||
          ""
        : organizationId ||
          "";

    setSelectedLocation(null);
    setFormMode("create");

    setFormOrganizationId(
      defaultOrganizationId
    );

    setFormError("");
    setSuccessMessage("");
  }

  function openEditForm(location) {
    if (!canManageLocations) {
      return;
    }

    setSelectedLocation(location);
    setFormMode("edit");

    setFormOrganizationId(
      location.organization_id ||
        organizationId ||
        ""
    );

    setFormError("");
    setSuccessMessage("");
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormMode(null);
    setSelectedLocation(null);
    setFormError("");
  }

  /* ==================================================
     حفظ الموقع
  ================================================== */

  async function handleSaveLocation(
    payload
  ) {
    if (
      !canManageLocations ||
      saving
    ) {
      return;
    }

    const targetOrganizationId =
      selectedLocation
        ?.organization_id ||
      formOrganizationId ||
      organizationId ||
      null;

    if (!targetOrganizationId) {
      setFormError(
        "يجب اختيار المنشأة التابعة للموقع."
      );

      return;
    }

    const duplicateName =
      locations.some(
        (location) =>
          normalizeText(
            location.name
          ) ===
            normalizeText(
              payload.name
            ) &&
          String(
            location.organization_id ||
              ""
          ) ===
            String(
              targetOrganizationId
            ) &&
          String(location.id) !==
            String(
              selectedLocation?.id ||
                ""
            )
      );

    if (duplicateName) {
      setFormError(
        "يوجد موقع آخر مسجل بالاسم نفسه داخل المنشأة."
      );

      return;
    }

    setSaving(true);
    setFormError("");
    setError("");
    setSuccessMessage("");

    try {
      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const currentLocations =
          readStoredLocations()
            .map(normalizeLocation);

        let nextLocations;

        if (
          formMode === "edit" &&
          selectedLocation
        ) {
          nextLocations =
            currentLocations.map(
              (location) =>
                String(
                  location.id
                ) ===
                String(
                  selectedLocation.id
                )
                  ? {
                      ...location,

                      name:
                        payload.name,

                      address:
                        payload.address ||
                        null,

                      description:
                        payload.description ||
                        null,

                      is_active:
                        payload.isActive,

                      updated_at:
                        new Date()
                          .toISOString(),
                    }
                  : location
            );

          setSuccessMessage(
            "تم تحديث بيانات الموقع بنجاح."
          );
        } else {
          const newLocation = {
            id:
              createId(
                "location"
              ),

            organization_id:
              targetOrganizationId,

            name:
              payload.name,

            address:
              payload.address ||
              null,

            description:
              payload.description ||
              null,

            is_active:
              payload.isActive,

            assets_count: 0,
            open_tickets_count: 0,
            users_count: 0,
            tickets_count: 0,

            created_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          };

          nextLocations = [
            newLocation,
            ...currentLocations,
          ];

          setSuccessMessage(
            "تمت إضافة الموقع بنجاح."
          );
        }

        saveStoredLocations(
          nextLocations
        );
      } else if (
        formMode === "edit" &&
        selectedLocation
      ) {
        await updateLocation(
          selectedLocation.id,
          payload
        );

        setSuccessMessage(
          "تم تحديث بيانات الموقع بنجاح."
        );
      } else {
        await createLocation({
          ...payload,

          organizationId:
            targetOrganizationId,
        });

        setSuccessMessage(
          "تمت إضافة الموقع بنجاح."
        );
      }

      closeForm();

      await loadPageData({
        silent: true,
      });
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "تعذر حفظ الموقع."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==================================================
     تفعيل وتعطيل الموقع
  ================================================== */

  async function handleToggleStatus(
    location
  ) {
    if (
      !canManageLocations ||
      saving ||
      !location?.id
    ) {
      return;
    }

    const isActive =
      location.is_active ??
      true;

    if (
      isActive &&
      Number(
        location.open_tickets_count ||
          0
      ) > 0
    ) {
      setError(
        `لا يمكن تعطيل الموقع لوجود ${
          location.open_tickets_count
        } طلب صيانة مفتوح مرتبط به.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        isActive
          ? `هل تريدين تعطيل موقع "${location.name}"؟`
          : `هل تريدين تفعيل موقع "${location.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const currentLocations =
          readStoredLocations()
            .map(normalizeLocation);

        const nextLocations =
          currentLocations.map(
            (storedLocation) =>
              String(
                storedLocation.id
              ) ===
              String(location.id)
                ? {
                    ...storedLocation,

                    is_active:
                      !isActive,

                    updated_at:
                      new Date()
                        .toISOString(),
                  }
                : storedLocation
          );

        saveStoredLocations(
          nextLocations
        );
      } else {
        await toggleLocationStatus(
          location
        );
      }

      await loadPageData({
        silent: true,
      });

      setSuccessMessage(
        isActive
          ? "تم تعطيل الموقع."
          : "تم تفعيل الموقع."
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "تعذر تحديث حالة الموقع."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==================================================
     إعادة تعيين الفلاتر
  ================================================== */

  function resetFilters() {
    setSearch("");
    setStatusFilter("");

    if (isPlatformAdmin) {
      setOrganizationFilter("");
    }
  }

  /* ==================================================
     واجهة الصفحة
  ================================================== */

  return (
    <>
      <div className="page-header">
        <div>
          <small>
            إدارة المنشأة
          </small>

          <h1>
            المواقع والفروع
          </h1>

          <p>
            أضيفي فروع المنشأة وتابعي الأجهزة والطلبات
            المرتبطة بكل موقع.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <button
            type="button"
            className="secondary"
            onClick={() =>
              loadPageData({
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
              : "↻ تحديث"}
          </button>

          {canManageLocations ? (
            <button
              type="button"
              className="primary"
              onClick={openCreateForm}
              disabled={
                loading ||
                saving
              }
            >
              ＋ إضافة موقع
            </button>
          ) : null}
        </div>
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
            المواقع والتعديلات محفوظة محليًا داخل المتصفح.
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="demo-callout"
          role="status"
          style={{
            marginBottom: "16px",
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
              إجمالي المواقع
            </small>

            <strong>
              {statistics.total}
            </strong>

            <p>
              جميع الفروع والمرافق
            </p>
          </div>

          <span
            className="stat-icon blue-bg"
            aria-hidden="true"
          >
            ⌖
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              مواقع نشطة
            </small>

            <strong>
              {statistics.active}
            </strong>

            <p>
              تستقبل طلبات الصيانة
            </p>
          </div>

          <span
            className="stat-icon green-bg"
            aria-hidden="true"
          >
            ✓
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              إجمالي الأجهزة
            </small>

            <strong>
              {statistics.assets}
            </strong>

            <p>
              موزعة على المواقع
            </p>
          </div>

          <span
            className="stat-icon amber-bg"
            aria-hidden="true"
          >
            ◫
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              طلبات مفتوحة
            </small>

            <strong>
              {statistics.openTickets}
            </strong>

            <p>
              تحتاج إلى متابعة
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
          marginBottom: "18px",
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
              البحث والتصفية
            </h2>

            <p>
              ابحثي باسم الموقع أو عنوانه
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",

            gap: "10px",
            alignItems: "end",
          }}
        >
          <label>
            البحث

            <input
              type="search"
              value={search}
              placeholder="اسم الموقع أو العنوان..."
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

          {isPlatformAdmin ? (
            <label>
              المنشأة

              <select
                value={
                  organizationFilter
                }
                onChange={(event) =>
                  setOrganizationFilter(
                    event.target.value
                  )
                }
                disabled={
                  loading ||
                  refreshing
                }
              >
                <option value="">
                  جميع المنشآت
                </option>

                {organizations.map(
                  (organization) => (
                    <option
                      key={
                        organization.id
                      }
                      value={
                        organization.id
                      }
                    >
                      {organization.name}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : null}

          <label>
            حالة الموقع

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
              <option value="">
                جميع الحالات
              </option>

              <option value="ACTIVE">
                نشط
              </option>

              <option value="INACTIVE">
                غير نشط
              </option>
            </select>
          </label>

          <button
            type="button"
            className="secondary"
            onClick={resetFilters}
            disabled={
              loading ||
              refreshing ||
              !hasFilters
            }
          >
            إعادة تعيين
          </button>
        </div>

        <small
          style={{
            color: "#7d8c89",
          }}
        >
          عرض {filteredLocations.length} من أصل{" "}
          {locations.length} موقعًا
        </small>
      </section>

      {/* قائمة المواقع */}
      {loading ? (
        <section
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fill, minmax(290px, 1fr))",

            gap: "16px",
          }}
          role="status"
          aria-live="polite"
        >
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="panel"
                style={{
                  height: "320px",
                  background:
                    "#edf1f0",
                }}
              />
            )
          )}
        </section>
      ) : filteredLocations.length ===
        0 ? (
        <section className="panel">
          <EmptyState
            icon="⌖"
            title="لا توجد مواقع"
            description={
              hasFilters
                ? "لا توجد مواقع مطابقة للبحث أو الفلاتر المحددة."
                : "لم تتم إضافة مواقع إلى المنشأة حتى الآن."
            }
            actionLabel={
              hasFilters
                ? "إزالة الفلاتر"
                : canManageLocations
                  ? "إضافة موقع"
                  : ""
            }
            onAction={
              hasFilters
                ? resetFilters
                : canManageLocations
                  ? openCreateForm
                  : undefined
            }
          />
        </section>
      ) : (
        <section
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fill, minmax(290px, 1fr))",

            gap: "16px",
          }}
        >
          {filteredLocations.map(
            (location) => (
              <LocationCard
                key={location.id}
                location={location}
                disabled={saving}
                onOpen={
                  canManageLocations
                    ? openEditForm
                    : undefined
                }
                onEdit={
                  canManageLocations
                    ? openEditForm
                    : undefined
                }
                onToggleStatus={
                  canManageLocations
                    ? handleToggleStatus
                    : undefined
                }
              />
            )
          )}
        </section>
      )}

      {/* نافذة إضافة وتعديل الموقع */}
      <Modal
        open={Boolean(formMode)}
        onClose={closeForm}
        title={
          formMode === "edit"
            ? "تعديل بيانات الموقع"
            : "إضافة موقع جديد"
        }
        description={
          formMode === "edit"
            ? "حدّثي اسم الموقع وعنوانه وحالته."
            : "أدخلي بيانات الفرع أو المرفق الجديد."
        }
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        showCloseButton={!saving}
      >
        {isPlatformAdmin &&
        formMode === "create" ? (
          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "14px",
            }}
          >
            المنشأة

            <select
              value={
                formOrganizationId
              }
              onChange={(event) => {
                setFormOrganizationId(
                  event.target.value
                );

                setFormError("");
              }}
              disabled={saving}
            >
              <option value="">
                اختاري المنشأة
              </option>

              {organizations.map(
                (organization) => (
                  <option
                    key={
                      organization.id
                    }
                    value={
                      organization.id
                    }
                  >
                    {organization.name}
                  </option>
                )
              )}
            </select>
          </label>
        ) : null}

        <LocationForm
          key={`${formMode}-${selectedLocation?.id || "new"}`}
          initialValues={
            selectedLocation || {}
          }
          busy={saving}
          error={formError}
          submitText={
            formMode === "edit"
              ? "حفظ التعديلات"
              : "إضافة الموقع"
          }
          onSubmit={
            handleSaveLocation
          }
          onCancel={closeForm}
        />
      </Modal>
    </>
  );
}