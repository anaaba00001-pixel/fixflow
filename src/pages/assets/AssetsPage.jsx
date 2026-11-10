import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AssetCard from "../../components/assets/AssetCard";
import AssetForm from "../../components/assets/AssetForm";
import AssetQRCode from "../../components/assets/AssetQRCode";
import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";

import useAuth from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import {
  createAsset,
  getAssetQrToken,
  listAssets,
  regenerateAssetQr,
  updateAsset,
} from "../../services/assetService";

/* ==================================================
   إعدادات الصفحة
================================================== */

const ASSETS_STORAGE_KEY = "fixflow_assets";

const OPEN_TICKET_STATUSES = [
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PENDING_APPROVAL",
  "REOPENED",
];

const STATUS_OPTIONS = [
  {
    value: "",
    label: "جميع الحالات",
  },
  {
    value: "ACTIVE",
    label: "نشط",
  },
  {
    value: "UNDER_MAINTENANCE",
    label: "تحت الصيانة",
  },
  {
    value: "INACTIVE",
    label: "غير نشط",
  },
];

/* ==================================================
   بيانات الوضع التجريبي
================================================== */

const DEMO_LOCATIONS = [
  {
    id: "location-riyadh",
    organization_id: "demo-organization",
    name: "فرع الرياض",
    is_active: true,
  },
  {
    id: "location-north",
    organization_id: "demo-organization",
    name: "الفرع الشمالي",
    is_active: true,
  },
  {
    id: "location-hail",
    organization_id: "demo-organization",
    name: "فرع حائل",
    is_active: true,
  },
];

const DEMO_CATEGORIES = [
  {
    id: "category-ac",
    organization_id: "demo-organization",
    name: "تكييف وتبريد",
    is_active: true,
  },
  {
    id: "category-electric",
    organization_id: "demo-organization",
    name: "كهرباء وإنارة",
    is_active: true,
  },
  {
    id: "category-office",
    organization_id: "demo-organization",
    name: "معدات مكتبية",
    is_active: true,
  },
  {
    id: "category-plumbing",
    organization_id: "demo-organization",
    name: "سباكة",
    is_active: true,
  },
];

