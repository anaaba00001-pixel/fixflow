
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/common/EmptyState";
import TicketStatusBadge from "../../components/tickets/TicketStatusBadge";
import { isSupabaseConfigured } from "../../lib/supabase";
import { createPublicTicket } from "../../services/ticketService";
import { formatDate } from "../../utils/formatDate";

const PROGRESS_STEPS = [
  {
    key: "RECEIVED",
    label: "تم استلام الطلب",
  },
  {
    key: "ASSIGNED",
    label: "تم تعيين الفني",
  },
  {
    key: "IN_PROGRESS",
    label: "جاري العمل",
  },
  {
    key: "REPAIRED",
    label: "تم الإصلاح",
  },
  {
    key: "CLOSED",
    label: "تم الإغلاق",
  },
];

const STATUS_PROGRESS = {
  NEW: 0,
  ASSIGNED: 1,
  ACCEPTED: 1,
  IN_PROGRESS: 2,
  WAITING_PARTS: 2,
  REOPENED: 2,
  PENDING_APPROVAL: 3,
  CLOSED: 4,
  CANCELLED: 0,
};

const DEFAULT_PUBLIC_MESSAGES = {
  NEW: "تم استلام طلبك وسيتم مراجعته من فريق الصيانة.",
  ASSIGNED: "تم تعيين فني مختص لمتابعة طلبك.",
  ACCEPTED: "وافق الفني على الطلب وسيبدأ العمل قريبًا.",
  IN_PROGRESS: "يعمل فريق الصيانة حاليًا على معالجة المشكلة.",
  WAITING_PARTS:
    "يتطلب الإصلاح توفير قطعة غيار، وسيتم تحديث الطلب عند وصولها.",
  PENDING_APPROVAL:
    "أكمل الفني أعمال الصيانة. يرجى تأكيد ما إذا تم حل المشكلة.",
  CLOSED: "تم إغلاق طلب الصيانة بنجاح.",
  REOPENED:
    "تمت إعادة فتح الطلب وسيعاود فريق الصيانة متابعته.",
  CANCELLED: "تم إلغاء طلب الصيانة.",
};

const DEMO_TICKET = {
  id: "demo-ticket",
  ticket_number: "MT-2026-00125",
  tracking_token: "demo-tracking-token",
  title: "المكيف لا يبرد",
  description:
    "المكيف يعمل، لكن الهواء الخارج غير بارد.",
  status: "PENDING_APPROVAL",
  priority: "EMERGENCY",
  asset_name: "مكيف غرفة الاجتماعات",
  asset_number: "AC-RYD-001",
  location_name: "فرع الرياض",
  created_at: "2026-07-25T09:30:00+03:00",
  updated_at: "2026-07-25T16:20:00+03:00",
  public_message:
    "تم تنظيف المرشحات وفحص ضغط الغاز، وأصبح المكيف يعمل بصورة طبيعية.",
};

function getTicketNumber(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
  );
}

function getAssetName(ticket) {
  return (
    ticket?.asset_name ||
    ticket?.asset?.name ||
    ticket?.assets?.name ||
    "دون جهاز محدد"
  );
}

