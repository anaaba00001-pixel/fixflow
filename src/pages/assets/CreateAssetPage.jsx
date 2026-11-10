import { useEffect, useMemo, useState } from "react";

import AssetForm from "../../components/assets/AssetForm";
import AssetQRCode from "../../components/assets/AssetQRCode";
import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";

import useAuth from "../../hooks/useAuth";
import { readLocalLocations } from "../../lib/localData";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import { navigate } from "../../routes/AppRouter";
import { createAsset } from "../../services/assetService";

const STORAGE_KEY = "fixflow_assets";

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
    id: "category-plumbing",
    organization_id: "demo-organization",
    name: "سباكة",
    is_active: true,
  },
  {
    id: "category-office",
    organization_id: "demo-organization",
    name: "معدات مكتبية",
    is_active: true,
  },
];

function createId(prefix) {
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

function normalizeRole(value) {
  return String(value || "")
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
    .map((item) => {
      return (
        item?.location_id ||
        item?.locationId ||
        item?.locations?.id ||
        item?.location?.id ||
        item?.id ||
        null
      );
    })
    .filter(Boolean)
    .map(String);
}

function readStoredAssets() {
  try {
    const storedValue =
      localStorage.getItem(STORAGE_KEY);

    const parsedValue = storedValue
      ? JSON.parse(storedValue)
      : [];

    return Array.isArray(parsedValue)
      ? parsedValue
      : [];
  } catch {
    return [];
  }
}

function saveStoredAssets(assets) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(assets)
  );
}

function addRelations(
  asset,
  locations,
  categories
) {
  const location =
    locations.find((item) => {
      return (
        String(item.id) ===
        String(
          asset?.location_id ||
            asset?.locationId ||
            ""
        )
      );
    }) ||
    asset?.location ||
    asset?.locations ||
    null;

  const category =
    categories.find((item) => {
      return (
        String(item.id) ===
        String(
          asset?.category_id ||
            asset?.categoryId ||
            ""
        )
      );
    }) ||
    asset?.category ||
    asset?.categories ||
    null;

  return {
    ...asset,
    location,
    locations: location,
    category,
    categories: category,
  };
}

