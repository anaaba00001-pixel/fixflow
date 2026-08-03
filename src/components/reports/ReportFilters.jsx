import { useMemo, useState } from "react";
import Button from "../common/Button";
import { PRIORITY, PRIORITY_LABELS } from "../../constants/priorities";
import {
  TICKET_STATUS,
  STATUS_LABELS,
} from "../../constants/ticketStatuses";

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const today = new Date();
  const firstDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  return {
    dateFrom: formatDateInput(firstDayOfMonth),
    dateTo: formatDateInput(today),
  };
}

function createInitialFilters(initialValues = {}) {
  const defaultRange = getDefaultDateRange();

  return {
    dateFrom:
      initialValues.dateFrom ??
      initialValues.date_from ??
      defaultRange.dateFrom,
    dateTo:
      initialValues.dateTo ??
      initialValues.date_to ??
      defaultRange.dateTo,
    locationId:
      initialValues.locationId ??
      initialValues.location_id ??
      "",
    technicianId:
      initialValues.technicianId ??
      initialValues.technician_id ??
      "",
    status: initialValues.status ?? "",
    priority: initialValues.priority ?? "",
  };
}

function normalizeLocation(location) {
  if (typeof location === "string") {
    return {
      value: location,
      label: location,
    };
  }

  return {
    value: location.id ?? location.value ?? "",
    label:
      location.name ??
      location.label ??
      "موقع دون اسم",
    disabled:
      location.is_active === false ||
      location.disabled === true,
  };
}

function normalizeTechnician(technician) {
  if (typeof technician === "string") {
    return {
      value: technician,
      label: technician,
    };
  }

  return {
    value: technician.id ?? technician.value ?? "",
    label:
      technician.full_name ??
      technician.fullName ??
      technician.name ??
      technician.email ??
      "فني دون اسم",
    disabled:
      technician.is_active === false ||
      technician.disabled === true,
  };
}

const STATUS_OPTIONS = Object.values(TICKET_STATUS).map(
  (status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })
);

const PRIORITY_OPTIONS = Object.values(PRIORITY).map(
  (priority) => ({
    value: priority,
    label: PRIORITY_LABELS[priority],
  })
);

