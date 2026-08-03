import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

import {
  PRIORITY,
  PRIORITY_LABELS,
} from "../../constants/priorities";

import {
  TICKET_STATUS,
  STATUS_LABELS,
} from "../../constants/ticketStatuses";

/* ==================================================
   القيم الافتراضية للفلاتر
================================================== */

const EMPTY_FILTERS = Object.freeze({
  search: "",
  status: "",
  priority: "",
  locationId: "",
  categoryId: "",
  technicianId: "",
  dateFrom: "",
  dateTo: "",
  overdueOnly: false,
  emergencyOnly: false,
});

/* ==================================================
   خيارات الحالة والأولوية
================================================== */

const STATUS_OPTIONS = Object.values(
  TICKET_STATUS
).map((status) => ({
  value: status,
  label:
    STATUS_LABELS[status] ||
    status,
}));

const PRIORITY_OPTIONS = Object.values(
  PRIORITY
).map((priority) => ({
  value: priority,
  label:
    PRIORITY_LABELS[priority] ||
    priority,
}));

/* ==================================================
   دوال مساعدة
================================================== */

function createEmptyFilters() {
  return {
    ...EMPTY_FILTERS,
  };
}

function normalizeOption(
  item,
  fallbackLabel
) {
  if (
    typeof item === "string"
  ) {
    return {
      value: item,
      label: item,
      disabled: false,
    };
  }

  return {
    value:
      item?.id ??
      item?.value ??
      "",

    label:
      item?.full_name ??
      item?.fullName ??
      item?.name ??
      item?.label ??
      fallbackLabel,

    disabled:
      item?.is_active === false ||
      item?.disabled === true,
  };
}

function normalizeFilters(
  filters = {}
) {
  return {
    ...createEmptyFilters(),
    ...filters,

    search: String(
      filters.search || ""
    ),

    overdueOnly: Boolean(
      filters.overdueOnly
    ),

    emergencyOnly: Boolean(
      filters.emergencyOnly
    ),
  };
}

function countActiveFilters(
  filters
) {
  return Object.entries(
    filters
  ).reduce(
    (
      currentCount,
      [, fieldValue]
    ) => {
      if (
        typeof fieldValue ===
        "boolean"
      ) {
        return fieldValue
          ? currentCount + 1
          : currentCount;
      }

      return String(
        fieldValue || ""
      ).trim()
        ? currentCount + 1
        : currentCount;
    },
    0
  );
}

/* ==================================================
   مكوّن الفلاتر
================================================== */

