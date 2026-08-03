import { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

function getTicketNumber(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
  );
}

function getTechnicianName(ticket) {
  return (
    ticket?.assigned_technician?.full_name ||
    ticket?.profiles?.full_name ||
    ticket?.technician_name ||
    ticket?.technicianName ||
    "فني غير محدد"
  );
}

function getResolution(ticket) {
  return (
    ticket?.resolution ||
    ticket?.resolution_summary ||
    ticket?.resolutionSummary ||
    "لم يضف الفني ملخصًا للإصلاح."
  );
}

function getAttachments(ticket) {
  const attachments =
    ticket?.ticket_attachments ||
    ticket?.attachments ||
    [];

  return attachments
    .map((attachment) => ({
      id:
        attachment.id ||
        attachment.storage_path ||
        attachment.url,
      url:
        attachment.public_url ||
        attachment.file_url ||
        attachment.url ||
        attachment.storage_path ||
        "",
      type:
        attachment.attachment_type ||
        attachment.type ||
        attachment.category ||
        "",
      title:
        attachment.title ||
        attachment.file_name ||
        attachment.filename ||
        "صورة الصيانة",
    }))
    .filter((attachment) => attachment.url);
}

function getParts(ticket) {
  return (
    ticket?.spare_parts_used ||
    ticket?.parts_used ||
    ticket?.parts ||
    []
  );
}

function getPartName(part) {
  return (
    part.part_name ||
    part.name ||
    part.spare_part?.name ||
    "قطعة غيار"
  );
}

function getPartQuantity(part) {
  return Number(part.quantity) || 1;
}

