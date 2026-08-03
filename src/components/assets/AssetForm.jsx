import { useMemo, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

/* ==================================================
   تجهيز خيارات المواقع والتصنيفات
================================================== */

function normalizeOption(item, fallbackLabel) {
  if (typeof item === "string") {
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
      item?.name ??
      item?.label ??
      fallbackLabel,

    disabled:
      item?.is_active === false ||
      item?.isActive === false ||
      item?.disabled === true,
  };
}

/* ==================================================
   تنظيف النصوص
================================================== */

function normalizeText(value) {
  return String(value || "").trim();
}

/* ==================================================
   نموذج الجهاز
================================================== */

export default function AssetForm({
  locations = [],
  categories = [],
  initialValues = {},

  busy = false,
  error = "",
  submitText = "حفظ الجهاز",

  onSubmit,
  onCancel,
}) {
  const [locationId, setLocationId] = useState(
    initialValues.locationId ??
      initialValues.location_id ??
      ""
  );

  const [categoryId, setCategoryId] = useState(
    initialValues.categoryId ??
      initialValues.category_id ??
      ""
  );

  const [isActive, setIsActive] = useState(
    initialValues.isActive ??
      initialValues.is_active ??
      initialValues.status !== "INACTIVE"
  );

  const [fieldErrors, setFieldErrors] = useState({});

  /* ==================================================
     خيارات القوائم
  ================================================== */

  const locationOptions = useMemo(() => {
    return locations
      .map((location) =>
        normalizeOption(
          location,
          "موقع دون اسم"
        )
      )
      .filter((option) => option.value);
  }, [locations]);

  const categoryOptions = useMemo(() => {
    return categories
      .map((category) =>
        normalizeOption(
          category,
          "تصنيف دون اسم"
        )
      )
      .filter((option) => option.value);
  }, [categories]);

  /* ==================================================
     مسح خطأ أحد الحقول
  ================================================== */

  function clearFieldError(fieldName) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
    }));
  }

  /* ==================================================
     إرسال النموذج
  ================================================== */

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      busy ||
      typeof onSubmit !== "function"
    ) {
      return;
    }

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const payload = {
      name: normalizeText(
        formData.get("name")
      ),

      assetNumber: normalizeText(
        formData.get("assetNumber")
      ),

      serialNumber: normalizeText(
        formData.get("serialNumber")
      ),

      locationId,
      categoryId: categoryId || null,
      isActive,
    };

    const nextErrors = {};

    if (payload.name.length < 2) {
      nextErrors.name =
        "اسم الجهاز يجب ألا يقل عن حرفين.";
    }

    if (payload.name.length > 160) {
      nextErrors.name =
        "اسم الجهاز يجب ألا يتجاوز 160 حرفًا.";
    }

    if (!payload.locationId) {
      nextErrors.locationId =
        "يجب اختيار موقع الجهاز.";
    }

    if (payload.assetNumber.length > 100) {
      nextErrors.assetNumber =
        "الرقم الداخلي يجب ألا يتجاوز 100 حرف.";
    }

    if (payload.serialNumber.length > 150) {
      nextErrors.serialNumber =
        "الرقم التسلسلي يجب ألا يتجاوز 150 حرفًا.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit(payload, formElement);
  }

  /* ==================================================
     واجهة النموذج
  ================================================== */

  return (
    <form
      className="create-modal"
      onSubmit={handleSubmit}
      noValidate
    >
      {error ? (
        <div
          className="form-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Input
        label="اسم الجهاز أو الأصل"
        name="name"
        defaultValue={
          initialValues.name ?? ""
        }
        placeholder="مثال: مكيف غرفة الاجتماعات"
        error={fieldErrors.name}
        disabled={busy}
        required
        minLength={2}
        maxLength={160}
        autoFocus
        onChange={() =>
          clearFieldError("name")
        }
      />

      <div className="form-row">
        <Input
          label="الرقم الداخلي"
          name="assetNumber"
          defaultValue={
            initialValues.assetNumber ??
            initialValues.asset_number ??
            initialValues.assetCode ??
            initialValues.asset_code ??
            ""
          }
          placeholder="مثال: AC-RYD-001"
          hint="يمكن تركه فارغًا ليتم إنشاؤه تلقائيًا."
          error={fieldErrors.assetNumber}
          disabled={busy}
          maxLength={100}
          dir="ltr"
          autoComplete="off"
          onChange={() =>
            clearFieldError("assetNumber")
          }
        />

        <Input
          label="الرقم التسلسلي"
          name="serialNumber"
          defaultValue={
            initialValues.serialNumber ??
            initialValues.serial_number ??
            ""
          }
          placeholder="Serial Number"
          error={fieldErrors.serialNumber}
          disabled={busy}
          maxLength={150}
          dir="ltr"
          autoComplete="off"
          onChange={() =>
            clearFieldError("serialNumber")
          }
        />
      </div>

      <div className="form-row">
        <Select
          label="الموقع أو الفرع"
          name="locationId"
          options={locationOptions}
          value={locationId}
          placeholder="اختاري موقع الجهاز"
          error={fieldErrors.locationId}
          disabled={busy}
          required
          onChange={(event) => {
            setLocationId(event.target.value);
            clearFieldError("locationId");
          }}
        />

        <Select
          label="التصنيف"
          name="categoryId"
          options={categoryOptions}
          value={categoryId}
          placeholder="دون تصنيف"
          disabled={busy}
          onChange={(event) => {
            setCategoryId(event.target.value);
            clearFieldError("categoryId");
          }}
        />
      </div>

      {locationOptions.length === 0 ? (
        <div
          className="form-error"
          role="alert"
        >
          لا توجد مواقع نشطة متاحة. يجب إضافة موقع أولًا.
        </div>
      ) : null}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          margin: 0,
          cursor: busy
            ? "default"
            : "pointer",
        }}
      >
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(event) =>
            setIsActive(event.target.checked)
          }
          disabled={busy}
          style={{
            width: "16px",
            height: "16px",
          }}
        />

        <span>
          الجهاز نشط ويستقبل بلاغات الصيانة
        </span>
      </label>

      <div className="modal-buttons">
        {typeof onCancel === "function" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            إلغاء
          </Button>
        ) : null}

        <Button
          type="submit"
          loading={busy}
          loadingText="جاري الحفظ…"
          disabled={
            locationOptions.length === 0
          }
        >
          {submitText}
        </Button>
      </div>
    </form>
  );
}