export default function TicketFilters({
  value = {},
  locations = [],
  categories = [],
  technicians = [],

  busy = false,
  expanded = true,

  onChange,
  onApply,
  onReset,
}) {
  const [
    filters,
    setFilters,
  ] = useState(() =>
    normalizeFilters(value)
  );

  const [
    showAdvanced,
    setShowAdvanced,
  ] = useState(
    Boolean(expanded)
  );

  const [
    dateError,
    setDateError,
  ] = useState("");

  /* ==================================================
     مزامنة القيمة القادمة من الصفحة
  ================================================== */

  useEffect(() => {
    setFilters(
      normalizeFilters(value)
    );
  }, [value]);

  useEffect(() => {
    setShowAdvanced(
      Boolean(expanded)
    );
  }, [expanded]);

  /* ==================================================
     تجهيز خيارات القوائم
  ================================================== */

  const locationOptions =
    useMemo(
      () =>
        locations
          .map((location) =>
            normalizeOption(
              location,
              "موقع دون اسم"
            )
          )
          .filter(
            (option) =>
              option.value
          ),
      [locations]
    );

  const categoryOptions =
    useMemo(
      () =>
        categories
          .map((category) =>
            normalizeOption(
              category,
              "تصنيف دون اسم"
            )
          )
          .filter(
            (option) =>
              option.value
          ),
      [categories]
    );

  const technicianOptions =
    useMemo(
      () =>
        technicians
          .map((technician) =>
            normalizeOption(
              technician,
              "فني دون اسم"
            )
          )
          .filter(
            (option) =>
              option.value
          ),
      [technicians]
    );

  const activeFiltersCount =
    useMemo(
      () =>
        countActiveFilters(
          filters
        ),
      [filters]
    );

  /* ==================================================
     تحديث أحد الفلاتر
  ================================================== */

  function updateFilter(
    fieldName,
    fieldValue
  ) {
    const nextFilters = {
      ...filters,
      [fieldName]:
        fieldValue,
    };

    setFilters(nextFilters);
    setDateError("");

    if (
      typeof onChange ===
      "function"
    ) {
      onChange(nextFilters);
    }
  }

  /* ==================================================
     التحقق من التاريخ
  ================================================== */

  function validateDates() {
    if (
      !filters.dateFrom ||
      !filters.dateTo
    ) {
      setDateError("");
      return true;
    }

    const startDate =
      new Date(
        `${filters.dateFrom}T00:00:00`
      );

    const endDate =
      new Date(
        `${filters.dateTo}T23:59:59`
      );

    if (
      Number.isNaN(
        startDate.getTime()
      ) ||
      Number.isNaN(
        endDate.getTime()
      )
    ) {
      setDateError(
        "أحد التواريخ المدخلة غير صحيح."
      );

      return false;
    }

    if (
      startDate.getTime() >
      endDate.getTime()
    ) {
      setDateError(
        "تاريخ البداية يجب أن يكون قبل تاريخ النهاية."
      );

      return false;
    }

    setDateError("");
    return true;
  }

  /* ==================================================
     تطبيق الفلاتر
  ================================================== */

  function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      !validateDates()
    ) {
      return;
    }

    const preparedFilters = {
      ...filters,

      search: String(
        filters.search || ""
      ).trim(),
    };

    setFilters(
      preparedFilters
    );

    if (
      typeof onChange ===
      "function"
    ) {
      onChange(
        preparedFilters
      );
    }

    if (
      typeof onApply ===
      "function"
    ) {
      onApply(
        preparedFilters
      );
    }
  }

  /* ==================================================
     إعادة تعيين الفلاتر
  ================================================== */

  function handleReset() {
    if (busy) {
      return;
    }

    const emptyFilters =
      createEmptyFilters();

    setFilters(
      emptyFilters
    );

    setDateError("");

    if (
      typeof onChange ===
      "function"
    ) {
      onChange(
        emptyFilters
      );
    }

    if (
      typeof onReset ===
      "function"
    ) {
      onReset(
        emptyFilters
      );
    }
  }

  /* ==================================================
     واجهة الفلاتر
  ================================================== */

  return (
    <form
      className="panel"
      onSubmit={handleSubmit}
      noValidate
      style={{
        display: "grid",
        gap: "14px",
        padding: "18px",
      }}
    >
      {/* البحث وزر إظهار الفلاتر */}
      <div
        style={{
          display: "flex",
          alignItems:
            "flex-end",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div
          style={{
            flex: "1 1 260px",
          }}
        >
          <Input
            label="البحث"
            name="search"
            type="search"
            value={
              filters.search
            }
            placeholder="ابحث برقم الطلب أو العنوان أو الجهاز أو المبلّغ..."
            disabled={busy}
            autoComplete="off"
            onChange={(
              event
            ) =>
              updateFilter(
                "search",
                event.target
                  .value
              )
            }
          />
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            setShowAdvanced(
              (current) =>
                !current
            )
          }
          disabled={busy}
          aria-expanded={
            showAdvanced
          }
          style={{
            minHeight:
              "40px",

            whiteSpace:
              "nowrap",
          }}
        >
          {showAdvanced
            ? "إخفاء الفلاتر"
            : "إظهار الفلاتر"}

          {activeFiltersCount >
          0
            ? ` (${activeFiltersCount})`
            : ""}
        </button>
      </div>

      {/* الفلاتر المتقدمة */}
      {showAdvanced ? (
        <>
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(155px, 1fr))",

              gap: "12px",
            }}
          >
            <Select
              label="الحالة"
              name="status"
              options={
                STATUS_OPTIONS
              }
              value={
                filters.status
              }
              placeholder="جميع الحالات"
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "status",
                  event.target
                    .value
                )
              }
            />

            <Select
              label="الأولوية"
              name="priority"
              options={
                PRIORITY_OPTIONS
              }
              value={
                filters.priority
              }
              placeholder="جميع الأولويات"
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "priority",
                  event.target
                    .value
                )
              }
            />

            <Select
              label="الفرع أو الموقع"
              name="locationId"
              options={
                locationOptions
              }
              value={
                filters.locationId
              }
              placeholder="جميع المواقع"
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "locationId",
                  event.target
                    .value
                )
              }
            />

            <Select
              label="التصنيف"
              name="categoryId"
              options={
                categoryOptions
              }
              value={
                filters.categoryId
              }
              placeholder="جميع التصنيفات"
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "categoryId",
                  event.target
                    .value
                )
              }
            />

            <Select
              label="الفني"
              name="technicianId"
              options={
                technicianOptions
              }
              value={
                filters.technicianId
              }
              placeholder="جميع الفنيين"
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "technicianId",
                  event.target
                    .value
                )
              }
            />

            <Input
              label="من تاريخ"
              name="dateFrom"
              type="date"
              value={
                filters.dateFrom
              }
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "dateFrom",
                  event.target
                    .value
                )
              }
            />

            <Input
              label="إلى تاريخ"
              name="dateTo"
              type="date"
              value={
                filters.dateTo
              }
              disabled={busy}
              onChange={(
                event
              ) =>
                updateFilter(
                  "dateTo",
                  event.target
                    .value
                )
              }
            />
          </div>

          {dateError ? (
            <div
              className="form-error"
              role="alert"
            >
              {dateError}
            </div>
          ) : null}

          {/* الفلاتر السريعة */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "8px",
                margin: 0,
                cursor: busy
                  ? "default"
                  : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  filters.overdueOnly
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "overdueOnly",
                    event.target
                      .checked
                  )
                }
                style={{
                  width: "16px",
                  height: "16px",
                }}
              />

              <span>
                الطلبات المتأخرة فقط
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "8px",
                margin: 0,
                cursor: busy
                  ? "default"
                  : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  filters.emergencyOnly
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "emergencyOnly",
                    event.target
                      .checked
                  )
                }
                style={{
                  width: "16px",
                  height: "16px",
                }}
              />

              <span>
                الطلبات الطارئة فقط
              </span>
            </label>
          </div>
        </>
      ) : null}

      {/* أزرار التنفيذ */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          paddingTop:
            "12px",

          borderTop:
            "1px solid #edf0ef",
        }}
      >
        <Button
          type="submit"
          loading={busy}
          loadingText="جاري التطبيق…"
        >
          تطبيق الفلاتر
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
          disabled={
            busy ||
            activeFiltersCount ===
              0
          }
        >
          إعادة تعيين
        </Button>
      </div>
    </form>
  );
}