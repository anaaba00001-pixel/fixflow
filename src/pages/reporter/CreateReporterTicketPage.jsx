import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import CreateTicketForm from "../../components/forms/CreateTicketForm";

import { useAuth } from "../../hooks/useAuth";
import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";
import { readLocalAssets, readLocalLocations } from "../../lib/localData";
import { navigate } from "../../routes/AppRouter";
import { listAssets } from "../../services/assetService";
import { listLocations } from "../../services/locationService";
import {
  createTicket,
  uploadTicketAttachment,
} from "../../services/ticketService";

const DEMO_LOCATIONS = [
  {
    id: "demo-location-riyadh",
    organization_id: "demo-organization",
    name: "فرع الرياض الرئيسي",
    address: "الرياض",
    is_active: true,
  },
  {
    id: "demo-location-north",
    organization_id: "demo-organization",
    name: "فرع الشمال",
    address: "شمال الرياض",
    is_active: true,
  },
];

const DEMO_CATEGORIES = [
  {
    id: "demo-category-ac",
    organization_id: "demo-organization",
    name: "تكييف وتبريد",
    is_active: true,
  },
  {
    id: "demo-category-electric",
    organization_id: "demo-organization",
    name: "كهرباء وإنارة",
    is_active: true,
  },
  {
    id: "demo-category-plumbing",
    organization_id: "demo-organization",
    name: "سباكة ومياه",
    is_active: true,
  },
  {
    id: "demo-category-general",
    organization_id: "demo-organization",
    name: "صيانة عامة",
    is_active: true,
  },
];

const DEMO_ASSETS = [
  {
    id: "demo-asset-ac",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-ac",
    name: "مكيف غرفة الاجتماعات",
    asset_number: "AC-RYD-001",
    is_active: true,
  },
  {
    id: "demo-asset-light",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    category_id: "demo-category-electric",
    name: "إنارة الممر الشرقي",
    asset_number: "LT-RYD-014",
    is_active: true,
  },
  {
    id: "demo-asset-sink",
    organization_id: "demo-organization",
    location_id: "demo-location-north",
    category_id: "demo-category-plumbing",
    name: "مغسلة دورة المياه",
    asset_number: "PL-NTH-007",
    is_active: true,
  },
];

function createUniqueId(prefix) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createDemoTicketNumber() {
  const year = new Date().getFullYear();
  const randomNumber = String(
    Math.floor(Math.random() * 90000) + 10000
  );

  return `MT-${year}-${randomNumber}`;
}