const DEMO_ASSETS = [
  {
    id: "asset-1",
    organization_id: "demo-organization",
    location_id: "location-riyadh",
    category_id: "category-ac",

    name: "مكيف غرفة الاجتماعات",
    asset_number: "AC-RYD-001",
    serial_number: "SN-AC-458921",

    location: {
      id: "location-riyadh",
      name: "فرع الرياض",
    },

    locations: {
      id: "location-riyadh",
      name: "فرع الرياض",
    },

    category: {
      id: "category-ac",
      name: "تكييف وتبريد",
    },

    categories: {
      id: "category-ac",
      name: "تكييف وتبريد",
    },

    status: "UNDER_MAINTENANCE",
    is_active: true,
    open_tickets_count: 1,

    qr_token: "demo-ac-ryd-001",

    created_at: "2026-07-10T09:00:00+03:00",
    updated_at: "2026-08-02T10:20:00+03:00",
  },
  {
    id: "asset-2",
    organization_id: "demo-organization",
    location_id: "location-riyadh",
    category_id: "category-office",

    name: "طابعة قسم الموارد البشرية",
    asset_number: "PR-RYD-004",
    serial_number: "SN-PR-773104",

    location: {
      id: "location-riyadh",
      name: "فرع الرياض",
    },

    locations: {
      id: "location-riyadh",
      name: "فرع الرياض",
    },

    category: {
      id: "category-office",
      name: "معدات مكتبية",
    },

    categories: {
      id: "category-office",
      name: "معدات مكتبية",
    },

    status: "ACTIVE",
    is_active: true,
    open_tickets_count: 0,

    qr_token: "demo-pr-ryd-004",

    created_at: "2026-07-12T11:30:00+03:00",
    updated_at: "2026-07-12T11:30:00+03:00",
  },
  {
    id: "asset-3",
    organization_id: "demo-organization",
    location_id: "location-north",
    category_id: "category-electric",

    name: "لوحة الكهرباء الرئيسية",
    asset_number: "EL-NTH-002",
    serial_number: "SN-EL-109845",

    location: {
      id: "location-north",
      name: "الفرع الشمالي",
    },

    locations: {
      id: "location-north",
      name: "الفرع الشمالي",
    },

    category: {
      id: "category-electric",
      name: "كهرباء وإنارة",
    },

    categories: {
      id: "category-electric",
      name: "كهرباء وإنارة",
    },

    status: "UNDER_MAINTENANCE",
    is_active: true,
    open_tickets_count: 2,

    qr_token: "demo-el-nth-002",

    created_at: "2026-07-15T08:45:00+03:00",
    updated_at: "2026-08-01T14:00:00+03:00",
  },
  {
    id: "asset-4",
    organization_id: "demo-organization",
    location_id: "location-hail",
    category_id: "category-plumbing",

    name: "مضخة المياه",
    asset_number: "PL-HAL-001",
    serial_number: "SN-PL-682431",

    location: {
      id: "location-hail",
      name: "فرع حائل",
    },

    locations: {
      id: "location-hail",
      name: "فرع حائل",
    },

    category: {
      id: "category-plumbing",
      name: "سباكة",
    },

    categories: {
      id: "category-plumbing",
      name: "سباكة",
    },

    status: "INACTIVE",
    is_active: false,
    open_tickets_count: 0,

    qr_token: "demo-pl-hal-001",

    created_at: "2026-07-18T13:10:00+03:00",
    updated_at: "2026-07-25T09:00:00+03:00",
  },
];

/* ==================================================
   دوال مساعدة
================================================== */

