import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";
import UserForm from "../../components/users/UserForm";
import UserTable from "../../components/users/UserTable";

import {
  ROLE,
  ROLE_LABELS,
} from "../../constants/roles";

import useAuth from "../../hooks/useAuth";
import { readLocalLocations, readLocalUsers, saveLocalUsers } from "../../lib/localData";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import {
  createUser,
  listUsers,
  toggleUserStatus,
  updateUser,
} from "../../services/userService";

/* ==================================================
   إعدادات التخزين التجريبي
================================================== */

const STORAGE_KEY = "fixflow_users";

/* ==================================================
   بيانات المنشآت التجريبية
================================================== */

const DEMO_ORGANIZATIONS = [
  {
    id: "demo-organization",
    name: "منشأة FixFlow التجريبية",
    status: "ACTIVE",
  },
  {
    id: "demo-organization-2",
    name: "شركة النموذج الثانية",
    status: "ACTIVE",
  },
];

/* ==================================================
   بيانات المواقع التجريبية
================================================== */

const DEMO_LOCATIONS = [
  {
    id: "demo-location-riyadh",
    organization_id: "demo-organization",
    name: "فرع الرياض",
    is_active: true,
  },
  {
    id: "demo-location-north",
    organization_id: "demo-organization",
    name: "الفرع الشمالي",
    is_active: true,
  },
  {
    id: "demo-location-hail",
    organization_id: "demo-organization",
    name: "فرع حائل",
    is_active: true,
  },
  {
    id: "demo-location-company-2",
    organization_id: "demo-organization-2",
    name: "الفرع الرئيسي",
    is_active: true,
  },
];

/* ==================================================
   المستخدمون التجريبيون
================================================== */

const DEMO_USERS = [
  {
    id: "demo-platform-admin",
    organization_id: null,
    full_name: "مدير المنصة",
    email: "platform@fixflow.demo",
    phone: "0500000001",
    role: ROLE.PLATFORM_ADMIN,
    is_active: true,
    location_ids: [],
    created_at: "2026-07-01T09:00:00+03:00",
  },
  {
    id: "demo-organization-admin",
    organization_id: "demo-organization",
    full_name: "نورة الناصر",
    email: "admin@fixflow.demo",
    phone: "0500000002",
    role: ROLE.ORGANIZATION_ADMIN,
    is_active: true,
    location_ids: [],
    created_at: "2026-07-02T09:00:00+03:00",
  },
  {
    id: "demo-branch-manager",
    organization_id: "demo-organization",
    full_name: "خالد الشمري",
    email: "branch@fixflow.demo",
    phone: "0500000003",
    role: ROLE.BRANCH_MANAGER,
    is_active: true,
    location_ids: [
      "demo-location-riyadh",
    ],
    created_at: "2026-07-03T10:00:00+03:00",
  },
  {
    id: "demo-supervisor",
    organization_id: "demo-organization",
    full_name: "سارة العتيبي",
    email: "supervisor@fixflow.demo",
    phone: "0500000004",
    role: ROLE.SUPERVISOR,
    is_active: true,
    location_ids: [
      "demo-location-riyadh",
      "demo-location-north",
    ],
    created_at: "2026-07-04T10:00:00+03:00",
  },
  {
    id: "technician-1",
    organization_id: "demo-organization",
    full_name: "محمد العتيبي",
    email: "technician@fixflow.demo",
    phone: "0500000005",
    role: ROLE.TECHNICIAN,
    specialization: "تكييف وتبريد",
    availability_status: "AVAILABLE",
    is_active: true,
    location_ids: [
      "demo-location-riyadh",
      "demo-location-north",
    ],
    open_tickets_count: 3,
    created_at: "2026-07-05T08:00:00+03:00",
  },
  {
    id: "demo-inventory-manager",
    organization_id: "demo-organization",
    full_name: "أحمد الحربي",
    email: "inventory@fixflow.demo",
    phone: "0500000006",
    role: ROLE.INVENTORY_MANAGER,
    is_active: true,
    location_ids: [],
    created_at: "2026-07-06T08:00:00+03:00",
  },
  {
    id: "reporter-demo",
    organization_id: "demo-organization",
    full_name: "ريم محمد",
    email: "reporter@fixflow.demo",
    phone: "0500000007",
    role: ROLE.REGISTERED_REPORTER,
    is_active: true,
    location_ids: [],
    created_at: "2026-07-07T08:00:00+03:00",
  },
];

