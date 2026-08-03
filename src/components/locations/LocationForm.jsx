import { useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";

export default function LocationForm({
  initialValues = {},
  busy = false,
  error = "",
  submitText = "حفظ الموقع",
  onSubmit,
  onCancel,
}) {
  const [isActive, setIsActive] = useState(
    initialValues.isActive ??
      initialValues.is_active ??
      true
  );

  const [fieldErrors, setFieldErrors] = useState({});

  function clearFieldError(fieldName) {
    setFieldErrors((current) => ({
      ...current,
      [fieldName]: "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy || typeof onSubmit !== "function") {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      description: String(
        formData.get("description") || ""
      ).trim(),
      isActive,
    };

    const nextErrors = {};

    if (payload.name.length < 2) {
      nextErrors.name =
        "اسم الموقع يجب ألا يقل عن حرفين.";
    }

    if (payload.name.length > 120) {
      nextErrors.name =
        "اسم الموقع يجب ألا يتجاوز 120 حرفًا.";
    }

    if (payload.address.length > 300) {
      nextErrors.address =
        "العنوان يجب ألا يتجاوز 300 حرف.";
    }

    if (payload.description.length > 1000) {
      nextErrors.description =
        "الوصف يجب ألا يتجاوز 1000 حرف.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit(payload, event.currentTarget);
  }

  return (
    <form
      className="create-modal"
      onSubmit={handleSubmit}
      noValidate
    >
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <Input
        label="اسم الموقع"
        name="name"
        defaultValue={initialValues.name ?? ""}
        placeholder="مثال: فرع الرياض"
        error={fieldErrors.name}
        onChange={() => clearFieldError("name")}
        disabled={busy}
        required
        minLength={2}
        maxLength={120}
        autoFocus
      />

      <Input
        label="العنوان"
        name="address"
        defaultValue={initialValues.address ?? ""}
        placeholder="مثال: الرياض، حي العليا"
        error={fieldErrors.address}
        onChange={() => clearFieldError("address")}
        disabled={busy}
        maxLength={300}
      />

      <label>
        وصف الموقع

        <textarea
          name="description"
          defaultValue={initialValues.description ?? ""}
          placeholder="اكتبي معلومات إضافية عن الموقع..."
          disabled={busy}
          maxLength={1000}
          onChange={() => clearFieldError("description")}
          aria-invalid={Boolean(fieldErrors.description)}
        />

        <small>
          يمكن إضافة معلومات مثل رقم المبنى أو تعليمات
          الوصول.
        </small>

        {fieldErrors.description ? (
          <small className="form-error" role="alert">
            {fieldErrors.description}
          </small>
        ) : null}
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
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
          الموقع نشط ويمكن إنشاء طلبات وأجهزة داخله
        </span>
      </label>

      <div className="modal-buttons">
        {typeof onCancel === "function" ? (
          <Button
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
        >
          {submitText}
        </Button>
      </div>
    </form>
  );
}