function createId(prefix = "asset") {
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

function getLocationName(asset) {
  return (
    asset?.location_name ||
    asset?.location?.name ||
    asset?.locations?.name ||
    "موقع غير محدد"
  );
}

function getCategoryName(asset) {
  return (
    asset?.category_name ||
    asset?.category?.name ||
    asset?.categories?.name ||
    "دون تصنيف"
  );
}

function getAssetStatus(asset) {
  if (asset?.is_active === false) {
    return "INACTIVE";
  }

  if (
    Number(
      asset?.open_tickets_count ??
        asset?.openTicketsCount ??
        0
    ) > 0
  ) {
    return "UNDER_MAINTENANCE";
  }

  return asset?.status || "ACTIVE";
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

  const userLocations =
    user?.user_locations ||
    user?.locations;

  if (!Array.isArray(userLocations)) {
    return [];
  }

  return userLocations
    .map((entry) => {
      return (
        entry?.location_id ||
        entry?.locationId ||
        entry?.locations?.id ||
        entry?.location?.id ||
        entry?.id ||
        null
      );
    })
    .filter(Boolean)
    .map(String);
}

function normalizeAsset(asset) {
  const openTicketsCount = Number(
    asset?.open_tickets_count ??
      asset?.openTicketsCount ??
      0
  );

  return {
    ...asset,

    id:
      asset?.id ||
      "",

    organization_id:
      asset?.organization_id ||
      asset?.organizationId ||
      null,

    location_id:
      asset?.location_id ||
      asset?.locationId ||
      null,

    category_id:
      asset?.category_id ||
      asset?.categoryId ||
      null,

    asset_number:
      asset?.asset_number ||
      asset?.assetNumber ||
      asset?.asset_code ||
      asset?.assetCode ||
      null,

    serial_number:
      asset?.serial_number ||
      asset?.serialNumber ||
      null,

    location:
      asset?.location ||
      asset?.locations ||
      null,

    locations:
      asset?.locations ||
      asset?.location ||
      null,

    category:
      asset?.category ||
      asset?.categories ||
      null,

    categories:
      asset?.categories ||
      asset?.category ||
      null,

    is_active:
      asset?.is_active ??
      asset?.isActive ??
      asset?.status !== "INACTIVE",

    open_tickets_count:
      openTicketsCount,

    status:
      asset?.is_active === false
        ? "INACTIVE"
        : openTicketsCount > 0
          ? "UNDER_MAINTENANCE"
          : asset?.status || "ACTIVE",
  };
}

function addRelations(
  asset,
  locations,
  categories
) {
  const normalizedAsset =
    normalizeAsset(asset);

  const location =
    locations.find(
      (item) =>
        String(item.id) ===
        String(
          normalizedAsset.location_id
        )
    ) ||
    normalizedAsset.location ||
    normalizedAsset.locations ||
    null;

  const category =
    categories.find(
      (item) =>
        String(item.id) ===
        String(
          normalizedAsset.category_id
        )
    ) ||
    normalizedAsset.category ||
    normalizedAsset.categories ||
    null;

  return {
    ...normalizedAsset,
    location,
    locations: location,
    category,
    categories: category,
  };
}

function readStoredAssets() {
  try {
    const storedValue =
      localStorage.getItem(
        ASSETS_STORAGE_KEY
      );

    if (!storedValue) {
      localStorage.setItem(
        ASSETS_STORAGE_KEY,
        JSON.stringify(DEMO_ASSETS)
      );

      return DEMO_ASSETS;
    }

    const parsedValue =
      JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : DEMO_ASSETS;
  } catch {
    return DEMO_ASSETS;
  }
}

function saveStoredAssets(assets) {
  try {
    localStorage.setItem(
      ASSETS_STORAGE_KEY,
      JSON.stringify(assets)
    );

    return true;
  } catch {
    return false;
  }
}

async function attachOpenTicketCounts(assets) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return assets || [];
  }

  const assetIds = assets
    .map((asset) => asset.id)
    .filter(Boolean);

  if (assetIds.length === 0) {
    return assets;
  }

  const { data, error } =
    await requireSupabase()
      .from("tickets")
      .select("asset_id,status")
      .in("asset_id", assetIds)
      .in("status", OPEN_TICKET_STATUSES);

  if (error) {
    return assets.map(normalizeAsset);
  }

  const tickets = data || [];

  return assets.map((asset) => {
    const openTicketsCount =
      tickets.filter(
        (ticket) =>
          String(ticket.asset_id) ===
          String(asset.id)
      ).length;

    return normalizeAsset({
      ...asset,
      open_tickets_count:
        openTicketsCount,
    });
  });
}

/* ==================================================
   الصفحة
================================================== */