/* ==================================================
   دوال مساعدة
================================================== */

function createId(prefix = "user") {
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

function normalizeLocationIds(user) {
  if (Array.isArray(user?.location_ids)) {
    return user.location_ids
      .filter(Boolean)
      .map(String);
  }

  if (Array.isArray(user?.locationIds)) {
    return user.locationIds
      .filter(Boolean)
      .map(String);
  }

  if (Array.isArray(user?.user_locations)) {
    return user.user_locations
      .map((entry) => {
        return (
          entry?.location_id ||
          entry?.locationId ||
          entry?.locations?.id ||
          entry?.location?.id ||
          null
        );
      })
      .filter(Boolean)
      .map(String);
  }

  return [];
}

function normalizeUser(user) {
  return {
    ...user,

    id:
      user?.id ||
      user?.user_id ||
      "",

    organization_id:
      user?.organization_id ||
      user?.organizationId ||
      null,

    full_name:
      user?.full_name ||
      user?.fullName ||
      user?.name ||
      "",

    email:
      user?.email || "",

    phone:
      user?.phone ||
      user?.phone_number ||
      "",

    role:
      normalizeRole(user?.role),

    specialization:
      user?.specialization || "",

    availability_status:
      user?.availability_status ||
      user?.availabilityStatus ||
      "AVAILABLE",

    is_active:
      user?.is_active ??
      user?.isActive ??
      true,

    location_ids:
      normalizeLocationIds(user),

    open_tickets_count:
      Number(
        user?.open_tickets_count ??
          user?.openTicketsCount ??
          0
      ),
  };
}

function addLocationNames(
  user,
  locations
) {
  const normalizedUser =
    normalizeUser(user);

  const locationIds =
    normalizedUser.location_ids;

  const userLocations =
    locations
      .filter((location) =>
        locationIds.includes(
          String(location.id)
        )
      )
      .map((location) => ({
        id: location.id,
        name: location.name,
        location_id: location.id,

        locations: {
          id: location.id,
          name: location.name,
        },
      }));

  return {
    ...normalizedUser,

    locations:
      userLocations,

    user_locations:
      userLocations,
  };
}

function readStoredUsers() {
  return readLocalUsers();
}

function saveStoredUsers(users) {
  try {
    saveLocalUsers(users);

    return true;
  } catch {
    return false;
  }
}

function getRoleLabel(role) {
  return (
    ROLE_LABELS?.[role] ||
    role ||
    "دور غير محدد"
  );
}

function getAllowedRoles(
  currentRole
) {
  switch (currentRole) {
    case ROLE.PLATFORM_ADMIN:
      return [
        ROLE.PLATFORM_ADMIN,
        ROLE.ORGANIZATION_ADMIN,
        ROLE.BRANCH_MANAGER,
        ROLE.SUPERVISOR,
        ROLE.TECHNICIAN,
        ROLE.INVENTORY_MANAGER,
        ROLE.REGISTERED_REPORTER,
      ];

    case ROLE.ORGANIZATION_ADMIN:
      return [
        ROLE.ORGANIZATION_ADMIN,
        ROLE.BRANCH_MANAGER,
        ROLE.SUPERVISOR,
        ROLE.TECHNICIAN,
        ROLE.INVENTORY_MANAGER,
        ROLE.REGISTERED_REPORTER,
      ];

    case ROLE.BRANCH_MANAGER:
      return [
        ROLE.SUPERVISOR,
        ROLE.TECHNICIAN,
        ROLE.REGISTERED_REPORTER,
      ];

    case ROLE.SUPERVISOR:
      return [
        ROLE.TECHNICIAN,
      ];

    default:
      return [];
  }
}

function sortUsers(
  users,
  sortBy,
  sortDirection
) {
  const direction =
    sortDirection === "desc"
      ? -1
      : 1;

  return [...users].sort(
    (firstUser, secondUser) => {
      const firstValue =
        firstUser?.[sortBy] ?? "";

      const secondValue =
        secondUser?.[sortBy] ?? "";

      if (
        sortBy === "created_at"
      ) {
        return (
          (new Date(firstValue).getTime() -
            new Date(secondValue).getTime()) *
          direction
        );
      }

      return (
        String(firstValue).localeCompare(
          String(secondValue),
          "ar",
          {
            numeric: true,
            sensitivity: "base",
          }
        ) * direction
      );
    }
  );
}

/* ==================================================
   الصفحة
================================================== */

export default function UsersPage() {
  const {
    user: currentUser,
    role: authRole,
    organizationId,
    isPlatformAdmin,
    isOrganizationAdmin,
    isDemo,
    can,
  } = useAuth();

  const currentRole =
    normalizeRole(
      authRole ||
      currentUser?.role
    );

  const canManageUsers =
    can("users:manage") ||
    isPlatformAdmin ||
    isOrganizationAdmin;

  const allowedRoles =
    useMemo(
      () =>
        getAllowedRoles(
          currentRole
        ),
      [currentRole]
    );

  const [users, setUsers] =
    useState([]);

  const [
    locations,
    setLocations,
  ] = useState([]);

  const [
    organizations,
    setOrganizations,
  ] = useState([]);

  const [search, setSearch] =
    useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    organizationFilter,
    setOrganizationFilter,
  ] = useState(
    isPlatformAdmin
      ? ""
      : organizationId || ""
  );

  const [
    sortBy,
    setSortBy,
  ] = useState("full_name");

  const [
    sortDirection,
    setSortDirection,
  ] = useState("asc");

  const [
    formMode,
    setFormMode,
  ] = useState(null);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState(null);

  const [
    formOrganizationId,
    setFormOrganizationId,
  ] = useState(
    organizationId || ""
  );

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
     تحميل البيانات
  ================================================== */

  const loadPageData =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!canManageUsers) {
          setLoading(false);
          return;
        }

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
            const storedUsers =
              readStoredUsers();
            const storedLocations = readLocalLocations();

            setOrganizations(
              DEMO_ORGANIZATIONS.filter((item) =>
                !organizationId || String(item.id) === String(organizationId)
              ).slice(0, 1)
            );

            setLocations(
              storedLocations
            );

            setUsers(
              storedUsers.map(
                (storedUser) =>
                  addLocationNames(
                    storedUser,
                    storedLocations
                  )
              )
            );

            return;
          }

          const userFilters = {
            limit: 1000,
            includeWorkload: true,
          };

          if (
            !isPlatformAdmin &&
            organizationId
          ) {
            userFilters.organizationId =
              organizationId;
          }

          const usersPromise =
            listUsers(userFilters);

          let locationsQuery =
            requireSupabase()
              .from("locations")
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

          if (
            !isPlatformAdmin &&
            organizationId
          ) {
            locationsQuery =
              locationsQuery.eq(
                "organization_id",
                organizationId
              );
          }

          const organizationsPromise =
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

          const [
            usersResult,
            locationsResult,
            organizationsResult,
          ] = await Promise.all([
            usersPromise,
            locationsQuery,
            organizationsPromise,
          ]);

          if (
            locationsResult.error
          ) {
            throw locationsResult.error;
          }

          if (
            organizationsResult.error
          ) {
            throw organizationsResult.error;
          }

          const loadedLocations =
            locationsResult.data ||
            [];

          setLocations(
            loadedLocations
          );

          setOrganizations(
            isPlatformAdmin
              ? organizationsResult.data ||
                  []
              : []
          );

          setUsers(
            (usersResult || []).map(
              (loadedUser) =>
                addLocationNames(
                  loadedUser,
                  loadedLocations
                )
            )
          );
        } catch (loadError) {
          setUsers([]);

          setError(
            loadError instanceof Error
              ? loadError.message
              : "تعذر تحميل المستخدمين."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        canManageUsers,
        isDemo,
        isPlatformAdmin,
        organizationId,
      ]
    );

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  /* ==================================================
     تصفية المستخدمين
  ================================================== */

  const filteredUsers =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(search);

      const matchingUsers =
        users.filter((user) => {
          const matchesOrganization =
            !organizationFilter ||
            String(
              user.organization_id ||
                ""
            ) ===
              String(
                organizationFilter
              );

          const matchesRole =
            !roleFilter ||
            user.role ===
              roleFilter;

          const matchesStatus =
            !statusFilter ||
            (statusFilter ===
              "ACTIVE" &&
              user.is_active) ||
            (statusFilter ===
              "INACTIVE" &&
              !user.is_active);

          const matchesSearch =
            !normalizedSearch ||
            [
              user.full_name,
              user.email,
              user.phone,
              user.specialization,
              getRoleLabel(
                user.role
              ),
            ].some((value) =>
              normalizeText(
                value
              ).includes(
                normalizedSearch
              )
            );

          return (
            matchesOrganization &&
            matchesRole &&
            matchesStatus &&
            matchesSearch
          );
        });

      return sortUsers(
        matchingUsers,
        sortBy,
        sortDirection
      );
    }, [
      users,
      search,
      roleFilter,
      statusFilter,
      organizationFilter,
      sortBy,
      sortDirection,
    ]);

  /* ==================================================
     الإحصاءات
  ================================================== */

  const statistics =
    useMemo(() => {
      const scopedUsers =
        users.filter((user) => {
          return (
            !organizationFilter ||
            String(
              user.organization_id ||
                ""
            ) ===
              String(
                organizationFilter
              )
          );
        });

      return {
        total:
          scopedUsers.length,

        active:
          scopedUsers.filter(
            (user) =>
              user.is_active
          ).length,

        branchManagers:
          scopedUsers.filter(
            (user) =>
              user.role ===
              ROLE.BRANCH_MANAGER
          ).length,

        supervisors:
          scopedUsers.filter(
            (user) =>
              user.role ===
              ROLE.SUPERVISOR
          ).length,

        technicians:
          scopedUsers.filter(
            (user) =>
              user.role ===
              ROLE.TECHNICIAN
          ).length,

        reporters:
          scopedUsers.filter(
            (user) =>
              user.role ===
              ROLE.REGISTERED_REPORTER
          ).length,
      };
    }, [
      users,
      organizationFilter,
    ]);

  /* ==================================================
     المواقع المتاحة للنموذج
  ================================================== */

  const formLocations =
    useMemo(() => {
      const targetOrganizationId =
        formOrganizationId ||
        organizationId ||
        "";

      if (
        !targetOrganizationId
      ) {
        return [];
      }

      return locations.filter(
        (location) =>
          String(
            location.organization_id ||
              ""
          ) ===
          String(
            targetOrganizationId
          )
      );
    }, [
      locations,
      formOrganizationId,
      organizationId,
    ]);

  /* ==================================================
     فتح وإغلاق النموذج
  ================================================== */

  function openCreateForm() {
    const defaultOrganizationId =
      isPlatformAdmin
        ? organizationFilter ||
          organizations[0]?.id ||
          ""
        : organizationId || "";

    setSelectedUser(null);
    setFormMode("create");

    setFormOrganizationId(
      defaultOrganizationId
    );

    setFormError("");
    setSuccessMessage("");
  }

  function openEditForm(user) {
    setSelectedUser(user);
    setFormMode("edit");

    setFormOrganizationId(
      user.organization_id ||
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
    setSelectedUser(null);
    setFormError("");
  }

  /* ==================================================
     حفظ المستخدم
  ================================================== */

  async function handleSaveUser(
    formValues
  ) {
    if (saving) {
      return;
    }

    const targetOrganizationId =
      formValues.role ===
      ROLE.PLATFORM_ADMIN
        ? null
        : formOrganizationId ||
          organizationId ||
          null;

    if (
      formValues.role !==
        ROLE.PLATFORM_ADMIN &&
      !targetOrganizationId
    ) {
      setFormError(
        "يجب اختيار المنشأة التي ينتمي إليها المستخدم."
      );

      return;
    }

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    try {
      let savedUser;

      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const currentUsers =
          readStoredUsers().map(
            normalizeUser
          );

        if (
          formMode === "edit" &&
          selectedUser
        ) {
          savedUser = {
            ...selectedUser,
            ...formValues,

            id:
              selectedUser.id,

            organization_id:
              targetOrganizationId,

            full_name:
              formValues.fullName,

            availability_status:
              formValues.availabilityStatus ||
              "AVAILABLE",

            is_active:
              formValues.isActive,

            location_ids:
              formValues.locationIds ||
              [],

            updated_at:
              new Date()
                .toISOString(),
          };

          const nextUsers =
            currentUsers.map(
              (user) =>
                String(user.id) ===
                String(
                  selectedUser.id
                )
                  ? savedUser
                  : user
            );

          saveStoredUsers(
            nextUsers
          );
        } else {
          savedUser = {
            id:
              createId("user"),

            organization_id:
              targetOrganizationId,

            full_name:
              formValues.fullName,

            email:
              formValues.email,

            phone:
              formValues.phone,

            role:
              formValues.role,

            specialization:
              formValues.specialization ||
              "",

            availability_status:
              formValues.availabilityStatus ||
              "AVAILABLE",

            is_active:
              formValues.isActive,

            location_ids:
              formValues.locationIds ||
              [],

            created_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          };

          saveStoredUsers([
            savedUser,
            ...currentUsers,
          ]);
        }
      } else if (
        formMode === "edit" &&
        selectedUser
      ) {
        savedUser =
          await updateUser(
            selectedUser.id,
            {
              ...formValues,

              organizationId:
                targetOrganizationId,
            }
          );
      } else {
        savedUser =
          await createUser({
            ...formValues,

            organizationId:
              targetOrganizationId,
          });
      }

      await loadPageData({
        silent: true,
      });

      closeForm();

      setSuccessMessage(
        formMode === "edit"
          ? "تم تحديث بيانات المستخدم بنجاح."
          : formValues.sendInviteNow
            ? "تم إنشاء المستخدم وإرسال دعوة تسجيل الدخول."
            : "تم إنشاء المستخدم بنجاح."
      );

      return savedUser;
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "تعذر حفظ بيانات المستخدم."
      );

      return null;
    } finally {
      setSaving(false);
    }
  }

  /* ==================================================
     تفعيل أو تعطيل المستخدم
  ================================================== */

  async function handleToggleStatus(
    targetUser
  ) {
    if (
      saving ||
      !targetUser?.id
    ) {
      return;
    }

    if (
      String(targetUser.id) ===
      String(currentUser?.id)
    ) {
      setError(
        "لا يمكنك تعطيل حسابك الحالي."
      );

      return;
    }

    const nextStatus =
      !targetUser.is_active;

    const confirmed =
      window.confirm(
        nextStatus
          ? `هل تريد تفعيل حساب ${targetUser.full_name}؟`
          : `هل تريد تعطيل حساب ${targetUser.full_name}؟`
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
        const currentUsers =
          readStoredUsers().map(
            normalizeUser
          );

        const nextUsers =
          currentUsers.map(
            (user) =>
              String(user.id) ===
              String(
                targetUser.id
              )
                ? {
                    ...user,

                    is_active:
                      nextStatus,

                    updated_at:
                      new Date()
                        .toISOString(),
                  }
                : user
          );

        saveStoredUsers(
          nextUsers
        );
      } else {
        await toggleUserStatus(
          targetUser
        );
      }

      await loadPageData({
        silent: true,
      });

      setSuccessMessage(
        nextStatus
          ? "تم تفعيل حساب المستخدم."
          : "تم تعطيل حساب المستخدم."
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "تعذر تحديث حالة المستخدم."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==================================================
     ترتيب الجدول
  ================================================== */

  function handleSort(fieldName) {
    if (sortBy === fieldName) {
      setSortDirection(
        (currentDirection) =>
          currentDirection ===
          "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    setSortBy(fieldName);
    setSortDirection("asc");
  }

  function resetFilters() {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");

    setOrganizationFilter(
      isPlatformAdmin
        ? ""
        : organizationId || ""
    );
  }

  /* ==================================================
     منع الوصول
  ================================================== */

  if (!canManageUsers) {
    return (
      <section className="panel">
        <EmptyState
          icon="!"
          title="لا تملك صلاحية إدارة المستخدمين"
          description="هذه الصفحة متاحة فقط للحسابات المخولة بإدارة المستخدمين."
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
            إدارة الحسابات والصلاحيات
          </small>

          <h1>
            المستخدمون
          </h1>

          <p>
            أضف المستخدمين وحدد أدوارهم
            والفروع التي يمكنهم الوصول إليها.
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

          {allowedRoles.length > 0 ? (
            <button
              type="button"
              className="primary"
              onClick={
                openCreateForm
              }
              disabled={
                loading ||
                saving
              }
            >
              + إضافة مستخدم
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
            التعديلات محفوظة محليًا في
            المتصفح ولن تُرسل دعوات بريدية حقيقية.
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
              إجمالي المستخدمين
            </small>

            <strong>
              {statistics.total}
            </strong>

            <p>
              جميع الحسابات ضمن النطاق
            </p>
          </div>

          <span
            className="stat-icon blue-bg"
            aria-hidden="true"
          >
            ♙
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              الحسابات النشطة
            </small>

            <strong>
              {statistics.active}
            </strong>

            <p>
              يمكنها تسجيل الدخول
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
              مديرو الفروع
            </small>

            <strong>
              {statistics.branchManagers}
            </strong>

            <p>
              مسؤولون عن الفروع
            </p>
          </div>

          <span
            className="stat-icon violet-bg"
            aria-hidden="true"
          >
            ⌂
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              مشرفو الصيانة
            </small>

            <strong>
              {statistics.supervisors}
            </strong>

            <p>
              يتابعون فرق الصيانة
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
              الفنيون
            </small>

            <strong>
              {statistics.technicians}
            </strong>

            <p>
              ينفذون مهام الصيانة
            </p>
          </div>

          <span
            className="stat-icon blue-bg"
            aria-hidden="true"
          >
            ⚙
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
              البحث والتصفية
            </h2>

            <p>
              ابحث بالاسم أو البريد أو الدور
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",

            gap: "10px",
          }}
        >
          <label>
            البحث

            <input
              type="search"
              value={search}
              placeholder="الاسم، البريد، الجوال..."
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              disabled={loading}
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
                disabled={loading}
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
            الدور

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value
                )
              }
              disabled={loading}
            >
              <option value="">
                جميع الأدوار
              </option>

              {Object.values(
                ROLE
              ).map((role) => (
                <option
                  key={role}
                  value={role}
                >
                  {getRoleLabel(
                    role
                  )}
                </option>
              ))}
            </select>
          </label>

          <label>
            حالة الحساب

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              disabled={loading}
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
              (!search &&
                !roleFilter &&
                !statusFilter &&
                (!isPlatformAdmin ||
                  !organizationFilter))
            }
            style={{
              alignSelf: "end",
            }}
          >
            إعادة تعيين
          </button>
        </div>
      </section>

      {/* جدول المستخدمين */}
      <div
        style={{
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <strong>
            قائمة المستخدمين
          </strong>

          {!loading ? (
            <span className="badge green">
              {filteredUsers.length} مستخدم
            </span>
          ) : null}
        </div>

        <UserTable
          users={filteredUsers}
          loading={loading}
          sortBy={sortBy}
          sortDirection={
            sortDirection
          }
          disabled={saving}
          onSort={handleSort}
          onOpen={openEditForm}
          onEdit={openEditForm}
          onToggleStatus={
            handleToggleStatus
          }
        />
      </div>

      {/* نافذة الإضافة والتعديل */}
      <Modal
        open={Boolean(formMode)}
        title={
          formMode === "edit"
            ? "تعديل المستخدم"
            : "إضافة مستخدم جديد"
        }
        description={
          formMode === "edit"
            ? "عدّل بيانات المستخدم وصلاحياته."
            : "أدخل بيانات المستخدم وحدد دوره والفروع المسموحة."
        }
        onClose={closeForm}
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
      >
        {isPlatformAdmin ? (
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
                بدون منشأة — لمدير المنصة فقط
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

            <small
              style={{
                color: "#71817f",
              }}
            >
              لا يحتاج مدير المنصة إلى منشأة،
              بينما بقية الأدوار يجب ربطها بمنشأة.
            </small>
          </label>
        ) : null}

        <UserForm
          key={
            selectedUser?.id ||
            formMode ||
            "new-user"
          }
          locations={formLocations}
          initialValues={
            selectedUser || {}
          }
          allowedRoles={
            allowedRoles
          }
          busy={saving}
          error={formError}
          editMode={
            formMode === "edit"
          }
          submitText={
            formMode === "edit"
              ? "حفظ التعديلات"
              : "إنشاء المستخدم"
          }
          onSubmit={
            handleSaveUser
          }
          onCancel={closeForm}
        />
      </Modal>
    </>
  );
}