function readStoredTickets(storageKey) {
  try {
    const storedValue = localStorage.getItem(storageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : [];
  } catch {
    return [];
  }
}

function saveTicketToStorage(storageKey, ticket) {
  const currentTickets = readStoredTickets(storageKey);

  const ticketsWithoutDuplicate = currentTickets.filter(
    (currentTicket) =>
      String(currentTicket.id) !== String(ticket.id)
  );

  localStorage.setItem(
    storageKey,
    JSON.stringify([
      ticket,
      ...ticketsWithoutDuplicate,
    ])
  );
}

function saveDemoTicket(ticket) {
  saveTicketToStorage(
    "fixflow_reporter_tickets",
    ticket
  );

  saveTicketToStorage(
    "fixflow_tickets",
    ticket
  );
}

function getLocationName(locations, locationId) {
  return (
    locations.find(
      (location) =>
        String(location.id) === String(locationId)
    )?.name || "موقع غير محدد"
  );
}

function findById(items, itemId) {
  if (!itemId) {
    return null;
  }

  return (
    items.find(
      (item) => String(item.id) === String(itemId)
    ) || null
  );
}

export default function CreateReporterTicketPage() {
  const {
    user,
    fullName,
    email,
    organizationId,
    isRegisteredReporter,
  } = useAuth();

  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  const loadFormData = useCallback(async () => {
    if (!user || !organizationId) {
      setLocations([]);
      setAssets([]);
      setCategories([]);
      setPageError(
        "لا توجد منشأة مرتبطة بهذا الحساب."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      if (!isSupabaseConfigured) {
        setLocations(readLocalLocations());
        setAssets(readLocalAssets());
        setCategories(DEMO_CATEGORIES);
        return;
      }

      const supabase = requireSupabase();

      const [
        loadedLocations,
        loadedAssets,
        categoryResult,
      ] = await Promise.all([
        listLocations({
          organizationId,
          isActive: true,
          includeCounts: false,
        }),

        listAssets({
          organizationId,
          isActive: true,
        }),

        supabase
          .from("categories")
          .select(
            "id, organization_id, name, is_active"
          )
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (categoryResult.error) {
        throw categoryResult.error;
      }

      setLocations(loadedLocations || []);
      setAssets(loadedAssets || []);
      setCategories(categoryResult.data || []);
    } catch (error) {
      setPageError(
        error?.message ||
          "تعذر تحميل بيانات نموذج البلاغ."
      );
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const initialValues = useMemo(
    () => ({
      priority: "MEDIUM",
      reporterName:
        fullName ||
        user?.full_name ||
        user?.name ||
        "",
      reporterEmail:
        email || user?.email || "",
      reporterPhone:
        user?.phone || "",
    }),
    [fullName, email, user]
  );

  async function handleSubmit(payload) {
    if (
      submitting ||
      !user ||
      !organizationId
    ) {
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (!isSupabaseConfigured) {
        const selectedAsset = findById(
          assets,
          payload.assetId
        );

        const selectedCategory = findById(
          categories,
          payload.categoryId
        );

        const ticketId = createUniqueId("ticket");
        const ticketNumber = createDemoTicketNumber();
        const now = new Date().toISOString();

        const reporterName =
          fullName ||
          user.full_name ||
          user.name ||
          "مبلّغ مسجّل";

        const reporterEmail =
          email || user.email || "";

        const reporterPhone = user.phone || "";

        const demoTicket = {
          id: ticketId,
          organization_id: organizationId,
          ticket_number: ticketNumber,

          location_id: payload.locationId,
          location_name: getLocationName(
            locations,
            payload.locationId
          ),
          locations: {
            id: payload.locationId,
            name: getLocationName(
              locations,
              payload.locationId
            ),
          },

          asset_id: payload.assetId || null,
          asset_name:
            selectedAsset?.name || "بلاغ عام",
          assets: selectedAsset
            ? {
                id: selectedAsset.id,
                name: selectedAsset.name,
                asset_number:
                  selectedAsset.asset_number,
              }
            : null,

          category_id: payload.categoryId,
          category_name:
            selectedCategory?.name ||
            "صيانة عامة",
          categories: selectedCategory
            ? {
                id: selectedCategory.id,
                name: selectedCategory.name,
              }
            : null,

          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: "NEW",

          reporter_user_id: user.id,
          reporter_name: reporterName,
          reporter_email: reporterEmail,
          reporter_phone: reporterPhone,
          reporter_contact:
            reporterPhone || reporterEmail || null,

          created_by: user.id,
          created_at: now,
          updated_at: now,

          ticket_history: [
            {
              id: createUniqueId("history"),
              action: "CREATED",
              actor_id: user.id,
              actor_name: reporterName,
              old_status: null,
              new_status: "NEW",
              note:
                "تم إنشاء البلاغ بواسطة المبلّغ المسجّل.",
              created_at: now,
            },
          ],

          ticket_attachments: [],
        };

        saveDemoTicket(demoTicket);

        navigate(
          `/tickets/${encodeURIComponent(ticketId)}`
        );

        return;
      }

      const createdTicket = await createTicket({
        organizationId,
        locationId: payload.locationId,
        assetId: payload.assetId || null,
        categoryId: payload.categoryId,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: "NEW",

        reporterUserId: user.id,
        reporterName:
          fullName ||
          user.full_name ||
          user.name ||
          "مبلّغ مسجّل",
        reporterEmail:
          email || user.email || null,
        reporterPhone:
          user.phone || null,
        reporterContact:
          user.phone ||
          email ||
          user.email ||
          null,

        createdBy: user.id,
      });

      if (
        payload.attachment &&
        createdTicket?.id
      ) {
        await uploadTicketAttachment(
          createdTicket.id,
          payload.attachment,
          {
            attachmentType: "REPORT",
          }
        );
      }

      navigate(
        `/tickets/${encodeURIComponent(
          createdTicket.id
        )}`
      );
    } catch (error) {
      setFormError(
        error?.message ||
          "تعذر إنشاء البلاغ. حاولي مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="full-loader">
        <span />
        <p>جاري تحميل نموذج البلاغ…</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <EmptyState
        icon="!"
        title="تعذر تحميل النموذج"
        description={pageError}
        actionLabel="إعادة المحاولة"
        onAction={loadFormData}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <small>حساب المبلّغ المسجّل</small>
          <h1>إنشاء بلاغ صيانة</h1>
          <p>
            أدخل تفاصيل المشكلة، وسيتم ربط
            البلاغ بحسابك تلقائيًا.
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() => navigate("/")}
          disabled={submitting}
        >
          العودة إلى بلاغاتي
        </button>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>معلومات المشكلة</h2>
            <p>
              اختر الموقع والجهاز، ثم اكتب وصفًا
              واضحًا للعطل.
            </p>
          </div>
        </div>

        <CreateTicketForm
          locations={locations}
          assets={assets}
          categories={categories}
          initialValues={initialValues}
          busy={submitting}
          error={formError}
          submitText="إرسال البلاغ"
          requireAsset={false}
          showReporterFields={false}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/")}
          className="create-modal reporter-ticket-form"
        />
      </article>
    </>
  );
}