function formatDuration(minutes) {
  const totalMinutes = Number(minutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "غير محدد";
  }

  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)} دقيقة`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.round(totalMinutes % 60);

  return remainingMinutes
    ? `${hours} ساعة و${remainingMinutes} دقيقة`
    : `${hours} ساعة`;
}

function calculateDuration(ticket) {
  const directDuration =
    ticket?.work_duration_minutes ??
    ticket?.workDurationMinutes ??
    ticket?.resolution_time_minutes ??
    ticket?.resolutionTimeMinutes;

  if (directDuration !== undefined && directDuration !== null) {
    return formatDuration(directDuration);
  }

  const startedAt =
    ticket?.started_at ||
    ticket?.startedAt ||
    ticket?.work_started_at;

  const completedAt =
    ticket?.completed_at ||
    ticket?.completedAt ||
    ticket?.updated_at;

  if (!startedAt || !completedAt) {
    return "غير محدد";
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(completedAt).getTime();

  if (
    Number.isNaN(startTime) ||
    Number.isNaN(endTime) ||
    endTime <= startTime
  ) {
    return "غير محدد";
  }

  return formatDuration((endTime - startTime) / 60000);
}

export default function CloseTicketModal({
  open,
  ticket,
  busy = false,
  error = "",
  requireReporterConfirmation = false,
  onConfirm,
  onClose,
}) {
  const [decision, setDecision] = useState("APPROVE");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");

  const attachments = useMemo(
    () => getAttachments(ticket),
    [ticket]
  );

  const parts = useMemo(() => getParts(ticket), [ticket]);

  const beforeImages = attachments.filter((attachment) =>
    ["BEFORE", "BEFORE_REPAIR", "ISSUE"].includes(
      String(attachment.type).toUpperCase()
    )
  );

  const afterImages = attachments.filter((attachment) =>
    ["AFTER", "AFTER_REPAIR", "RESOLUTION"].includes(
      String(attachment.type).toUpperCase()
    )
  );

  const otherImages = attachments.filter(
    (attachment) =>
      !beforeImages.includes(attachment) &&
      !afterImages.includes(attachment)
  );

  const isPendingApproval =
    ticket?.status === "PENDING_APPROVAL";

  useEffect(() => {
    if (!open) {
      return;
    }

    setDecision("APPROVE");
    setNote("");
    setFieldError("");
  }, [open, ticket?.id]);

  function handleClose() {
    if (!busy) {
      onClose?.();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      busy ||
      !isPendingApproval ||
      typeof onConfirm !== "function"
    ) {
      return;
    }

    const normalizedNote = note.trim();

    if (
      decision === "RETURN_TO_TECHNICIAN" &&
      normalizedNote.length < 5
    ) {
      setFieldError(
        "سبب إعادة الطلب للفني يجب ألا يقل عن 5 أحرف."
      );
      return;
    }

    setFieldError("");

    await onConfirm({
      ticketId: ticket.id,
      decision,
      nextStatus:
        decision === "APPROVE"
          ? "CLOSED"
          : "IN_PROGRESS",
      note: normalizedNote || null,
      requireReporterConfirmation,
    });
  }

  function renderImageGroup(title, images) {
    if (images.length === 0) {
      return null;
    }

    return (
      <section
        style={{
          display: "grid",
          gap: "10px",
        }}
      >
        <strong style={{ fontSize: "11px" }}>{title}</strong>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(110px, 1fr))",
            gap: "9px",
          }}
        >
          {images.map((image) => (
            <a
              key={image.id}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "grid",
                gap: "6px",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <img
                src={image.url}
                alt={image.title}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100px",
                  objectFit: "cover",
                  border: "1px solid #dfe6e4",
                  borderRadius: "9px",
                  background: "#f3f6f5",
                }}
              />

              <small
                style={{
                  overflow: "hidden",
                  color: "#71817f",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {image.title}
              </small>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="اعتماد وإغلاق الطلب"
      description={`مراجعة الإصلاح للطلب رقم ${getTicketNumber(
        ticket
      )}`}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      showCloseButton={!busy}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}

        {!isPendingApproval ? (
          <div className="form-error" role="alert">
            لا يمكن اعتماد هذا الطلب لأن حالته الحالية ليست
            بانتظار الاعتماد.
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gap: "12px",
            marginBottom: "16px",
            padding: "15px",
            border: "1px solid #e2e8e6",
            borderRadius: "11px",
            background: "#f7faf9",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span
              style={{
                color: "#71817f",
                fontSize: "9px",
              }}
            >
              الفني المسؤول
            </span>

            <strong style={{ fontSize: "10px" }}>
              {getTechnicianName(ticket)}
            </strong>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span
              style={{
                color: "#71817f",
                fontSize: "9px",
              }}
            >
              الوقت المستغرق
            </span>

            <strong style={{ fontSize: "10px" }}>
              {calculateDuration(ticket)}
            </strong>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: "7px",
            marginBottom: "16px",
          }}
        >
          <strong style={{ fontSize: "11px" }}>
            ملخص الإصلاح
          </strong>

          <p
            style={{
              margin: 0,
              padding: "13px",
              borderRadius: "9px",
              background: "#f5f8f7",
              color: "#586a67",
              fontSize: "10px",
              lineHeight: 1.9,
              whiteSpace: "pre-wrap",
            }}
          >
            {getResolution(ticket)}
          </p>
        </section>

        {parts.length > 0 ? (
          <section
            style={{
              display: "grid",
              gap: "9px",
              marginBottom: "16px",
            }}
          >
            <strong style={{ fontSize: "11px" }}>
              القطع المستخدمة
            </strong>

            <div
              style={{
                display: "grid",
                gap: "7px",
              }}
            >
              {parts.map((part, index) => (
                <div
                  key={
                    part.id ||
                    `${getPartName(part)}-${index}`
                  }
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "10px 12px",
                    border: "1px solid #e5eae8",
                    borderRadius: "8px",
                    fontSize: "9px",
                  }}
                >
                  <span>{getPartName(part)}</span>

                  <strong>
                    الكمية: {getPartQuantity(part)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          {renderImageGroup("صور قبل الإصلاح", beforeImages)}
          {renderImageGroup("صور بعد الإصلاح", afterImages)}
          {renderImageGroup("صور مرفقة", otherImages)}
        </div>

        <fieldset
          disabled={busy || !isPendingApproval}
          style={{
            display: "grid",
            gap: "9px",
            margin: "0 0 16px",
            padding: 0,
            border: 0,
          }}
        >
          <legend
            style={{
              marginBottom: "9px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            قرار المراجعة
          </legend>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px",
              border:
                decision === "APPROVE"
                  ? "1px solid #2b8b75"
                  : "1px solid #dfe6e4",
              borderRadius: "9px",
              background:
                decision === "APPROVE"
                  ? "#edf7f3"
                  : "#ffffff",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="decision"
              value="APPROVE"
              checked={decision === "APPROVE"}
              onChange={() => {
                setDecision("APPROVE");
                setFieldError("");
              }}
            />

            <span
              style={{
                display: "grid",
                gap: "4px",
              }}
            >
              <strong style={{ fontSize: "10px" }}>
                اعتماد الإصلاح
              </strong>

              <small style={{ color: "#71817f" }}>
                {requireReporterConfirmation
                  ? "يتم اعتماد الإصلاح وإرسال طلب تأكيد للمبلّغ."
                  : "يتم اعتماد الإصلاح وإغلاق الطلب."}
              </small>
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px",
              border:
                decision === "RETURN_TO_TECHNICIAN"
                  ? "1px solid #bd5a4d"
                  : "1px solid #dfe6e4",
              borderRadius: "9px",
              background:
                decision === "RETURN_TO_TECHNICIAN"
                  ? "#fff4f1"
                  : "#ffffff",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="decision"
              value="RETURN_TO_TECHNICIAN"
              checked={
                decision === "RETURN_TO_TECHNICIAN"
              }
              onChange={() => {
                setDecision("RETURN_TO_TECHNICIAN");
                setFieldError("");
              }}
            />

            <span
              style={{
                display: "grid",
                gap: "4px",
              }}
            >
              <strong style={{ fontSize: "10px" }}>
                إعادة الطلب للفني
              </strong>

              <small style={{ color: "#71817f" }}>
                تعود حالة الطلب إلى جاري العمل لمعالجة
                الملاحظات.
              </small>
            </span>
          </label>
        </fieldset>

        <label>
          {decision === "RETURN_TO_TECHNICIAN"
            ? "سبب إعادة الطلب"
            : "ملاحظة الاعتماد"}

          <textarea
            name="note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setFieldError("");
            }}
            placeholder={
              decision === "RETURN_TO_TECHNICIAN"
                ? "اكتبي سبب الرفض وما المطلوب من الفني..."
                : "أضيفي ملاحظة اختيارية عن الاعتماد..."
            }
            disabled={busy || !isPendingApproval}
            required={decision === "RETURN_TO_TECHNICIAN"}
            minLength={
              decision === "RETURN_TO_TECHNICIAN" ? 5 : 0
            }
            maxLength={1000}
            aria-invalid={Boolean(fieldError)}
          />

          {fieldError ? (
            <small className="form-error" role="alert">
              {fieldError}
            </small>
          ) : (
            <small>
              {decision === "RETURN_TO_TECHNICIAN"
                ? "سبب الإعادة مطلوب وسيظهر للفني في سجل الطلب."
                : "الملاحظة اختيارية وستحفظ في سجل الطلب."}
            </small>
          )}
        </label>

        <div className="modal-buttons">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={busy}
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            loading={busy}
            loadingText="جاري حفظ القرار…"
            disabled={!isPendingApproval}
          >
            {decision === "APPROVE"
              ? requireReporterConfirmation
                ? "اعتماد وإرسال التأكيد"
                : "اعتماد وإغلاق الطلب"
              : "إعادة الطلب للفني"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