export default function ReportFilters({
  locations = [],
  technicians = [],
  initialValues = {},
  busy = false,
  exporting = false,
  error = "",
  showTechnicianFilter = true,
  showExportButtons = true,
  onApply,
  onReset,
  onExport,
}) {
  const [filters, setFilters] = useState(() =>
    createInitialFilters(initialValues)
  );

  const [validationError, setValidationError] =
    useState("");

  const locationOptions = useMemo(
    () => locations.map(normalizeLocation),
    [locations]
  );

  const technicianOptions = useMemo(
    () => technicians.map(normalizeTechnician),
    [technicians]
  );

  function updateFilter(fieldName, value) {
    setFilters((current) => ({
      ...current,
      [fieldName]: value,
    }));

    setValidationError("");
  }

  function validateFilters() {
    if (
      filters.dateFrom &&
      filters.dateTo &&
      new Date(filters.dateFrom) > new Date(filters.dateTo)
    ) {
      setValidationError(
        "تاريخ البداية يجب أن يكون قبل تاريخ النهاية."
      );

      return false;
    }

    return true;
  }

  function createPayload() {
    return {
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
      locationId: filters.locationId || null,
      technicianId: filters.technicianId || null,
      status: filters.status || null,
      priority: filters.priority || null,
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (busy || !validateFilters()) {
      return;
    }

    onApply?.(createPayload());
  }

  function handleReset() {
    if (busy || exporting) {
      return;
    }

    const nextFilters = createInitialFilters();

    setFilters(nextFilters);
    setValidationError("");

    onReset?.({
      dateFrom: nextFilters.dateFrom,
      dateTo: nextFilters.dateTo,
      locationId: null,
      technicianId: null,
      status: null,
      priority: null,
    });
  }

  function handleExport(format) {
    if (
      busy ||
      exporting ||
      typeof onExport !== "function" ||
      !validateFilters()
    ) {
      return;
    }

    onExport(createPayload(), format);
  }

  return (
    <form
      className="panel"
      onSubmit={handleSubmit}
      noValidate
      style={{
        display: "grid",
        gap: "16px",
        padding: "20px",
      }}
    >
      <div className="panel-head" style={{ padding: 0 }}>
        <div>
          <h2>فلاتر التقرير</h2>
          <p>
            حددي الفترة والموقع والحالة لعرض النتائج
            المطلوبة.
          </p>
        </div>
      </div>

      {error || validationError ? (
        <div className="form-error" role="alert">
          {validationError || error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        <label
          style={{
            display: "grid",
            gap: "7px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          من تاريخ

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              updateFilter("dateFrom", event.target.value)
            }
            disabled={busy}
            style={{
              minHeight: "40px",
              padding: "9px 11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#ffffff",
            }}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "7px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          إلى تاريخ

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              updateFilter("dateTo", event.target.value)
            }
            disabled={busy}
            style={{
              minHeight: "40px",
              padding: "9px 11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#ffffff",
            }}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "7px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          الموقع

          <select
            value={filters.locationId}
            onChange={(event) =>
              updateFilter("locationId", event.target.value)
            }
            disabled={busy}
            style={{
              minHeight: "40px",
              padding: "9px 11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#ffffff",
            }}
          >
            <option value="">جميع المواقع</option>

            {locationOptions.map((location) => (
              <option
                key={location.value}
                value={location.value}
                disabled={location.disabled}
              >
                {location.label}
              </option>
            ))}
          </select>
        </label>

        {showTechnicianFilter ? (
          <label
            style={{
              display: "grid",
              gap: "7px",
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            الفني

            <select
              value={filters.technicianId}
              onChange={(event) =>
                updateFilter(
                  "technicianId",
                  event.target.value
                )
              }
              disabled={busy}
              style={{
                minHeight: "40px",
                padding: "9px 11px",
                border: "1px solid #dfe6e4",
                borderRadius: "8px",
                background: "#ffffff",
              }}
            >
              <option value="">جميع الفنيين</option>

              {technicianOptions.map((technician) => (
                <option
                  key={technician.value}
                  value={technician.value}
                  disabled={technician.disabled}
                >
                  {technician.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label
          style={{
            display: "grid",
            gap: "7px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          الحالة

          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter("status", event.target.value)
            }
            disabled={busy}
            style={{
              minHeight: "40px",
              padding: "9px 11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#ffffff",
            }}
          >
            <option value="">جميع الحالات</option>

            {STATUS_OPTIONS.map((status) => (
              <option
                key={status.value}
                value={status.value}
              >
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: "grid",
            gap: "7px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          الأولوية

          <select
            value={filters.priority}
            onChange={(event) =>
              updateFilter("priority", event.target.value)
            }
            disabled={busy}
            style={{
              minHeight: "40px",
              padding: "9px 11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#ffffff",
            }}
          >
            <option value="">جميع الأولويات</option>

            {PRIORITY_OPTIONS.map((priority) => (
              <option
                key={priority.value}
                value={priority.value}
              >
                {priority.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          paddingTop: "14px",
          borderTop: "1px solid #edf0ef",
        }}
      >
        <Button
          type="submit"
          loading={busy}
          loadingText="جاري تحميل التقرير…"
        >
          تطبيق الفلاتر
        </Button>

        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={busy || exporting}
        >
          إعادة تعيين
        </Button>

        {showExportButtons &&
        typeof onExport === "function" ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginRight: "auto",
            }}
          >
            <Button
              variant="secondary"
              onClick={() => handleExport("csv")}
              disabled={busy || exporting}
            >
              تصدير CSV
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleExport("excel")}
              disabled={busy || exporting}
            >
              {exporting
                ? "جاري التصدير…"
                : "تصدير Excel"}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );
}
