import { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Select from "../common/Select";

function getTicketNumber(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
  );
}

function getTicketLocationId(ticket) {
  return (
    ticket?.location_id ||
    ticket?.locationId ||
    ticket?.location?.id ||
    ticket?.locations?.id ||
    null
  );
}

function getCurrentTechnicianId(ticket) {
  return (
    ticket?.assigned_technician_id ||
    ticket?.assignedTechnicianId ||
    ticket?.technician_id ||
    ticket?.technicianId ||
    ticket?.assigned_technician?.id ||
    ticket?.profiles?.id ||
    null
  );
}

function getTechnicianLocationIds(technician) {
  const directLocationId =
    technician.location_id || technician.locationId;

  if (directLocationId) {
    return [String(directLocationId)];
  }

  const locations =
    technician.location_ids ||
    technician.locationIds ||
    technician.user_locations ||
    technician.locations ||
    [];

  return locations
    .map((location) => {
      if (typeof location === "string") {
        return location;
      }

      return (
        location.location_id ||
        location.locationId ||
        location.id ||
        null
      );
    })
    .filter(Boolean)
    .map(String);
}

function normalizeTechnician(technician) {
  const fullName =
    technician.full_name ||
    technician.fullName ||
    technician.name ||
    technician.email ||
    "فني دون اسم";

  const specialization =
    technician.specialization ||
    technician.speciality ||
    technician.job_title ||
    technician.jobTitle ||
    "";

  const openTicketsCount =
    technician.open_tickets_count ??
    technician.openTicketsCount ??
    technician.active_tickets_count ??
    technician.activeTicketsCount ??
    0;

  return {
    ...technician,
    id: technician.id || technician.value,
    fullName,
    specialization,
    openTicketsCount: Number(openTicketsCount) || 0,
    isActive:
      technician.is_active ??
      technician.isActive ??
      technician.status !== "INACTIVE",
    locationIds: getTechnicianLocationIds(technician),
  };
}

export default function AssignTechnicianModal({
  open,
  ticket,
  technicians = [],
  busy = false,
  error = "",
  onAssign,
  onClose,
}) {
  const currentTechnicianId = getCurrentTechnicianId(ticket);

  const [technicianId, setTechnicianId] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");

  const availableTechnicians = useMemo(() => {
    const ticketLocationId = getTicketLocationId(ticket);

    return technicians
      .map(normalizeTechnician)
      .filter((technician) => {
        if (!technician.id || !technician.isActive) {
          return false;
        }

        if (
          !ticketLocationId ||
          technician.locationIds.length === 0
        ) {
          return true;
        }

        return technician.locationIds.includes(
          String(ticketLocationId)
        );
      })
      .sort((first, second) => {
        if (
          first.openTicketsCount !== second.openTicketsCount
        ) {
          return (
            first.openTicketsCount - second.openTicketsCount
          );
        }

        return first.fullName.localeCompare(
          second.fullName,
          "ar"
        );
      });
  }, [technicians, ticket]);

  const technicianOptions = useMemo(
    () =>
      availableTechnicians.map((technician) => ({
        value: technician.id,
        label: technician.specialization
          ? `${technician.fullName} — ${technician.specialization}`
          : technician.fullName,
      })),
    [availableTechnicians]
  );

  const selectedTechnician = availableTechnicians.find(
    (technician) =>
      String(technician.id) === String(technicianId)
  );

  const isSameTechnician =
    currentTechnicianId &&
    String(currentTechnicianId) === String(technicianId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTechnicianId(
      currentTechnicianId
        ? String(currentTechnicianId)
        : ""
    );

    setNote("");
    setFieldError("");
  }, [open, currentTechnicianId]);

  function handleClose() {
    if (!busy) {
      onClose?.();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy || typeof onAssign !== "function") {
      return;
    }

    if (!technicianId) {
      setFieldError("اختاري الفني المسؤول عن الطلب.");
      return;
    }

    if (isSameTechnician) {
      setFieldError(
        "هذا الفني معيّن للطلب بالفعل. اختاري فنيًا آخر."
      );
      return;
    }

    setFieldError("");

    await onAssign({
      ticketId: ticket?.id,
      technicianId,
      note: note.trim() || null,
      previousTechnicianId: currentTechnicianId,
    });
  }

  const isReassignment = Boolean(currentTechnicianId);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isReassignment
          ? "تغيير الفني المسؤول"
          : "تعيين فني للطلب"
      }
      description={`الطلب رقم ${getTicketNumber(ticket)}`}
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

        {availableTechnicians.length === 0 ? (
          <div className="empty">
            لا يوجد فنيون نشطون متاحون لهذا الموقع.
          </div>
        ) : (
          <>
            <Select
              label="الفني المسؤول"
              name="technicianId"
              options={technicianOptions}
              value={technicianId}
              onChange={(event) => {
                setTechnicianId(event.target.value);
                setFieldError("");
              }}
              placeholder="اختاري الفني"
              error={fieldError}
              disabled={busy}
              required
            />

            {selectedTechnician ? (
              <section
                style={{
                  display: "grid",
                  gap: "10px",
                  marginBottom: "14px",
                  padding: "14px",
                  border: "1px solid #e3e9e7",
                  borderRadius: "10px",
                  background: "#f7faf9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span
                    className="mini-avatar"
                    aria-hidden="true"
                  >
                    {selectedTechnician.fullName
                      .trim()
                      .charAt(0)}
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gap: "3px",
                    }}
                  >
                    <strong style={{ fontSize: "11px" }}>
                      {selectedTechnician.fullName}
                    </strong>

                    <small
                      style={{
                        color: "#82908e",
                        fontSize: "9px",
                      }}
                    >
                      {selectedTechnician.specialization ||
                        "فني صيانة"}
                    </small>
                  </div>

                  <span
                    className="badge green"
                    style={{ marginRight: "auto" }}
                  >
                    نشط
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    color: "#697a77",
                    fontSize: "9px",
                  }}
                >
                  <span>الطلبات المفتوحة حاليًا</span>

                  <strong>
                    {selectedTechnician.openTicketsCount}
                  </strong>
                </div>
              </section>
            ) : null}

            <label>
              ملاحظة التعيين

              <textarea
                name="note"
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder={
                  isReassignment
                    ? "اكتبي سبب تغيير الفني عند الحاجة..."
                    : "أضيفي تعليمات مختصرة للفني..."
                }
                disabled={busy}
                maxLength={500}
              />

              <small>
                الملاحظة اختيارية وتظهر في سجل الطلب.
              </small>
            </label>
          </>
        )}

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
            loadingText="جاري التعيين…"
            disabled={
              availableTechnicians.length === 0 ||
              !technicianId ||
              Boolean(isSameTechnician)
            }
          >
            {isReassignment
              ? "تأكيد تغيير الفني"
              : "تعيين الفني"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