function getAssetNumber(ticket) {
  return (
    ticket?.asset_number ||
    ticket?.asset?.asset_number ||
    ticket?.assets?.asset_number ||
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

function getPublicMessage(ticket) {
  return (
    ticket?.public_message ||
    ticket?.latest_public_message ||
    ticket?.reporter_message ||
    DEFAULT_PUBLIC_MESSAGES[ticket?.status] ||
    "سيتم تحديث حالة الطلب عند توفر معلومات جديدة."
  );
}

function readDemoTickets() {
  try {
    const storedValue = localStorage.getItem(
      "fixflow_public_tickets"
    );

    const parsedValue = storedValue
      ? JSON.parse(storedValue)
      : [];

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function saveDemoTickets(tickets) {
  localStorage.setItem(
    "fixflow_public_tickets",
    JSON.stringify(tickets)
  );
}

function getDemoTicket(trackingToken) {
  const storedTicket = readDemoTickets().find(
    (ticket) =>
      String(
        ticket.tracking_token ||
          ticket.trackingToken ||
          ""
      ) === String(trackingToken)
  );

  if (storedTicket) {
    return storedTicket;
  }

  return null;
}

function updateDemoTicket(trackingToken, changes) {
  const tickets = readDemoTickets();

  const ticketIndex = tickets.findIndex(
    (ticket) =>
      String(
        ticket.tracking_token ||
          ticket.trackingToken ||
          ""
      ) === String(trackingToken)
  );

  if (ticketIndex === -1) {
    throw new Error("TRACKING_TOKEN_NOT_FOUND");
  }

  const updatedTicket = {
    ...tickets[ticketIndex],
    ...changes,
    updated_at: new Date().toISOString(),
  };

  const nextTickets = [...tickets];
  nextTickets[ticketIndex] = updatedTicket;

  saveDemoTickets(nextTickets);

  return updatedTicket;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");

      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: result.includes(",")
          ? result.split(",")[1]
          : result,
      });
    };

    reader.onerror = () => {
      reject(new Error("تعذر قراءة الصورة المرفقة."));
    };

    reader.readAsDataURL(file);
  });
}

function normalizeResponse(result, fallbackTicket) {
  return (
    result?.ticket ||
    result?.data?.ticket ||
    result?.data ||
    result ||
    fallbackTicket
  );
}

