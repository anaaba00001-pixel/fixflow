import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/common/EmptyState";
import CreateTicketForm from "../../components/forms/CreateTicketForm";

import { isSupabaseConfigured } from "../../lib/supabase";
import { navigate } from "../../routes/AppRouter";
import { createPublicTicket } from "../../services/ticketService";

/* ==================================================
   بيانات الوضع التجريبي
================================================== */

const DEMO_ASSET = {
  id: "demo-asset",
  name: "مكيف غرفة الاجتماعات",
  asset_number: "AC-RYD-001",
  serial_number: "SN-AC-458921",
  location_id: "demo-location",
  category_id: "demo-category-ac",
  is_active: true,

  location: {
    id: "demo-location",
    name: "فرع الرياض",
  },

  category: {
    id: "demo-category-ac",
    name: "تكييف وتبريد",
  },
};

const DEMO_QR_TOKEN = "demo-asset-qr";

const DEMO_CATEGORIES = [
  {
    id: "demo-category-ac",
    name: "تكييف وتبريد",
    is_active: true,
  },
  {
    id: "demo-category-electric",
    name: "كهرباء وإنارة",
    is_active: true,
  },
  {
    id: "demo-category-plumbing",
    name: "سباكة",
    is_active: true,
  },
  {
    id: "demo-category-general",
    name: "صيانة عامة",
    is_active: true,
  },
];

const DEMO_TICKETS_STORAGE_KEY =
  "fixflow_public_tickets";

/* ==================================================
   دوال مساعدة
================================================== */

function createToken(prefix) {
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

  const number = String(
    Math.floor(Math.random() * 90000) + 10000
  );

  return `MT-${year}-${number}`;
}

function getAssetLocation(asset) {
  return (
    asset?.location ||
    asset?.locations || {
      id: asset?.location_id,
      name:
        asset?.location_name ||
        "موقع غير محدد",
    }
  );
}

function getAssetCategory(asset) {
  return (
    asset?.category ||
    asset?.categories ||
    null
  );
}

function readDemoTickets() {
  try {
    const storedValue =
      localStorage.getItem(
        DEMO_TICKETS_STORAGE_KEY
      );

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

function saveDemoTicket(ticket) {
  const tickets = readDemoTickets();

  localStorage.setItem(
    DEMO_TICKETS_STORAGE_KEY,
    JSON.stringify([
      ticket,
      ...tickets,
    ])
  );
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }

      const reader =
        new FileReader();

      reader.onload = () => {
        const result = String(
          reader.result || ""
        );

        const base64 =
          result.includes(",")
            ? result.split(",")[1]
            : result;

        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
        });
      };

      reader.onerror = () => {
        reject(
          new Error(
            "تعذر قراءة الصورة المرفقة."
          )
        );
      };

      reader.readAsDataURL(file);
    }
  );
}

function getErrorMessage(error) {
  const message = String(
    error?.message ||
      error?.details ||
      ""
  ).toUpperCase();

  if (
    message.includes(
      "ASSET_INACTIVE"
    )
  ) {
    return "هذا الجهاز غير نشط ولا يستقبل بلاغات صيانة حاليًا.";
  }

  if (
    message.includes(
      "ASSET_NOT_FOUND"
    ) ||
    message.includes(
      "INVALID_QR"
    )
  ) {
    return "رمز QR غير صالح أو أن الجهاز غير موجود.";
  }

  if (
    message.includes(
      "DUPLICATE"
    )
  ) {
    return "يوجد بلاغ مفتوح مشابه لهذا الجهاز. راجعي بيانات المشكلة.";
  }

  if (
    message.includes(
      "INVALID_EMAIL"
    )
  ) {
    return "صيغة البريد الإلكتروني غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_PRIORITY"
    )
  ) {
    return "أولوية البلاغ غير صحيحة.";
  }

  if (
    message.includes(
      "RATE"
    ) ||
    message.includes(
      "TOO MANY"
    )
  ) {
    return "تم إرسال عدة بلاغات خلال وقت قصير. انتظري قليلًا ثم حاولي مرة أخرى.";
  }

  if (
    message.includes(
      "FUNCTION"
    ) ||
    message.includes(
      "NOT FOUND"
    )
  ) {
    return "خدمة البلاغات العامة غير متاحة حاليًا. تأكدي من نشر دالة public-ticket في Supabase.";
  }

  return error instanceof Error
    ? error.message
    : "حدث خطأ غير متوقع.";
}