export default function CreateAssetPage() {
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

  const canCreateAsset =
    isPlatformAdmin ||
    can("assets:manage") ||
    [
      "ORGANIZATION_ADMIN",
      "BRANCH_MANAGER",
      "INVENTORY_MANAGER",
    ].includes(role);

  const allowedLocationIds = useMemo(
    () => getUserLocationIds(user),
    [user]
  );

  const [locations, setLocations] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [createdAsset, setCreatedAsset] =
    useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      setLoading(true);
      setError("");

      try {
        if (
          isDemo ||
          !isSupabaseConfigured
        ) {
          const storedLocations = readLocalLocations();
          const scopedLocations =
            allowedLocationIds.length > 0
              ? storedLocations.filter(
                  (location) =>
                    allowedLocationIds.includes(
                      String(location.id)
                    )
                )
              : storedLocations;

          if (!cancelled) {
            setLocations(
              scopedLocations
            );

            setCategories(
              DEMO_CATEGORIES
            );
          }

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
          locationsResult,
          categoriesResult,
        ] = await Promise.all([
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

        const organizationIds =
          new Set(
            loadedLocations
              .map(
                (location) =>
                  location.organization_id
              )
              .filter(Boolean)
          );

        const loadedCategories =
          (
            categoriesResult.data ||
            []
          ).filter((category) => {
            return (
              organizationIds.size ===
                0 ||
              organizationIds.has(
                category.organization_id
              )
            );
          });

        if (!cancelled) {
          setLocations(
            loadedLocations
          );

          setCategories(
            loadedCategories
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setLocations([]);
          setCategories([]);

          setError(
            loadError instanceof Error
              ? loadError.message
              : "تعذر تحميل المواقع والتصنيفات."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [
    isDemo,
    isPlatformAdmin,
    organizationId,
    allowedLocationIds,
  ]);

  function handleCancel() {
    if (!saving) {
      navigate("/assets");
    }
  }

  async function handleCreateAsset(
    formValues
  ) {
    if (saving) {
      return;
    }

    const selectedLocation =
      locations.find((location) => {
        return (
          String(location.id) ===
          String(
            formValues.locationId
          )
        );
      });

    if (!selectedLocation) {
      setError(
        "الموقع المحدد غير موجود أو غير مسموح لك باستخدامه."
      );

      return;
    }

    const targetOrganizationId =
      selectedLocation.organization_id ||
      organizationId ||
      null;

    if (!targetOrganizationId) {
      setError(
        "تعذر تحديد المنشأة التابعة للموقع."
      );

      return;
    }

    const selectedCategory =
      formValues.categoryId
        ? categories.find(
            (category) => {
              return (
                String(category.id) ===
                String(
                  formValues.categoryId
                )
              );
            }
          )
        : null;

    if (
      formValues.categoryId &&
      !selectedCategory
    ) {
      setError(
        "التصنيف المحدد غير موجود."
      );

      return;
    }

    if (
      selectedCategory?.organization_id &&
      String(
        selectedCategory.organization_id
      ) !==
        String(
          targetOrganizationId
        )
    ) {
      setError(
        "يجب أن يتبع التصنيف والموقع المنشأة نفسها."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      let finalAsset;

      if (
        isDemo ||
        !isSupabaseConfigured
      ) {
        const storedAssets =
          readStoredAssets();

        const duplicateAssetNumber =
          storedAssets.some(
            (asset) => {
              return (
                formValues.assetNumber &&
                normalizeText(
                  asset.asset_number ||
                    asset.assetNumber
                ) ===
                  normalizeText(
                    formValues.assetNumber
                  ) &&
                String(
                  asset.organization_id ||
                    asset.organizationId ||
                    ""
                ) ===
                  String(
                    targetOrganizationId
                  )
              );
            }
          );

        if (duplicateAssetNumber) {
          throw new Error(
            "الرقم الداخلي مستخدم لجهاز آخر داخل المنشأة."
          );
        }

        const duplicateSerialNumber =
          storedAssets.some(
            (asset) => {
              return (
                formValues.serialNumber &&
                normalizeText(
                  asset.serial_number ||
                    asset.serialNumber
                ) ===
                  normalizeText(
                    formValues.serialNumber
                  )
              );
            }
          );

        if (
          duplicateSerialNumber
        ) {
          throw new Error(
            "الرقم التسلسلي مستخدم لجهاز آخر."
          );
        }

        finalAsset = addRelations(
          {
            id: createId("asset"),

            organization_id:
              targetOrganizationId,

            location_id:
              formValues.locationId,

            category_id:
              formValues.categoryId ||
              null,

            name:
              formValues.name,

            asset_number:
              formValues.assetNumber ||
              `AST-${String(
                storedAssets.length +
                  1
              ).padStart(4, "0")}`,

            serial_number:
              formValues.serialNumber ||
              null,

            is_active:
              formValues.isActive,

            status:
              formValues.isActive
                ? "ACTIVE"
                : "INACTIVE",

            open_tickets_count: 0,

            qr_token:
              createId("qr"),

            created_by:
              user?.id || null,

            created_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          },
          locations,
          categories
        );

        saveStoredAssets([
          finalAsset,
          ...storedAssets,
        ]);
      } else {
        const result =
          await createAsset({
            ...formValues,

            organizationId:
              targetOrganizationId,

            createdBy:
              user?.id || null,
          });

        const createdRecord =
          result?.asset || result;

        const qrToken =
          result?.qrToken ||
          result?.qr_token ||
          createdRecord?.qr_token ||
          null;

        finalAsset = addRelations(
          {
            ...createdRecord,
            qr_token: qrToken,
          },
          locations,
          categories
        );
      }

      setCreatedAsset(
        finalAsset
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "تعذر إنشاء الجهاز."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleFinish() {
    setCreatedAsset(null);
    navigate("/assets");
  }

  if (!canCreateAsset) {
    return (
      <section className="panel">
        <EmptyState
          icon="!"
          title="لا تملك صلاحية إضافة جهاز"
          description="هذه الصفحة متاحة للحسابات المخولة بإدارة الأصول."
          actionLabel="العودة إلى الأجهزة"
          onAction={() =>
            navigate("/assets")
          }
        />
      </section>
    );
  }

  if (loading) {
    return (
      <section
        className="panel"
        role="status"
        aria-live="polite"
        style={{
          display: "grid",
          gap: "12px",
          padding: "24px",
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
          جاري تحميل بيانات الجهاز…
        </span>
      </section>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <small>
            إدارة الأصول
          </small>

          <h1>
            إضافة جهاز جديد
          </h1>

          <p>
            أدخلي معلومات الجهاز لإنشاء سجل ورمز QR خاص
            باستقبال بلاغات الصيانة.
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={handleCancel}
          disabled={saving}
        >
          العودة إلى الأجهزة
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
            سيتم حفظ الجهاز داخل المتصفح فقط.
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

      <section
        className="content-grid"
        style={{
          gridTemplateColumns:
            "minmax(0, 1.4fr) minmax(260px, .6fr)",
        }}
      >
        <article
          className="panel"
          style={{
            padding: "22px",
          }}
        >
          <div
            className="panel-head"
            style={{
              padding:
                "0 0 20px",
            }}
          >
            <div>
              <h2>
                بيانات الجهاز
              </h2>

              <p>
                حددي الموقع ثم أدخلي بيانات الجهاز الأساسية.
              </p>
            </div>
          </div>

          {locations.length ===
          0 ? (
            <EmptyState
              icon="⌂"
              title="لا توجد مواقع متاحة"
              description="أضيفي موقعًا نشطًا أو اربطي حسابك بفرع قبل إنشاء الجهاز."
              actionLabel="العودة إلى الأجهزة"
              onAction={() =>
                navigate("/assets")
              }
            />
          ) : (
            <AssetForm
              locations={
                locations
              }
              categories={
                categories
              }
              busy={saving}
              error=""
              submitText="إنشاء الجهاز"
              onSubmit={
                handleCreateAsset
              }
              onCancel={
                handleCancel
              }
            />
          )}
        </article>

        <aside className="side-column">
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "14px",
              padding: "20px",
            }}
          >
            <span
              className="stat-icon green-bg"
              aria-hidden="true"
            >
              QR
            </span>

            <div>
              <h2
                style={{
                  margin:
                    "0 0 7px",

                  fontSize:
                    "14px",
                }}
              >
                رمز QR تلقائي
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#71817f",
                  fontSize:
                    "10px",
                  lineHeight:
                    1.8,
                }}
              >
                بعد إنشاء الجهاز سيصدر النظام رمز QR يمكن
                طباعته ووضعه على الجهاز.
              </p>
            </div>
          </article>

          <article
            className="panel"
            style={{
              display: "grid",
              gap: "13px",
              padding: "20px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize:
                  "13px",
              }}
            >
              نصائح لإضافة الجهاز
            </h2>

            <div
              style={{
                display: "grid",
                gap: "11px",
                color:
                  "#60716e",
                fontSize:
                  "9px",
                lineHeight:
                  1.8,
              }}
            >
              <span>
                ✓ استخدمي اسمًا واضحًا يحدد الجهاز ومكانه.
              </span>

              <span>
                ✓ أضيفي الرقم الداخلي لتسهيل البحث.
              </span>

              <span>
                ✓ تأكدي من اختيار الموقع الصحيح.
              </span>

              <span>
                ✓ أدخلي الرقم التسلسلي عند توفره.
              </span>
            </div>
          </article>
        </aside>
      </section>

      <Modal
        open={Boolean(
          createdAsset
        )}
        onClose={
          handleFinish
        }
        title="تم إنشاء الجهاز بنجاح"
        description="يمكنك الآن تنزيل رمز QR أو طباعته ووضعه على الجهاز."
        closeOnBackdrop={
          !saving
        }
        closeOnEscape={
          !saving
        }
        showCloseButton={
          !saving
        }
      >
        {createdAsset ? (
          <AssetQRCode
            asset={
              createdAsset
            }
            disabled={
              saving
            }
            onClose={
              handleFinish
            }
          />
        ) : null}
      </Modal>
    </>
  );
}