export default function TrackRequestPage({ token = "" }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [resolutionChoice, setResolutionChoice] =
    useState("");

  const [reopenReason, setReopenReason] = useState("");
  const [reopenDescription, setReopenDescription] =
    useState("");

  const [reopenImage, setReopenImage] = useState(null);

  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] =
    useState("");

  const [ratingSubmitted, setRatingSubmitted] =
    useState(false);

  const progressIndex = useMemo(
    () => STATUS_PROGRESS[ticket?.status] ?? 0,
    [ticket?.status]
  );

  const progressPercentage =
    (progressIndex / (PROGRESS_STEPS.length - 1)) * 100;

  const existingRating =
    ticket?.reporter_rating ??
    ticket?.rating ??
    null;

  const canConfirmResolution =
    ticket?.status === "PENDING_APPROVAL" &&
    Boolean(ticket?.supervisor_approved_at);

  const canRate =
    ticket?.status === "CLOSED" &&
    !existingRating &&
    !ratingSubmitted;

  useEffect(() => {
    loadTicket();
  }, [token]);

  async function loadTicket() {
    setLoading(true);
    setPageError("");
    setActionError("");
    setSuccessMessage("");

    if (!token) {
      setPageError(
        "رابط متابعة الطلب غير مكتمل أو رمز المتابعة مفقود."
      );
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      const demoTicket = getDemoTicket(token);

      if (!demoTicket) {
        setPageError(
          "لم يتم العثور على طلب مرتبط برمز المتابعة."
        );
      } else {
        setTicket(demoTicket);

        if (
          demoTicket.reporter_rating ||
          demoTicket.rating
        ) {
          setRatingSubmitted(true);
        }
      }

      setLoading(false);
      return;
    }

    try {
      const result = await createPublicTicket({
        action: "track",
        trackingToken: token,
      });

      const trackedTicket = normalizeResponse(
        result,
        null
      );

      if (!trackedTicket?.id) {
        throw new Error("TRACKING_TOKEN_NOT_FOUND");
      }

      setTicket(trackedTicket);

      if (
        trackedTicket.reporter_rating ||
        trackedTicket.rating
      ) {
        setRatingSubmitted(true);
      }
    } catch (loadError) {
      const message = String(
        loadError?.message || ""
      ).toUpperCase();

      if (
        message.includes("NOT_FOUND") ||
        message.includes("INVALID_TOKEN") ||
        message.includes("TRACKING_TOKEN")
      ) {
        setPageError(
          "رمز المتابعة غير صالح أو أن الطلب غير موجود."
        );
      } else if (message.includes("RATE")) {
        setPageError(
          "تم إرسال عدة طلبات خلال وقت قصير. حاولي مرة أخرى لاحقًا."
        );
      } else {
        setPageError(
          "تعذر تحميل بيانات الطلب. حاولي مرة أخرى."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmResolution() {
    if (
      actionBusy ||
      !ticket ||
      !canConfirmResolution
    ) {
      return;
    }

    setActionBusy(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const now = new Date().toISOString();

      if (!isSupabaseConfigured) {
        const updatedTicket = updateDemoTicket(token, {
          status: "CLOSED",
          reporter_confirmed_at: now,
          closed_at: now,
          updated_at: now,
        });

        setTicket(updatedTicket);
      } else {
        const result = await createPublicTicket({
          action: "confirm_resolution",
          trackingToken: token,
          resolved: true,
        });

        setTicket((current) =>
          normalizeResponse(result, {
            ...current,
            status: "CLOSED",
            reporter_confirmed_at: now,
            closed_at: now,
            updated_at: now,
          })
        );
      }

      setResolutionChoice("YES");

      setSuccessMessage(
        "شكرًا لتأكيدك. تم إغلاق طلب الصيانة ويمكنك الآن تقييم الخدمة."
      );
    } catch (confirmError) {
      setActionError(
        confirmError instanceof Error
          ? confirmError.message
          : "تعذر تأكيد حل المشكلة."
      );
    } finally {
      setActionBusy(false);
    }
  }

  function handleShowReopenForm() {
    setResolutionChoice("NO");
    setActionError("");
    setSuccessMessage("");
  }

  async function handleReopenSubmit(event) {
    event.preventDefault();

    if (actionBusy || !ticket) {
      return;
    }

    const normalizedReason = reopenReason.trim();
    const normalizedDescription =
      reopenDescription.trim();

    setActionError("");
    setSuccessMessage("");

    if (normalizedReason.length < 5) {
      setActionError(
        "سبب استمرار المشكلة يجب ألا يقل عن 5 أحرف."
      );
      return;
    }

    if (normalizedDescription.length < 10) {
      setActionError(
        "وصف المشكلة يجب ألا يقل عن 10 أحرف."
      );
      return;
    }

    if (
      reopenImage &&
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(reopenImage.type)
    ) {
      setActionError(
        "يسمح فقط بصور JPG وPNG وWebP."
      );
      return;
    }

    if (
      reopenImage &&
      reopenImage.size > 5 * 1024 * 1024
    ) {
      setActionError(
        "حجم الصورة يجب ألا يتجاوز 5MB."
      );
      return;
    }

    setActionBusy(true);

    try {
      const attachment = await fileToBase64(
        reopenImage
      );

      const now = new Date().toISOString();

      if (!isSupabaseConfigured) {
        const updatedTicket = updateDemoTicket(token, {
          status: "REOPENED",
          reopen_reason: normalizedReason,
          reopen_description: normalizedDescription,
          reopened_at: now,
          updated_at: now,
        });

        setTicket(updatedTicket);
      } else {
        const result = await createPublicTicket({
          action: "reopen",
          trackingToken: token,
          reason: normalizedReason,
          description: normalizedDescription,
          attachment,
        });

        setTicket((current) =>
          normalizeResponse(result, {
            ...current,
            status: "REOPENED",
            reopen_reason: normalizedReason,
            reopened_at: now,
            updated_at: now,
          })
        );
      }

      setResolutionChoice("");
      setReopenReason("");
      setReopenDescription("");
      setReopenImage(null);

      setSuccessMessage(
        "تمت إعادة فتح الطلب وسيقوم فريق الصيانة بمراجعته."
      );
    } catch (reopenError) {
      setActionError(
        reopenError instanceof Error
          ? reopenError.message
          : "تعذر إعادة فتح الطلب."
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRatingSubmit(event) {
    event.preventDefault();

    if (actionBusy || ratingSubmitted) {
      return;
    }

    setActionError("");
    setSuccessMessage("");

    if (rating < 1 || rating > 5) {
      setActionError(
        "اختاري تقييمًا من نجمة واحدة إلى خمس نجوم."
      );
      return;
    }

    setActionBusy(true);

    try {
      const payload = {
        action: "rate",
        trackingToken: token,
        rating,
        comment: ratingComment.trim() || null,
      };

      if (!isSupabaseConfigured) {
        const updatedTicket = updateDemoTicket(token, {
          reporter_rating: rating,
          rating_comment:
            ratingComment.trim() || null,
          rated_at: new Date().toISOString(),
        });

        setTicket(updatedTicket);
      } else {
        const result = await createPublicTicket(payload);

        setTicket((current) =>
          normalizeResponse(result, {
            ...current,
            reporter_rating: rating,
            rating_comment:
              ratingComment.trim() || null,
          })
        );
      }

      setRatingSubmitted(true);
      setSuccessMessage(
        "شكرًا لتقييمك. تم إرسال التقييم بنجاح."
      );
    } catch (ratingError) {
      setActionError(
        ratingError instanceof Error
          ? ratingError.message
          : "تعذر إرسال التقييم."
      );
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <section
        className="auth-card"
        role="status"
        aria-live="polite"
      >
        <span className="auth-icon" aria-hidden="true">
          ◷
        </span>

        <small className="eyebrow">
          متابعة طلب الصيانة
        </small>

        <h1>جاري تحميل الطلب…</h1>

        <p>يرجى الانتظار قليلًا.</p>
      </section>
    );
  }

  if (pageError || !ticket) {
    return (
      <section className="auth-card">
        <EmptyState
          icon="!"
          title="تعذر العثور على الطلب"
          description={
            pageError ||
            "لم نتمكن من تحميل بيانات طلب الصيانة."
          }
          actionLabel="إعادة المحاولة"
          onAction={loadTicket}
        />
      </section>
    );
  }

  return (
    <section
      style={{
        width: "min(820px, 100%)",
        margin: "0 auto",
        display: "grid",
        gap: "18px",
      }}
    >
      <article
        className="panel"
        style={{
          display: "grid",
          gap: "18px",
          padding: "24px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
          }}
        >
          <span
            className="stat-icon green-bg"
            aria-hidden="true"
            style={{
              width: "46px",
              height: "46px",
              flexShrink: 0,
            }}
          >
            ⚒
          </span>

          <div
            style={{
              display: "grid",
              gap: "5px",
              minWidth: 0,
            }}
          >
            <small className="eyebrow">
              متابعة طلب الصيانة
            </small>

            <h1
              style={{
                margin: 0,
                fontSize: "21px",
              }}
            >
              {ticket.title || "طلب صيانة"}
            </h1>

            <small
              style={{
                color: "#71817f",
                direction: "ltr",
                textAlign: "right",
              }}
            >
              {getTicketNumber(ticket)}
            </small>
          </div>

          <div style={{ marginRight: "auto" }}>
            <TicketStatusBadge
              status={ticket.status}
            />
          </div>
        </header>

        {successMessage ? (
          <div
            className="demo-callout"
            role="status"
            aria-live="polite"
          >
            <strong>تمت العملية بنجاح</strong>
            <span>{successMessage}</span>
          </div>
        ) : null}

        {actionError ? (
          <div
            className="form-error"
            role="alert"
            aria-live="assertive"
          >
            {actionError}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gap: "13px",
            padding: "17px",
            border: "1px solid #e1e8e5",
            borderRadius: "12px",
            background: "#f8faf9",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              <small style={{ color: "#82908e" }}>
                الجهاز
              </small>

              <strong style={{ fontSize: "10px" }}>
                {getAssetName(ticket)}
              </strong>

              <small style={{ color: "#82908e" }}>
                {getAssetNumber(ticket)}
              </small>
            </div>

            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              <small style={{ color: "#82908e" }}>
                الموقع
              </small>

              <strong style={{ fontSize: "10px" }}>
                {getLocationName(ticket)}
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              <small style={{ color: "#82908e" }}>
                تاريخ الإرسال
              </small>

              <strong style={{ fontSize: "10px" }}>
                {formatDate(ticket.created_at, {
                  withTime: true,
                })}
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              <small style={{ color: "#82908e" }}>
                آخر تحديث
              </small>

              <strong style={{ fontSize: "10px" }}>
                {formatDate(
                  ticket.updated_at ||
                    ticket.created_at,
                  {
                    withTime: true,
                  }
                )}
              </strong>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: "17px",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 5px",
                fontSize: "14px",
              }}
            >
              تقدم الطلب
            </h2>

            <p
              style={{
                margin: 0,
                color: "#82908e",
                fontSize: "9px",
              }}
            >
              يمكنك متابعة المرحلة الحالية لطلب الصيانة.
            </p>
          </div>

          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns:
                "repeat(5, minmax(0, 1fr))",
              gap: "5px",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "14px",
                right: "10%",
                left: "10%",
                height: "4px",
                borderRadius: "4px",
                background: "#e3e9e7",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: `${progressPercentage}%`,
                  height: "100%",
                  borderRadius: "4px",
                  background: "#2a8b79",
                  transition: "width 250ms ease",
                }}
              />
            </div>

            {PROGRESS_STEPS.map((step, index) => {
              const completed =
                index <= progressIndex;

              return (
                <div
                  key={step.key}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "grid",
                    justifyItems: "center",
                    gap: "8px",
                    textAlign: "center",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "30px",
                      height: "30px",
                      display: "grid",
                      placeItems: "center",
                      border: completed
                        ? "3px solid #2a8b79"
                        : "3px solid #dfe6e4",
                      borderRadius: "50%",
                      background: completed
                        ? "#2a8b79"
                        : "#ffffff",
                      color: completed
                        ? "#ffffff"
                        : "#9aa6a4",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {completed ? "✓" : index + 1}
                  </span>

                  <small
                    style={{
                      color: completed
                        ? "#234b45"
                        : "#8a9896",
                      fontSize: "8px",
                      fontWeight: completed
                        ? 700
                        : 500,
                      lineHeight: 1.5,
                    }}
                  >
                    {step.label}
                  </small>
                </div>
              );
            })}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: "8px",
            padding: "16px",
            borderRadius: "11px",
            background: "#edf6f3",
          }}
        >
          <strong
            style={{
              color: "#176c62",
              fontSize: "11px",
            }}
          >
            آخر رسالة من فريق الصيانة
          </strong>

          <p
            style={{
              margin: 0,
              color: "#506764",
              fontSize: "10px",
              lineHeight: 1.9,
              whiteSpace: "pre-wrap",
            }}
          >
            {getPublicMessage(ticket)}
          </p>
        </section>

        <button
          type="button"
          className="secondary"
          onClick={loadTicket}
          disabled={actionBusy}
          style={{
            justifySelf: "start",
          }}
        >
          تحديث حالة الطلب
        </button>
      </article>

      {canConfirmResolution ? (
        <article
          className="panel"
          style={{
            display: "grid",
            gap: "16px",
            padding: "22px",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 7px",
                fontSize: "15px",
              }}
            >
              هل تم حل المشكلة؟
            </h2>

            <p
              style={{
                margin: 0,
                color: "#71817f",
                fontSize: "10px",
                lineHeight: 1.8,
              }}
            >
              أكمل الفني أعمال الصيانة، ونحتاج إلى تأكيدك
              النهائي.
            </p>
          </div>

          {resolutionChoice !== "NO" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="primary"
                onClick={handleConfirmResolution}
                disabled={actionBusy}
              >
                {actionBusy
                  ? "جاري التأكيد…"
                  : "نعم، تم حل المشكلة"}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={handleShowReopenForm}
                disabled={actionBusy}
              >
                لا، المشكلة ما زالت موجودة
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleReopenSubmit}
              noValidate
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              <label>
                سبب استمرار المشكلة

                <input
                  type="text"
                  value={reopenReason}
                  onChange={(event) => {
                    setReopenReason(event.target.value);
                    setActionError("");
                  }}
                  placeholder="مثال: عاد العطل بعد فترة قصيرة"
                  disabled={actionBusy}
                  required
                  minLength={5}
                  maxLength={200}
                />
              </label>

              <label>
                وصف المشكلة

                <textarea
                  value={reopenDescription}
                  onChange={(event) => {
                    setReopenDescription(
                      event.target.value
                    );
                    setActionError("");
                  }}
                  placeholder="اشرحي ما الذي ما زال لا يعمل..."
                  disabled={actionBusy}
                  required
                  minLength={10}
                  maxLength={1500}
                />
              </label>

              <label>
                صورة اختيارية

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setReopenImage(
                      event.target.files?.[0] || null
                    );
                    setActionError("");
                  }}
                  disabled={actionBusy}
                />

                <small>
                  يسمح بصور JPG وPNG وWebP بحجم أقصى
                  5MB.
                </small>
              </label>

              <div className="modal-buttons">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setResolutionChoice("");
                    setActionError("");
                  }}
                  disabled={actionBusy}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={actionBusy}
                >
                  {actionBusy
                    ? "جاري إعادة الفتح…"
                    : "إعادة فتح الطلب"}
                </button>
              </div>
            </form>
          )}
        </article>
      ) : null}

      {canRate ? (
        <article
          className="panel"
          style={{
            display: "grid",
            gap: "16px",
            padding: "22px",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 7px",
                fontSize: "15px",
              }}
            >
              قيّمي خدمة الصيانة
            </h2>

            <p
              style={{
                margin: 0,
                color: "#71817f",
                fontSize: "10px",
              }}
            >
              يساعدنا تقييمك على تحسين جودة الخدمة.
            </p>
          </div>

          <form
            onSubmit={handleRatingSubmit}
            noValidate
            style={{
              display: "grid",
              gap: "15px",
            }}
          >
            <fieldset
              disabled={actionBusy}
              style={{
                display: "grid",
                gap: "10px",
                margin: 0,
                padding: 0,
                border: 0,
              }}
            >
              <legend
                style={{
                  marginBottom: "8px",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                التقييم من 1 إلى 5
              </legend>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  direction: "ltr",
                }}
              >
                {[1, 2, 3, 4, 5].map(
                  (ratingValue) => (
                    <button
                      key={ratingValue}
                      type="button"
                      onClick={() => {
                        setRating(ratingValue);
                        setActionError("");
                      }}
                      disabled={actionBusy}
                      aria-label={`تقييم ${ratingValue} من 5`}
                      style={{
                        width: "42px",
                        height: "42px",
                        border:
                          ratingValue <= rating
                            ? "1px solid #d59b20"
                            : "1px solid #dfe6e4",
                        borderRadius: "9px",
                        background:
                          ratingValue <= rating
                            ? "#fff4d7"
                            : "#ffffff",
                        color:
                          ratingValue <= rating
                            ? "#d59b20"
                            : "#a6afad",
                        cursor: actionBusy
                          ? "not-allowed"
                          : "pointer",
                        fontSize: "22px",
                      }}
                    >
                      ★
                    </button>
                  )
                )}
              </div>
            </fieldset>

            <label>
              تعليق اختياري

              <textarea
                value={ratingComment}
                onChange={(event) =>
                  setRatingComment(event.target.value)
                }
                placeholder="اكتبي ملاحظتك عن الخدمة..."
                disabled={actionBusy}
                maxLength={1000}
              />
            </label>

            <button
              type="submit"
              className="primary"
              disabled={actionBusy || rating === 0}
            >
              {actionBusy
                ? "جاري إرسال التقييم…"
                : "إرسال التقييم"}
            </button>
          </form>
        </article>
      ) : null}

      {ratingSubmitted || existingRating ? (
        <article
          className="panel"
          style={{
            display: "grid",
            justifyItems: "center",
            gap: "10px",
            padding: "22px",
            textAlign: "center",
          }}
        >
          <span
            className="stat-icon green-bg"
            aria-hidden="true"
          >
            ✓
          </span>

          <strong>شكرًا لتقييمك</strong>

          <small style={{ color: "#71817f" }}>
            تم حفظ تقييم خدمة الصيانة بنجاح.
          </small>
        </article>
      ) : null}
    </section>
  );
}