/* ==================================================
   صفحة إنشاء البلاغ العام
================================================== */

export default function CreateRequestPage({
  token = "",
}) {
  const [asset, setAsset] =
    useState(null);

  const [categories, setCategories] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [pageError, setPageError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [
    privacyAccepted,
    setPrivacyAccepted,
  ] = useState(false);

  const [
    createdTicket,
    setCreatedTicket,
  ] = useState(null);

  const [
    copied,
    setCopied,
  ] = useState(false);

  /* ==================================================
     تحميل الجهاز من رمز QR
  ================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadAsset() {
      setLoading(true);
      setPageError("");

      const normalizedToken =
        String(token || "").trim();

      if (!normalizedToken) {
        setPageError(
          "رابط الإبلاغ غير مكتمل أو رمز الجهاز مفقود."
        );

        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured) {
        if (normalizedToken !== DEMO_QR_TOKEN) {
          if (!cancelled) {
            setPageError(
              "رمز QR غير معروف في الوضع التجريبي. استخدم demo-asset-qr فقط للعرض المحلي."
            );
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setAsset(DEMO_ASSET);

          setCategories(
            DEMO_CATEGORIES
          );

          setLoading(false);
        }

        return;
      }

      try {
        const result =
          await createPublicTicket({
            action:
              "resolve_asset",

            qrToken:
              normalizedToken,
          });

        const resolvedAsset =
          result?.asset ||
          result?.data?.asset ||
          null;

        if (!resolvedAsset) {
          throw new Error(
            "ASSET_NOT_FOUND"
          );
        }

        if (
          resolvedAsset.is_active ===
          false
        ) {
          throw new Error(
            "ASSET_INACTIVE"
          );
        }

        if (!cancelled) {
          setAsset(
            resolvedAsset
          );

          setCategories(
            result?.categories ||
              result?.data
                ?.categories ||
              []
          );
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setPageError(
          getErrorMessage(
            loadError
          )
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAsset();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ==================================================
     بيانات الجهاز
  ================================================== */

  const location = useMemo(
    () =>
      getAssetLocation(asset),
    [asset]
  );

  const assetCategory =
    useMemo(
      () =>
        getAssetCategory(asset),
      [asset]
    );

  const availableCategories =
    useMemo(() => {
      const activeCategories =
        categories.filter(
          (category) =>
            category.is_active !==
            false
        );

      if (
        activeCategories.length > 0
      ) {
        return activeCategories;
      }

      if (assetCategory) {
        return [
          assetCategory,
        ];
      }

      return DEMO_CATEGORIES;
    }, [
      categories,
      assetCategory,
    ]);

  const trackingToken =
    createdTicket
      ?.tracking_token ||
    createdTicket
      ?.trackingToken ||
    "";

  const ticketNumber =
    createdTicket
      ?.ticket_number ||
    createdTicket
      ?.ticketNumber ||
    "—";

  /* ==================================================
     إرسال البلاغ
  ================================================== */

  async function handleSubmit(
    payload
  ) {
    if (!privacyAccepted) {
      setFormError(
        "يجب الموافقة على استخدام بيانات التواصل قبل إرسال البلاغ."
      );

      return;
    }

    if (
      !asset ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setFormError("");
    setCopied(false);

    try {
      const attachment =
        await fileToBase64(
          payload.attachment
        );

      const requestPayload = {
        action: "create",

        qrToken:
          String(token).trim(),

        assetId:
          asset.id,

        locationId:
          location?.id ||
          asset.location_id,

        categoryId:
          payload.categoryId ||
          asset.category_id ||
          assetCategory?.id ||
          null,

        title:
          payload.title,

        description:
          payload.description,

        priority:
          payload.priority,

        reporterName:
          payload.reporterName ||
          null,

        reporterPhone:
          payload.reporterPhone ||
          null,

        reporterEmail:
          payload.reporterEmail ||
          null,

        reporterContact:
          payload.reporterPhone ||
          payload.reporterEmail ||
          null,

        attachment,
      };

      if (
        !isSupabaseConfigured
      ) {
        const demoTrackingToken =
          createToken("track");

        const category =
          availableCategories.find(
            (item) =>
              String(item.id) ===
              String(
                requestPayload.categoryId
              )
          );

        const demoTicket = {
          id:
            createToken(
              "ticket"
            ),

          ticket_number:
            createDemoTicketNumber(),

          tracking_token:
            demoTrackingToken,

          organization_id:
            "demo-organization",

          asset_id:
            asset.id,

          asset_name:
            asset.name,

          asset_number:
            asset.asset_number,

          location_id:
            location?.id,

          location_name:
            location?.name,

          category_id:
            requestPayload.categoryId,

          category_name:
            category?.name ||
            "صيانة عامة",

          title:
            requestPayload.title,

          description:
            requestPayload.description,

          priority:
            requestPayload.priority,

          status: "NEW",

          reporter_name:
            requestPayload.reporterName,

          reporter_phone:
            requestPayload.reporterPhone,

          reporter_email:
            requestPayload.reporterEmail,

          reporter_contact:
            requestPayload.reporterContact,

          attachment:
            attachment
              ? {
                  name:
                    attachment.name,

                  type:
                    attachment.type,

                  size:
                    attachment.size,
                }
              : null,

          created_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString(),
        };

        saveDemoTicket(
          demoTicket
        );

        setCreatedTicket(
          demoTicket
        );

        return;
      }

      const result =
        await createPublicTicket(
          requestPayload
        );

      const ticket =
        result?.ticket ||
        result?.data?.ticket ||
        result;

      if (
        !ticket
          ?.ticket_number &&
        !ticket
          ?.ticketNumber
      ) {
        throw new Error(
          "INVALID_CREATE_RESPONSE"
        );
      }

      setCreatedTicket(
        ticket
      );
    } catch (submitError) {
      setFormError(
        getErrorMessage(
          submitError
        ) ||
          "تعذر إرسال البلاغ. حاولي مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ==================================================
     متابعة الطلب
  ================================================== */

  function openTrackingPage() {
    if (!trackingToken) {
      return;
    }

    navigate(
      `/track/${encodeURIComponent(
        trackingToken
      )}`
    );
  }

  async function copyTrackingNumber() {
    try {
      await navigator.clipboard.writeText(
        ticketNumber
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        2000
      );
    } catch {
      setCopied(false);
    }
  }

  /* ==================================================
     حالة التحميل
  ================================================== */

  if (loading) {
    return (
      <section
        className="auth-card"
        role="status"
        aria-live="polite"
      >
        <span
          className="auth-icon"
          aria-hidden="true"
        >
          ◷
        </span>

        <h1>
          جاري تحميل بيانات الجهاز…
        </h1>

        <p>
          يرجى الانتظار قليلًا.
        </p>
      </section>
    );
  }

  /* ==================================================
     خطأ رمز QR
  ================================================== */

  if (
    pageError ||
    !asset
  ) {
    return (
      <section className="auth-card">
        <EmptyState
          icon="!"
          title="تعذر فتح نموذج البلاغ"
          description={
            pageError ||
            "لم نتمكن من العثور على بيانات الجهاز."
          }
          actionLabel="إعادة المحاولة"
          onAction={() =>
            window.location.reload()
          }
        />
      </section>
    );
  }

  /* ==================================================
     نجاح إنشاء البلاغ
  ================================================== */

  if (createdTicket) {
    return (
      <section className="auth-card">
        <span
          className="auth-icon"
          aria-hidden="true"
          style={{
            color: "#25805e",
            background:
              "#e4f4eb",
          }}
        >
          ✓
        </span>

        <small className="eyebrow">
          تم استلام البلاغ
        </small>

        <h1>
          تم إنشاء طلب الصيانة بنجاح
        </h1>

        <p>
          احتفظي برقم الطلب أو افتحي صفحة المتابعة لمعرفة
          آخر تحديثات الصيانة.
        </p>

        <div
          style={{
            display: "grid",
            gap: "8px",
            padding: "18px",
            border:
              "1px solid #dfe7e4",
            borderRadius:
              "12px",
            background:
              "#f5f9f7",
            textAlign:
              "center",
          }}
        >
          <small
            style={{
              color:
                "#71817f",
            }}
          >
            رقم الطلب
          </small>

          <strong
            style={{
              color:
                "#176c62",

              fontSize:
                "22px",

              direction:
                "ltr",
            }}
          >
            {ticketNumber}
          </strong>

          {copied ? (
            <small
              style={{
                color:
                  "#25805e",
              }}
              role="status"
            >
              تم نسخ رقم الطلب
            </small>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gap: "9px",
          }}
        >
          {trackingToken ? (
            <button
              type="button"
              className="primary wide"
              onClick={
                openTrackingPage
              }
            >
              متابعة حالة الطلب
            </button>
          ) : null}

          <button
            type="button"
            className="secondary wide"
            onClick={
              copyTrackingNumber
            }
          >
            {copied
              ? "تم النسخ"
              : "نسخ رقم الطلب"}
          </button>

          <button
            type="button"
            className="text-button center"
            onClick={() =>
              window.location.reload()
            }
          >
            إرسال بلاغ آخر
          </button>
        </div>
      </section>
    );
  }

  /* ==================================================
     نموذج البلاغ
  ================================================== */

  return (
    <section
      style={{
        width:
          "min(760px, 100%)",

        margin:
          "0 auto",
      }}
    >
      <div
        className="auth-card"
        style={{
          width: "100%",
          maxWidth: "none",
        }}
      >
        <small className="eyebrow">
          طلب صيانة جديد
        </small>

        <h1>
          الإبلاغ عن مشكلة
        </h1>

        <p>
          املئي البيانات التالية وسيصل البلاغ مباشرة إلى
          فريق الصيانة.
        </p>

        <article
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "13px",
            marginBottom:
              "18px",
            padding: "15px",
            border:
              "1px solid #dfe7e4",
            borderRadius:
              "11px",
            background:
              "#f5f9f7",
          }}
        >
          <span
            className="stat-icon green-bg"
            aria-hidden="true"
          >
            ⚒
          </span>

          <div
            style={{
              display: "grid",
              gap: "4px",
              minWidth: 0,
            }}
          >
            <strong>
              {asset.name}
            </strong>

            <small
              style={{
                color:
                  "#71817f",
              }}
            >
              {asset.asset_number ||
                "دون رقم داخلي"}{" "}
              ·{" "}
              {location?.name ||
                "موقع غير محدد"}
            </small>

            {assetCategory?.name ? (
              <small
                style={{
                  color:
                    "#71817f",
                }}
              >
                التصنيف:{" "}
                {
                  assetCategory.name
                }
              </small>
            ) : null}
          </div>

          <span
            className="badge green"
            style={{
              marginRight:
                "auto",
            }}
          >
            متاح للبلاغات
          </span>
        </article>

        {!isSupabaseConfigured ? (
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
              سيتم حفظ البلاغ داخل المتصفح فقط.
            </span>
          </div>
        ) : null}

        <label
          style={{
            display: "flex",
            alignItems:
              "flex-start",
            gap: "9px",
            marginBottom:
              "16px",
            padding: "12px",
            border:
              "1px solid #e3e8e6",
            borderRadius:
              "9px",
            background:
              "#fafcfb",
          }}
        >
          <input
            type="checkbox"
            checked={
              privacyAccepted
            }
            onChange={(
              event
            ) => {
              setPrivacyAccepted(
                event.target
                  .checked
              );

              setFormError("");
            }}
            disabled={
              submitting
            }
            style={{
              width: "16px",
              height: "16px",
              marginTop: "2px",
            }}
          />

          <span
            style={{
              color:
                "#5f706d",

              fontSize:
                "9px",

              lineHeight:
                1.8,
            }}
          >
            أوافق على استخدام بيانات التواصل لمتابعة هذا
            الطلب وإرسال تحديثات حالة الصيانة. لن تستخدم
            البيانات لغير متابعة البلاغ.
          </span>
        </label>

        <CreateTicketForm
          key={asset.id}
          locations={
            location
              ? [location]
              : []
          }
          assets={[
            asset,
          ]}
          categories={
            availableCategories
          }
          initialValues={{
            locationId:
              location?.id ||
              asset.location_id ||
              "",

            assetId:
              asset.id,

            categoryId:
              asset.category_id ||
              assetCategory?.id ||
              availableCategories[0]
                ?.id ||
              "",

            priority:
              "MEDIUM",
          }}
          busy={
            submitting
          }
          error={
            formError
          }
          submitText="إرسال طلب الصيانة"
          requireAsset
          showReporterFields
          requireReporterContact
          onSubmit={
            handleSubmit
          }
        />
      </div>
    </section>
  );
}
