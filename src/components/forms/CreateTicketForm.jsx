import { useMemo, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

import {
  PRIORITY,
  PRIORITY_LABELS,
} from "../../constants/priorities";

import { validateImage } from "../../utils/validation";

const PRIORITY_OPTIONS = Object.values(PRIORITY).map(
  (priority) => ({
    value: priority,
    label: PRIORITY_LABELS[priority] || priority,
  })
);

function normalizeOption(item, fallbackLabel = "عنصر") {
  if (typeof item === "string") {
    return {
      value: item,
      label: item,
      locationId: null,
      categoryId: null,
    };
  }

  const assetNumber =
    item?.asset_number ||
    item?.assetNumber ||
    "";

  const baseLabel =
    item?.full_name ||
    item?.fullName ||
    item?.name ||
    item?.label ||
    item?.title ||
    fallbackLabel;

  return {
    value:
      item?.id ??
      item?.value ??
      item?.name ??
      "",

    label: assetNumber
      ? `${baseLabel} — ${assetNumber}`
      : baseLabel,

    locationId:
      item?.location_id ??
      item?.locationId ??
      null,

    categoryId:
      item?.category_id ??
      item?.categoryId ??
      null,
  };
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").trim();
}

function isValidEmail(email) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function isValidPhone(phone) {
  if (!phone) {
    return true;
  }

  const digits = phone.replace(/\D/g, "");

  return (
    digits.length >= 8 &&
    digits.length <= 15
  );
}

function buildDescription({
  description,
  assetNotListed,
  unlistedAssetName,
  unlistedAssetLocation,
}) {
  if (!assetNotListed) {
    return description;
  }

  const extraDetails = [
    "بيانات جهاز غير موجود في القائمة:",
    `اسم الجهاز: ${unlistedAssetName}`,

    unlistedAssetLocation
      ? `موقع الجهاز داخل الفرع: ${unlistedAssetLocation}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${description}\n\n${extraDetails}`.trim();
}

export default function CreateTicketForm({
  locations = [],
  assets = [],
  categories = [],
  initialValues = {},

  busy = false,
  error = "",
  submitText = "إنشاء الطلب",

  requireAsset = false,
  showReporterFields = false,
  requireReporterContact = false,

  source = "",
  className = "create-modal",

  onSubmit,
  onCancel,
}) {
  const [locationId, setLocationId] = useState(
    initialValues.locationId || ""
  );

  const [assetId, setAssetId] = useState(
    initialValues.assetId || ""
  );

  const [categoryId, setCategoryId] = useState(
    initialValues.categoryId || ""
  );

  const [priority, setPriority] = useState(
    initialValues.priority || PRIORITY.MEDIUM
  );

  const [assetNotListed, setAssetNotListed] =
    useState(
      Boolean(initialValues.assetNotListed)
    );

  const [
    unlistedAssetName,
    setUnlistedAssetName,
  ] = useState(
    initialValues.unlistedAssetName || ""
  );

  const [
    unlistedAssetLocation,
    setUnlistedAssetLocation,
  ] = useState(
    initialValues.unlistedAssetLocation || ""
  );

  const [
    selectedFileName,
    setSelectedFileName,
  ] = useState("");

  const [fieldErrors, setFieldErrors] =
    useState({});

  const locationOptions = useMemo(
    () =>
      locations
        .map((location) =>
          normalizeOption(
            location,
            "موقع دون اسم"
          )
        )
        .filter((option) => option.value),
    [locations]
  );

  const categoryOptions = useMemo(
    () =>
      categories
        .map((category) =>
          normalizeOption(
            category,
            "تصنيف دون اسم"
          )
        )
        .filter((option) => option.value),
    [categories]
  );

  const allAssetOptions = useMemo(
    () =>
      assets
        .map((asset) =>
          normalizeOption(
            asset,
            "جهاز دون اسم"
          )
        )
        .filter((option) => option.value),
    [assets]
  );

  const assetOptions = useMemo(() => {
    return allAssetOptions.filter((asset) => {
      if (!locationId || !asset.locationId) {
        return true;
      }

      return (
        String(asset.locationId) ===
        String(locationId)
      );
    });
  }, [allAssetOptions, locationId]);

  function clearFieldError(fieldName) {
    setFieldErrors((current) => ({
      ...current,
      [fieldName]: "",
    }));
  }

  function handleLocationChange(event) {
    const nextLocationId =
      event.target.value;

    setLocationId(nextLocationId);
    clearFieldError("locationId");

    const currentAsset =
      allAssetOptions.find(
        (asset) =>
          String(asset.value) ===
          String(assetId)
      );

    if (
      currentAsset?.locationId &&
      String(currentAsset.locationId) !==
        String(nextLocationId)
    ) {
      setAssetId("");
    }
  }

  function handleAssetChange(event) {
    const nextAssetId =
      event.target.value;

    setAssetId(nextAssetId);
    clearFieldError("assetId");

    const selectedAsset =
      allAssetOptions.find(
        (asset) =>
          String(asset.value) ===
          String(nextAssetId)
      );

    if (
      selectedAsset?.categoryId &&
      !categoryId
    ) {
      setCategoryId(
        String(selectedAsset.categoryId)
      );
    }
  }

  function handleAssetNotListedChange(event) {
    const checked =
      event.target.checked;

    setAssetNotListed(checked);

    clearFieldError("assetId");
    clearFieldError(
      "unlistedAssetName"
    );

    clearFieldError(
      "unlistedAssetLocation"
    );

    if (checked) {
      setAssetId("");
    }
  }

  function handleFileChange(event) {
    const file =
      event.target.files?.[0] ||
      null;

    const result =
      validateImage(file);

    setFieldErrors((current) => ({
      ...current,

      attachment:
        result.valid
          ? ""
          : result.error,
    }));

    if (!result.valid) {
      event.target.value = "";
      setSelectedFileName("");
      return;
    }

    setSelectedFileName(
      file?.name || ""
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      busy ||
      typeof onSubmit !== "function"
    ) {
      return;
    }

    const formElement =
      event.currentTarget;

    const formData =
      new FormData(formElement);

    const rawDescription = String(
      formData.get("description") || ""
    ).trim();

    const reporterPhone =
      normalizePhone(
        formData.get("reporterPhone")
      );

    const reporterEmail =
      normalizeEmail(
        formData.get("reporterEmail")
      );

    const attachment =
      formData.get("attachment");

    const payload = {
      title: String(
        formData.get("title") || ""
      ).trim(),

      description: buildDescription({
        description: rawDescription,
        assetNotListed,

        unlistedAssetName:
          unlistedAssetName.trim(),

        unlistedAssetLocation:
          unlistedAssetLocation.trim(),
      }),

      locationId,

      assetId:
        assetNotListed
          ? null
          : assetId || null,

      categoryId,
      priority,

      assetNotListed,

      unlistedAssetName:
        assetNotListed
          ? unlistedAssetName.trim()
          : "",

      unlistedAssetLocation:
        assetNotListed
          ? unlistedAssetLocation.trim()
          : "",

      reporterName: String(
        formData.get("reporterName") ||
          ""
      ).trim(),

      reporterPhone,
      reporterEmail,

      reporterContact:
        reporterPhone ||
        reporterEmail ||
        null,

      attachment:
        attachment instanceof File &&
        attachment.size > 0
          ? attachment
          : null,

      source:
        source ||
        (showReporterFields
          ? "PUBLIC_QR"
          : "INTERNAL"),
    };

    const nextErrors = {};

    if (payload.title.length < 3) {
      nextErrors.title =
        "عنوان المشكلة يجب ألا يقل عن 3 أحرف.";
    }

    if (!payload.locationId) {
      nextErrors.locationId =
        "الموقع مطلوب.";
    }

    if (
      requireAsset &&
      !payload.assetId &&
      !payload.assetNotListed
    ) {
      nextErrors.assetId =
        "اختاري جهازًا أو حددي أن الجهاز غير موجود في القائمة.";
    }

    if (
      payload.assetNotListed &&
      payload.unlistedAssetName.length < 2
    ) {
      nextErrors.unlistedAssetName =
        "اكتبي اسم الجهاز غير الموجود في القائمة.";
    }

    if (!payload.categoryId) {
      nextErrors.categoryId =
        "التصنيف مطلوب.";
    }

    if (rawDescription.length < 10) {
      nextErrors.description =
        "وصف المشكلة يجب ألا يقل عن 10 أحرف.";
    }

    if (
      !Object.values(PRIORITY).includes(
        payload.priority
      )
    ) {
      nextErrors.priority =
        "الأولوية غير صحيحة.";
    }

    if (
      showReporterFields &&
      payload.reporterName.length < 2
    ) {
      nextErrors.reporterName =
        "اسم المبلّغ مطلوب.";
    }

    if (
      !isValidPhone(
        payload.reporterPhone
      )
    ) {
      nextErrors.reporterPhone =
        "رقم الجوال غير صحيح.";
    }

    if (
      !isValidEmail(
        payload.reporterEmail
      )
    ) {
      nextErrors.reporterEmail =
        "البريد الإلكتروني غير صحيح.";
    }

    if (
      requireReporterContact &&
      !payload.reporterPhone &&
      !payload.reporterEmail
    ) {
      nextErrors.reporterContact =
        "أدخلي رقم الجوال أو البريد الإلكتروني.";
    }

    const imageValidation =
      validateImage(
        payload.attachment
      );

    if (!imageValidation.valid) {
      nextErrors.attachment =
        imageValidation.error;
    }

    setFieldErrors(nextErrors);

    if (
      Object.keys(nextErrors).length >
      0
    ) {
      return;
    }

    await onSubmit(
      payload,
      formElement
    );
  }

  return (
    <form
      className={className}
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
        label="عنوان المشكلة"
        name="title"
        defaultValue={
          initialValues.title || ""
        }
        placeholder="مثال: المكيف لا يبرد"
        error={fieldErrors.title}
        disabled={busy}
        required
        maxLength={150}
        onChange={() =>
          clearFieldError("title")
        }
      />

      <div className="form-row">
        <Select
          label="الموقع أو الفرع"
          name="locationId"
          options={locationOptions}
          value={locationId}
          onChange={
            handleLocationChange
          }
          placeholder="اختاري الموقع"
          error={
            fieldErrors.locationId
          }
          disabled={busy}
          required
        />

        <Select
          label="الجهاز أو الأصل"
          name="assetId"
          options={assetOptions}
          value={assetId}
          onChange={
            handleAssetChange
          }
          placeholder={
            requireAsset
              ? "اختاري الجهاز"
              : "بلاغ عام دون جهاز"
          }
          hint={
            !locationId
              ? "اختاري الموقع أولًا لعرض أجهزته."
              : assetOptions.length === 0
                ? "لا توجد أجهزة مسجلة في هذا الموقع."
                : "يمكن تركه فارغًا للبلاغات العامة."
          }
          error={fieldErrors.assetId}
          disabled={
            busy ||
            !locationId ||
            assetNotListed
          }
          required={
            requireAsset &&
            !assetNotListed
          }
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: 0,
        }}
      >
        <input
          type="checkbox"
          checked={assetNotListed}
          onChange={
            handleAssetNotListedChange
          }
          disabled={
            busy || !locationId
          }
          style={{
            width: "16px",
            height: "16px",
          }}
        />

        <span>
          الجهاز غير موجود في القائمة
        </span>
      </label>

      {assetNotListed ? (
        <div className="form-row">
          <Input
            label="اسم الجهاز"
            name="unlistedAssetName"
            value={
              unlistedAssetName
            }
            onChange={(event) => {
              setUnlistedAssetName(
                event.target.value
              );

              clearFieldError(
                "unlistedAssetName"
              );
            }}
            placeholder="مثال: ثلاجة غرفة الموظفين"
            error={
              fieldErrors.unlistedAssetName
            }
            disabled={busy}
            required
            maxLength={120}
          />

          <Input
            label="موقع الجهاز داخل الفرع"
            name="unlistedAssetLocation"
            value={
              unlistedAssetLocation
            }
            onChange={(event) => {
              setUnlistedAssetLocation(
                event.target.value
              );

              clearFieldError(
                "unlistedAssetLocation"
              );
            }}
            placeholder="مثال: الدور الثاني، الغرفة 205"
            error={
              fieldErrors.unlistedAssetLocation
            }
            disabled={busy}
            maxLength={200}
          />
        </div>
      ) : null}

      <div className="form-row">
        <Select
          label="التصنيف"
          name="categoryId"
          options={categoryOptions}
          value={categoryId}
          onChange={(event) => {
            setCategoryId(
              event.target.value
            );

            clearFieldError(
              "categoryId"
            );
          }}
          placeholder="اختاري التصنيف"
          error={
            fieldErrors.categoryId
          }
          disabled={busy}
          required
        />

        <Select
          label="الأولوية"
          name="priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(event) => {
            setPriority(
              event.target.value
            );

            clearFieldError(
              "priority"
            );
          }}
          error={
            fieldErrors.priority
          }
          disabled={busy}
          required
        />
      </div>

      <label>
        <span>
          وصف المشكلة
          <span aria-hidden="true">
            {" "}*
          </span>
        </span>

        <textarea
          name="description"
          defaultValue={
            initialValues.description ||
            ""
          }
          placeholder="اشرحي المشكلة، ومتى بدأت، وأي تفاصيل تساعد فريق الصيانة..."
          disabled={busy}
          required
          minLength={10}
          maxLength={2000}
          aria-invalid={Boolean(
            fieldErrors.description
          )}
          onChange={() =>
            clearFieldError(
              "description"
            )
          }
        />

        <small>
          اكتبي وصفًا واضحًا لا يقل
          عن 10 أحرف.
        </small>

        {fieldErrors.description ? (
          <small
            className="form-error"
            role="alert"
          >
            {
              fieldErrors.description
            }
          </small>
        ) : null}
      </label>

      {showReporterFields ? (
        <>
          <Input
            label="اسم المبلّغ"
            name="reporterName"
            defaultValue={
              initialValues.reporterName ||
              ""
            }
            placeholder="الاسم الكامل"
            error={
              fieldErrors.reporterName
            }
            disabled={busy}
            required
            maxLength={100}
            onChange={() =>
              clearFieldError(
                "reporterName"
              )
            }
          />

          <div className="form-row">
            <Input
              label="رقم الجوال"
              name="reporterPhone"
              type="tel"
              defaultValue={
                initialValues.reporterPhone ||
                ""
              }
              placeholder="05xxxxxxxx"
              error={
                fieldErrors.reporterPhone
              }
              disabled={busy}
              inputMode="tel"
              maxLength={20}
              dir="ltr"
              onChange={() =>
                clearFieldError(
                  "reporterPhone"
                )
              }
            />

            <Input
              label="البريد الإلكتروني"
              name="reporterEmail"
              type="email"
              defaultValue={
                initialValues.reporterEmail ||
                ""
              }
              placeholder="name@example.com"
              error={
                fieldErrors.reporterEmail
              }
              disabled={busy}
              inputMode="email"
              dir="ltr"
              onChange={() =>
                clearFieldError(
                  "reporterEmail"
                )
              }
            />
          </div>

          {fieldErrors.reporterContact ? (
            <div
              className="form-error"
              role="alert"
            >
              {
                fieldErrors.reporterContact
              }
            </div>
          ) : null}
        </>
      ) : null}

      <label>
        <span>صورة المشكلة</span>

        <input
          name="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            handleFileChange
          }
          disabled={busy}
          aria-invalid={Boolean(
            fieldErrors.attachment
          )}
        />

        <small>
          يسمح بصور JPG وPNG وWebP
          بحجم أقصى 5MB.
        </small>

        {selectedFileName ? (
          <small>
            الصورة المختارة:{" "}
            {selectedFileName}
          </small>
        ) : null}

        {fieldErrors.attachment ? (
          <small
            className="form-error"
            role="alert"
          >
            {
              fieldErrors.attachment
            }
          </small>
        ) : null}
      </label>

      <div className="modal-buttons">
        {typeof onCancel ===
        "function" ? (
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
          loadingText="جاري إنشاء الطلب…"
        >
          {submitText}
        </Button>
      </div>
    </form>
  );
}