export default function AssetsPage() {
  const {
    user,
    role: authRole,
    organizationId,
    isPlatformAdmin,
    isDemo,
    can,
  } = useAuth();

  const role = normalizeRole(
    authRole || user?.role
  );

  const canManageAssets =
    isPlatformAdmin ||
    can("assets:manage") ||
    [
      "ORGANIZATION_ADMIN",
      "BRANCH_MANAGER",
      "INVENTORY_MANAGER",
    ].includes(role);

  const allowedLocationIds =
    useMemo(
      () => getUserLocationIds(user),
      [user]
    );

  const [assets, setAssets] =
    useState([]);

  const [locations, setLocations] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [
    locationFilter,
    setLocationFilter,
  ] = useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [formMode, setFormMode] =
    useState(null);

  const [
    selectedAsset,
    setSelectedAsset,
  ] = useState(null);

  const [qrAsset, setQrAsset] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    generatingQr,
    setGeneratingQr,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [formError, setFormError] =
    useState("");

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
            const storedAssets =
              readStoredAssets();

            const scopedLocations =
              allowedLocationIds.length > 0
                ? DEMO_LOCATIONS.filter(
                    (location) =>
                      allowedLocationIds.includes(
                        String(location.id)
                      )
                  )
                : DEMO_LOCATIONS;

            const scopedLocationIds =
              scopedLocations.map(
                (location) =>
                  String(location.id)
              );

            const scopedAssets =
              storedAssets.filter(
                (asset) =>
                  scopedLocationIds.includes(
                    String(
                      asset.location_id ||
                        asset.locationId
                    )
                  )
              );

            setLocations(scopedLocations);
            setCategories(DEMO_CATEGORIES);

            setAssets(
              scopedAssets.map((asset) =>
                addRelations(
                  asset,
                  DEMO_LOCATIONS,
                  DEMO_CATEGORIES
                )
              )
            );

            return;
          }

          let locationsQuery =
            requireSupabase()
              .from("locations")
              .select(
                `
                  id,
                  organization_id,
                  name,
                  address,
                  is_active
                `
              )
              .eq("is_active", true)
              .order("name");

          let categoriesQuery =
            requireSupabase()
              .from("categories")
              .select(
                `
                  id,
                  organization_id,
                  name,
                  is_active
                `
              )
              .eq("is_active", true)
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

            categoriesQuery =
              categoriesQuery.eq(
                "organization_id",
                organizationId
              );
          }

          const [
            assetsResult,
            locationsResult,
            categoriesResult,
          ] = await Promise.all([
            listAssets({
              organizationId:
                isPlatformAdmin
                  ? null
                  : organizationId,
            }),

            locationsQuery,
            categoriesQuery,
          ]);

          if (locationsResult.error) {
            throw locationsResult.error;
          }

          if (categoriesResult.error) {
            throw categoriesResult.error;
          }

          let loadedLocations =
            locationsResult.data || [];

          const loadedCategories =
            categoriesResult.data || [];

          if (
            allowedLocationIds.length > 0
          ) {
            loadedLocations =
              loadedLocations.filter(
                (location) =>
                  allowedLocationIds.includes(
                    String(location.id)
                  )
              );
          }

          const scopedLocationIds =
            loadedLocations.map(
              (location) =>
                String(location.id)
            );

          let loadedAssets =
            assetsResult || [];

          if (
            allowedLocationIds.length > 0
          ) {
            loadedAssets =
              loadedAssets.filter(
                (asset) =>
                  scopedLocationIds.includes(
                    String(
                      asset.location_id ||
                        asset.locationId
                    )
                  )
              );
          }

          loadedAssets =
            await attachOpenTicketCounts(
              loadedAssets
            );

          setLocations(
            loadedLocations
          );

          setCategories(
            loadedCategories
          );

          setAssets(
            loadedAssets.map(
              (asset) =>
                addRelations(
                  asset,
                  loadedLocations,
                  loadedCategories
                )
            )
          );
        } catch (loadError) {
          setAssets([]);
          setLocations([]);
          setCategories([]);

          setError(
            loadError instanceof Error
              ? loadError.message
              : "تعذر تحميل بيانات الأجهزة."
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
        allowedLocationIds,
      ]
    );

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  /* ==================================================
     تصفية الأجهزة
  ================================================== */

  const filteredAssets =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(search);

      return assets.filter(
        (asset) => {
          const matchesSearch =
            !normalizedSearch ||
            [
              asset.name,
              asset.asset_number,
              asset.serial_number,
              getLocationName(asset),
              getCategoryName(asset),
            ].some((value) =>
              normalizeText(
                value
              ).includes(
                normalizedSearch
              )
            );

          const matchesLocation =
            !locationFilter ||
            String(
              asset.location_id ||
                ""
            ) ===
              String(
                locationFilter
              );

          const matchesCategory =
            !categoryFilter ||
            String(
              asset.category_id ||
                ""
            ) ===
              String(
                categoryFilter
              );

          const matchesStatus =
            !statusFilter ||
            getAssetStatus(asset) ===
              statusFilter;

          return (
            matchesSearch &&
            matchesLocation &&
            matchesCategory &&
            matchesStatus
          );
        }
      );
    }, [
      assets,
      search,
      locationFilter,
      categoryFilter,
      statusFilter,
    ]);

  /* ==================================================
     الإحصاءات
  ================================================== */

  const statistics =
    useMemo(() => {
      return {
        total:
          assets.length,

        active:
          assets.filter(
            (asset) =>
              getAssetStatus(asset) ===
              "ACTIVE"
          ).length,

        maintenance:
          assets.filter(
            (asset) =>
              getAssetStatus(asset) ===
              "UNDER_MAINTENANCE"
          ).length,

        inactive:
          assets.filter(
            (asset) =>
              getAssetStatus(asset) ===
              "INACTIVE"
          ).length,

        openTickets:
          assets.reduce(
            (total, asset) =>
              total +
              Number(
                asset.open_tickets_count ||
                  0
              ),
            0
          ),
      };
    }, [assets]);

  const hasFilters = Boolean(
    search ||
      locationFilter ||
      categoryFilter ||
      statusFilter
  );

  /* ==================================================
     فتح وإغلاق النوافذ
  ================================================== */

  function openCreateForm() {
    if (!canManageAssets) {
      setError(
        "لا تملكين صلاحية إضافة الأجهزة."
      );

      return;
    }

    setSelectedAsset(null);
    setFormMode("create");
    setFormError("");
    setSuccessMessage("");
  }

  function openEditForm(asset) {
    if (!canManageAssets) {
      return;
    }

    setSelectedAsset(asset);
    setFormMode("edit");
    setFormError("");
    setSuccessMessage("");
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormMode(null);
    setSelectedAsset(null);
    setFormError("");
  }

  function closeQrModal() {
    if (generatingQr) {
      return;
    }

    setQrAsset(null);
  }

  /* ==================================================
     حفظ الجهاز
  ================================================== */

  async function handleSaveAsset(
    formValues
  ) {
    if (saving) {
      return;
    }

    const selectedLocation =
      locations.find(
        (location) =>
          String(location.id) ===
          String(
            formValues.locationId
          )
      );

    if (!selectedLocation) {
      setFormError(
        "الموقع المحدد غير موجود."
      );

      return;
    }

    const targetOrganizationId =
      selectedLocation.organization_id ||
      organizationId ||
      selectedAsset?.organization_id ||
      null;

    if (!targetOrganizationId) {
      setFormError(
        "تعذر تحديد المنشأة التابعة للموقع."
      );

      return;
    }

    const duplicateAssetNumber =
      assets.some((asset) => {
        const currentNumber =
          normalizeText(
            asset.asset_number
          );

        const nextNumber =
          normalizeText(
            formValues.assetNumber
          );

        return (
          currentNumber &&
          nextNumber &&
          currentNumber ===
            nextNumber &&
          String(asset.id) !==
            String(
              selectedAsset?.id ||
                ""
            )
        );
      });

    if (duplicateAssetNumber) {
      setFormError(
        "الرقم الداخلي مستخدم لجهاز آخر."
      );

      return;
    }

    setSaving(true);
    setFormError("");
    setError("");
    setSuccessMessage("");

    try {
      const selectedCategory =
        categories.find(
          (category) =>
            String(category.id) ===
            String(
              formValues.categoryId
            )
        ) || null;

      let savedAsset;

      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const currentAssets =
          readStoredAssets().map(
            normalizeAsset
          );

        if (
          formMode === "edit" &&
          selectedAsset
        ) {
          savedAsset = {
            ...selectedAsset,

            organization_id:
              targetOrganizationId,

            name:
              formValues.name,

            asset_number:
              formValues.assetNumber ||
              null,

            serial_number:
              formValues.serialNumber ||
              null,

            location_id:
              formValues.locationId,

            category_id:
              formValues.categoryId ||
              null,

            location:
              selectedLocation,

            locations:
              selectedLocation,

            category:
              selectedCategory,

            categories:
              selectedCategory,

            is_active:
              formValues.isActive,

            status:
              formValues.isActive
                ? Number(
                    selectedAsset.open_tickets_count ||
                      0
                  ) > 0
                  ? "UNDER_MAINTENANCE"
                  : "ACTIVE"
                : "INACTIVE",

            updated_at:
              new Date().toISOString(),
          };

          const nextAssets =
            currentAssets.map(
              (asset) =>
                String(asset.id) ===
                String(
                  selectedAsset.id
                )
                  ? savedAsset
                  : asset
            );

          saveStoredAssets(nextAssets);
        } else {
          savedAsset = {
            id:
              createId("asset"),

            organization_id:
              targetOrganizationId,

            name:
              formValues.name,

            asset_number:
              formValues.assetNumber ||
              `AST-${String(
                currentAssets.length + 1
              ).padStart(4, "0")}`,

            serial_number:
              formValues.serialNumber ||
              null,

            location_id:
              formValues.locationId,

            category_id:
              formValues.categoryId ||
              null,

            location:
              selectedLocation,

            locations:
              selectedLocation,

            category:
              selectedCategory,

            categories:
              selectedCategory,

            is_active:
              formValues.isActive,

            status:
              formValues.isActive
                ? "ACTIVE"
                : "INACTIVE",

            open_tickets_count: 0,

            qr_token:
              createId("qr"),

            created_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          };

          saveStoredAssets([
            savedAsset,
            ...currentAssets,
          ]);
        }
      } else if (
        formMode === "edit" &&
        selectedAsset
      ) {
        const result =
          await updateAsset(
            selectedAsset.id,
            {
              ...formValues,

              organizationId:
                targetOrganizationId,
            }
          );

        savedAsset = {
          ...selectedAsset,
          ...result,

          qr_token:
            selectedAsset.qr_token ||
            selectedAsset.qrToken ||
            null,
        };
      } else {
        const result =
          await createAsset({
            ...formValues,

            organizationId:
              targetOrganizationId,

            createdBy:
              user?.id || null,
          });

        savedAsset = {
          ...(result?.asset ||
            result),

          qr_token:
            result?.qrToken ||
            result?.asset?.qr_token ||
            null,
        };
      }

      closeForm();

      setSuccessMessage(
        formMode === "edit"
          ? "تم تحديث بيانات الجهاز بنجاح."
          : "تمت إضافة الجهاز وإنشاء رمز QR الخاص به."
      );

      await loadPageData({
        silent: true,
      });

      if (
        formMode === "create" &&
        savedAsset?.qr_token
      ) {
        setQrAsset(
          addRelations(
            savedAsset,
            locations,
            categories
          )
        );
      }
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "تعذر حفظ بيانات الجهاز."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==================================================
     عرض وإنشاء رمز QR
  ================================================== */

  async function handleShowQr(asset) {
    setError("");
    setSuccessMessage("");
    setQrAsset(asset);
    if (!isSupabaseConfigured || asset?.qr_token || asset?.qrToken) return;
    setGeneratingQr(true);
    try {
      const qrToken = await getAssetQrToken(asset.id);
      setQrAsset({ ...asset, qr_token: qrToken, qrToken });
    } catch (qrError) {
      setError(
        qrError instanceof Error
          ? qrError.message
          : "تعذر استرجاع رمز QR الحالي."
      );
    } finally {
      setGeneratingQr(false);
    }
  }

  async function handleRegenerateQr() {
    if (
      !qrAsset?.id ||
      generatingQr
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "سيتم إنشاء رمز QR جديد، ولن يعمل الرمز القديم بعد ذلك. هل تريدين المتابعة؟"
      );

    if (!confirmed) {
      return;
    }

    setGeneratingQr(true);
    setError("");

    try {
      let updatedAsset;

      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const newToken =
          createId("qr");

        updatedAsset = {
          ...qrAsset,
          qr_token:
            newToken,
          updated_at:
            new Date().toISOString(),
        };

        const currentAssets =
          readStoredAssets();

        const nextAssets =
          currentAssets.map(
            (asset) =>
              String(asset.id) ===
              String(qrAsset.id)
                ? updatedAsset
                : asset
          );

        saveStoredAssets(nextAssets);
      } else {
        const result =
          await regenerateAssetQr(
            qrAsset.id
          );

        updatedAsset = {
          ...qrAsset,
          ...(result?.asset || {}),

          qr_token:
            result?.qrToken ||
            result?.asset?.qr_token ||
            null,
        };
      }

      setQrAsset(updatedAsset);

      setAssets((current) =>
        current.map((asset) =>
          String(asset.id) ===
          String(updatedAsset.id)
            ? {
                ...asset,
                ...updatedAsset,
              }
            : asset
        )
      );

      setSuccessMessage(
        "تم إنشاء رمز QR جديد للجهاز."
      );
    } catch (qrError) {
      setError(
        qrError instanceof Error
          ? qrError.message
          : "تعذر إنشاء رمز QR جديد."
      );
    } finally {
      setGeneratingQr(false);
    }
  }

  /* ==================================================
     إعادة تعيين الفلاتر
  ================================================== */

  function resetFilters() {
    setSearch("");
    setLocationFilter("");
    setCategoryFilter("");
    setStatusFilter("");
  }

  /* ==================================================
     واجهة الصفحة
  ================================================== */

  return (
    <>
      <div className="page-header">
        <div>
          <small>
            إدارة الأصول
          </small>

          <h1>
            الأصول والأجهزة
          </h1>

          <p>
            أضيفي الأجهزة وتابعي حالتها واطبعي رموز QR
            الخاصة بها.
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

          {canManageAssets ? (
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
              ＋ إضافة جهاز
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
            الأجهزة والتعديلات محفوظة محليًا داخل المتصفح.
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
              إجمالي الأجهزة
            </small>

            <strong>
              {statistics.total}
            </strong>

            <p>
              في المواقع المتاحة
            </p>
          </div>

          <span
            className="stat-icon blue-bg"
            aria-hidden="true"
          >
            ◫
          </span>
        </article>

        <article className="stat-card">
          <div>
            <small>
              أجهزة نشطة
            </small>

            <strong>
              {statistics.active}
            </strong>

            <p>
              متاحة لاستقبال البلاغات
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
              تحت الصيانة
            </small>

            <strong>
              {statistics.maintenance}
            </strong>

            <p>
              مرتبطة بطلبات مفتوحة
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
              طلبات مفتوحة
            </small>

            <strong>
              {statistics.openTickets}
            </strong>

            <p>
              مرتبطة بالأجهزة
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
              ابحثي باسم الجهاز أو رقمه أو موقعه
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
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="اسم الجهاز أو الرقم الداخلي..."
              disabled={
                loading ||
                refreshing
              }
            />
          </label>

          <label>
            الموقع

            <select
              value={locationFilter}
              onChange={(event) =>
                setLocationFilter(
                  event.target.value
                )
              }
              disabled={
                loading ||
                refreshing
              }
            >
              <option value="">
                جميع المواقع
              </option>

              {locations.map(
                (location) => (
                  <option
                    key={location.id}
                    value={location.id}
                  >
                    {location.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            التصنيف

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              disabled={
                loading ||
                refreshing
              }
            >
              <option value="">
                جميع التصنيفات
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            الحالة

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
              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={
                      status.value ||
                      "all"
                    }
                    value={
                      status.value
                    }
                  >
                    {status.label}
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
          عرض {filteredAssets.length} من أصل {assets.length} جهازًا
        </small>
      </section>

      {/* قائمة الأجهزة */}
      {loading ? (
        <section
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fill, minmax(280px, 1fr))",

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
                  height: "290px",
                  background:
                    "#edf1f0",
                }}
              />
            )
          )}
        </section>
      ) : filteredAssets.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="◫"
            title="لا توجد أجهزة"
            description={
              hasFilters
                ? "لا توجد أجهزة مطابقة للبحث أو الفلاتر المحددة."
                : "لم تتم إضافة أجهزة إلى هذا النطاق حتى الآن."
            }
            actionLabel={
              hasFilters
                ? "إزالة الفلاتر"
                : canManageAssets
                  ? "إضافة جهاز"
                  : undefined
            }
            onAction={
              hasFilters
                ? resetFilters
                : canManageAssets
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
              "repeat(auto-fill, minmax(280px, 1fr))",

            gap: "16px",
          }}
        >
          {filteredAssets.map(
            (asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                disabled={
                  saving ||
                  generatingQr
                }
                onOpen={
                  canManageAssets
                    ? openEditForm
                    : undefined
                }
                onEdit={
                  canManageAssets
                    ? openEditForm
                    : undefined
                }
                onShowQR={
                  handleShowQr
                }
              />
            )
          )}
        </section>
      )}

      {/* نافذة إضافة وتعديل الجهاز */}
      <Modal
        open={Boolean(formMode)}
        onClose={closeForm}
        title={
          formMode === "edit"
            ? "تعديل بيانات الجهاز"
            : "إضافة جهاز جديد"
        }
        description={
          formMode === "edit"
            ? "حدّثي معلومات الجهاز وموقعه وحالته."
            : "أدخلي بيانات الجهاز لإنشاء سجل ورمز QR خاص به."
        }
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        showCloseButton={!saving}
      >
        <AssetForm
          key={`${formMode}-${selectedAsset?.id || "new"}`}
          locations={locations}
          categories={categories}
          initialValues={
            selectedAsset || {}
          }
          busy={saving}
          error={formError}
          submitText={
            formMode === "edit"
              ? "حفظ التعديلات"
              : "إضافة الجهاز"
          }
          onSubmit={
            handleSaveAsset
          }
          onCancel={closeForm}
        />
      </Modal>

      {/* نافذة رمز QR */}
      <Modal
        open={Boolean(qrAsset)}
        onClose={closeQrModal}
        title="رمز QR للجهاز"
        description="يمكن وضع الرمز على الجهاز لاستقبال بلاغات الصيانة."
        closeOnBackdrop={!generatingQr}
        closeOnEscape={!generatingQr}
        showCloseButton={!generatingQr}
      >
        {qrAsset?.qr_token ||
        qrAsset?.qrToken ? (
          <AssetQRCode
            asset={qrAsset}
            disabled={generatingQr}
            onClose={closeQrModal}
          />
        ) : (
          <section
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                border:
                  "1px solid #eadfc7",
                borderRadius: "10px",
                background: "#fff9eb",
                lineHeight: 1.9,
              }}
            >
              <strong>
                رمز QR غير متاح
              </strong>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#77694c",
                }}
              >
                لا يمكن استرجاع الرمز السري القديم. يمكنك إنشاء
                رمز جديد، وسيتوقف الرمز القديم عن العمل.
              </p>
            </div>

            <div className="modal-buttons">
              <button
                type="button"
                className="secondary"
                onClick={closeQrModal}
                disabled={generatingQr}
              >
                إغلاق
              </button>

              {canManageAssets ? (
                <button
                  type="button"
                  className="primary"
                  onClick={
                    handleRegenerateQr
                  }
                  disabled={
                    generatingQr
                  }
                >
                  {generatingQr
                    ? "جاري الإنشاء…"
                    : "إنشاء رمز QR جديد"}
                </button>
              ) : null}
            </div>
          </section>
        )}
      </Modal>
    </>
  );
}
